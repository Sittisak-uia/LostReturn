import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/rateLimit';

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// Production-safe debounce delay (5 seconds)
const DEBOUNCE_DELAY_MS = 5000;

// In-memory cooldown store to prevent spamming notifications for the same thread within 5 minutes
const emailCooldownMap = new Map<string, number>();

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of emailCooldownMap.entries()) {
      if (now - timestamp > 15 * 60 * 1000) {
        emailCooldownMap.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

const notificationSchema = z.object({
  content: z.string().max(1000).optional(),
  message: z.string().max(1000).optional(),
  message_type: z.string().max(50).optional(),
  messageId: z.string().max(100).optional(),
  message_id: z.string().max(100).optional(),
  type: z.enum(['locker', 'admin']).optional(),
  roomId: z.string().uuid().optional(),
  room_id: z.string().uuid().optional(),
  sender_type: z.enum(['user', 'admin']).optional(),
  userId: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
});

// Context-Aware Minimal HTML Email Template
function generateMinimalEmailHtml(chatLink: string, title?: string, message?: string): string {
  const displayTitle = title || 'คุณมีข้อความใหม่';
  const displayMsg =
    message ||
    'มีผู้ใช้งานส่งข้อความหาคุณเกี่ยวกับรายการสิ่งของ สามารถเข้าสู่ระบบเพื่ออ่านข้อความและตอบกลับได้ทันที';

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin: 0; padding: 24px; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: left;">
    <h1 style="font-size: 22px; font-weight: bold; color: #18181b; margin: 0 0 12px 0; text-align: left;">${displayTitle}</h1>
    <p style="font-size: 15px; color: #52525b; margin: 0 0 24px 0; line-height: 1.6; text-align: left;">${displayMsg}</p>
    <p style="margin: 0; text-align: left;">
      <a href="${chatLink}" style="font-size: 15px; color: #2563eb; text-decoration: underline; font-weight: 500;">เปิดเว็บไซต์</a>
    </p>
  </body>
</html>`;
}

export async function POST(req: Request) {
  try {
    // 0. Rate Limiting Guard (Max 15 notification requests / min / IP)
    const rateLimit = checkRateLimit(req, {
      limit: 15,
      windowMs: 60 * 1000,
      prefix: 'chat-notification',
    });

    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit.reset, 'ส่งการแจ้งเตือนบ่อยเกินไป กรุณารอสักครู่');
    }

    // =========================================================================
    // 1. AUTHENTICATION VERIFICATION
    // =========================================================================
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized: Missing Authorization header' }, { status: 401 });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: Missing bearer token' }, { status: 401 });
    }

    // Verify session token via supabaseAdmin
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired token' }, { status: 401 });
    }

    const senderUserId = authData.user.id;
    const rawBody = await req.json().catch(() => null);
    const parsed = notificationSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 });
    }

    const body = parsed.data;
    const currentMsgId = body.messageId || body.message_id;

    // Determine notification context: Locker Chat (Case A) vs Admin Chat (Case B)
    const isLockerChat = Boolean(body.roomId || body.room_id || (body.type === 'locker' && !body.sender_type));
    const baseUrl = (
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://lostreturn.me')
    ).replace(/\/+$/, '');

    // Unified Email Metadata
    const senderFrom = process.env.SMTP_FROM || `"LostReturn" <noreply@lostreturn.me>`;

    // Prepare transporter with env configurations (Supports Resend SMTP / Port 465 SSL)
    const smtpPort = Number(process.env.SMTP_PORT) || 465;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.resend.com',
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: process.env.SMTP_USER || 'resend',
        pass: process.env.SMTP_PASS,
      },
    });

    // =========================================================================
    // CASE A: LOCKER CHAT (chat_messages & chat_rooms)
    // =========================================================================
    if (isLockerChat) {
      const roomId = body.roomId || body.room_id;
      if (!roomId) {
        return NextResponse.json({ error: 'Missing roomId for locker chat notification' }, { status: 400 });
      }

      // 1. Fetch Room Details
      const { data: room, error: roomError } = await supabaseAdmin
        .from('chat_rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (roomError || !room) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      }

      // 2. Identify Recipient
      const receiverUserId = senderUserId === room.depositor_id ? room.claimer_id : room.depositor_id;
      if (!receiverUserId) {
        return NextResponse.json({ error: 'Recipient user ID could not be identified' }, { status: 400 });
      }

      // Check In-Memory Cooldown (5 minutes per recipient in this room)
      const cooldownKey = `locker:${roomId}:to:${receiverUserId}`;
      const lastSent = emailCooldownMap.get(cooldownKey);
      if (lastSent && Date.now() - lastSent < 5 * 60 * 1000) {
        return NextResponse.json({
          skipped: true,
          reason: 'Notification cooldown active for this recipient in chat room (already sent within 5 minutes)',
        });
      }

      // =======================================================================
      // 3. 5-SECOND DEBOUNCE DELAY (Check if recipient opens chat immediately)
      // =======================================================================
      await delay(DEBOUNCE_DELAY_MS);

      // =======================================================================
      // 4. CHECK UNREAD STATUS & READ RECEIPT AFTER DELAY
      // =======================================================================
      let unreadQuery = supabaseAdmin
        .from('chat_messages')
        .select('id, is_read')
        .eq('room_id', roomId)
        .eq('sender_id', senderUserId);

      if (currentMsgId) {
        unreadQuery = unreadQuery.eq('id', currentMsgId);
      } else {
        unreadQuery = unreadQuery.order('created_at', { ascending: false }).limit(1);
      }

      const { data: unreadMessages } = await unreadQuery;
      const targetMessage = unreadMessages?.[0];

      if (targetMessage?.is_read === true) {
        return NextResponse.json({
          skipped: true,
          reason: 'Message was already read by recipient within debounce window',
        });
      }

      // Verify message still exists
      if (currentMsgId) {
        const { data: messageData } = await supabaseAdmin
          .from('chat_messages')
          .select('id')
          .eq('id', currentMsgId)
          .single();

        if (!messageData) {
          return NextResponse.json({
            skipped: true,
            reason: 'Original message was deleted during delay window',
          });
        }
      }

      // =======================================================================
      // 5. CHECK RECIPIENT ONLINE STATUS (last_seen_at <= 45s)
      // =======================================================================
      const { data: recipientProfile } = await supabaseAdmin
        .from('profiles')
        .select('last_seen_at')
        .eq('user_id', receiverUserId)
        .single();

      if (recipientProfile?.last_seen_at) {
        const lastSeen = new Date(recipientProfile.last_seen_at).getTime();
        const diffSeconds = (Date.now() - lastSeen) / 1000;

        if (diffSeconds <= 45) {
          return NextResponse.json({
            skipped: true,
            reason: 'Recipient is currently online on the website (last_seen within 45s)',
          });
        }
      }

      // 6. Resolve Emails
      const [senderRes, receiverRes] = await Promise.all([
        supabaseAdmin.auth.admin.getUserById(senderUserId),
        supabaseAdmin.auth.admin.getUserById(receiverUserId),
      ]);

      const senderEmail = senderRes.data?.user?.email;
      const receiverEmail = receiverRes.data?.user?.email;

      if (!senderEmail || !receiverEmail) {
        return NextResponse.json({ skipped: true, reason: 'Email address not found for participants' });
      }

      if (senderEmail.toLowerCase().trim() === receiverEmail.toLowerCase().trim()) {
        return NextResponse.json({ skipped: true, reason: 'Sender and receiver are the same email' });
      }

      const emailSubject = 'LostReturn: คุณมีข้อความใหม่เกี่ยวกับรายการสิ่งของ';
      const emailHtml = generateMinimalEmailHtml(
        baseUrl,
        'คุณมีข้อความใหม่',
        'มีผู้ใช้งานส่งข้อความหาคุณเกี่ยวกับรายการสิ่งของ สามารถเข้าสู่ระบบเพื่ออ่านข้อความและตอบกลับได้ทันที'
      );

      await transporter.sendMail({
        from: senderFrom,
        to: receiverEmail,
        replyTo: senderEmail,
        subject: emailSubject,
        html: emailHtml,
      });

      // Record Cooldown
      emailCooldownMap.set(cooldownKey, Date.now());

      return NextResponse.json({ success: true, message: 'Notification email sent' });
    }

    // =========================================================================
    // CASE B: ADMIN CHAT (admin_messages)
    // =========================================================================
    let senderEmail: string | undefined;
    let receiverEmail: string | undefined;
    let chatLink: string;
    let emailSubject: string;
    let emailTitle: string;
    let emailBodyText: string;
    let cooldownKey: string;

    const isStudentSender = body.sender_type === 'user';

    if (isStudentSender) {
      // -----------------------------------------------------------------------
      // SUB-CASE B1: Student -> Admin
      // -----------------------------------------------------------------------
      const studentUserId = senderUserId;
      chatLink = `${baseUrl}/admin`;
      cooldownKey = `admin_thread:${studentUserId}`;

      // Check In-Memory Cooldown (5 minutes per student thread to Admin)
      const lastSent = emailCooldownMap.get(cooldownKey);
      if (lastSent && Date.now() - lastSent < 5 * 60 * 1000) {
        return NextResponse.json({
          skipped: true,
          reason: 'Cooldown active for admin notifications (already sent within 5 minutes)',
        });
      }

      // 1. 10-SECOND DEBOUNCE DELAY
      await delay(DEBOUNCE_DELAY_MS);

      // 2. CHECK UNREAD STATUS AFTER DELAY
      let unreadQuery = supabaseAdmin
        .from('admin_messages')
        .select('id, is_read')
        .eq('user_id', studentUserId)
        .eq('sender_type', 'user');

      if (currentMsgId) {
        unreadQuery = unreadQuery.eq('id', currentMsgId);
      } else {
        unreadQuery = unreadQuery.order('created_at', { ascending: false }).limit(1);
      }

      const { data: unreadMessages } = await unreadQuery;
      const targetMessage = unreadMessages?.[0];

      if (targetMessage?.is_read === true) {
        return NextResponse.json({
          skipped: true,
          reason: 'Admin message was already read within debounce window',
        });
      }

      // Verify message still exists
      if (currentMsgId) {
        const { data: messageData } = await supabaseAdmin
          .from('admin_messages')
          .select('id')
          .eq('id', currentMsgId)
          .single();

        if (!messageData) {
          return NextResponse.json({
            skipped: true,
            reason: 'Original admin message was deleted during delay window',
          });
        }
      }

      // 3. CHECK ADMIN ONLINE STATUS
      const { data: adminRoles } = await supabaseAdmin
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      const adminUserIds = (adminRoles || []).map((r) => r.user_id);

      if (adminUserIds.length > 0) {
        const now = Date.now();
        let anyAdminOnline = false;

        for (const admId of adminUserIds) {
          const { data: adminProfile } = await supabaseAdmin
            .from('profiles')
            .select('last_seen_at')
            .eq('user_id', admId)
            .single();

          if (adminProfile?.last_seen_at) {
            const lastSeen = new Date(adminProfile.last_seen_at).getTime();
            const diffSeconds = (now - lastSeen) / 1000;
            if (diffSeconds <= 45) {
              anyAdminOnline = true;
              break;
            }
          }
        }

        if (anyAdminOnline) {
          return NextResponse.json({
            skipped: true,
            reason: 'An admin is currently online on the website (last_seen within 45s)',
          });
        }
      }

      // 4. RESOLVE EMAILS
      // Sender: student
      const studentUserRes = await supabaseAdmin.auth.admin.getUserById(studentUserId);
      senderEmail = studentUserRes.data?.user?.email || authData.user.email;

      // Receiver: Resolve actual Admin email from admin users in user_roles, fallback to env ADMIN_EMAIL
      let resolvedAdminEmail: string | undefined;
      for (const admId of adminUserIds) {
        const admUser = await supabaseAdmin.auth.admin.getUserById(admId);
        if (admUser.data?.user?.email) {
          resolvedAdminEmail = admUser.data.user.email;
          break;
        }
      }

      receiverEmail = resolvedAdminEmail || process.env.ADMIN_EMAIL || 'thanapatappakarat@gmail.com';

      emailSubject = 'LostReturn: มีข้อความใหม่ถึงผู้ดูแลระบบ (Admin)';
      emailTitle = 'มีข้อความใหม่ถึงผู้ดูแลระบบ (Admin)';
      emailBodyText =
        'มีผู้ใช้งานติดต่อเข้ามายังศูนย์ช่วยเหลือ กรุณาเข้าสู่ระบบ Admin Dashboard เพื่อตรวจสอบและตอบกลับข้อความ';
    } else {
      // -----------------------------------------------------------------------
      // SUB-CASE B2: Admin -> Student
      // -----------------------------------------------------------------------
      const studentUserId = body.user_id || body.userId;
      if (!studentUserId) {
        return NextResponse.json({ error: 'Missing user_id for recipient' }, { status: 400 });
      }

      chatLink = baseUrl;
      cooldownKey = `user_reply:${studentUserId}`;

      // Check In-Memory Cooldown (5 minutes per reply to student)
      const lastSent = emailCooldownMap.get(cooldownKey);
      if (lastSent && Date.now() - lastSent < 5 * 60 * 1000) {
        return NextResponse.json({
          skipped: true,
          reason: 'Cooldown active for admin replies (already sent within 5 minutes)',
        });
      }

      // 1. 10-SECOND DEBOUNCE DELAY
      await delay(DEBOUNCE_DELAY_MS);

      // 2. CHECK UNREAD STATUS AFTER DELAY
      let unreadQuery = supabaseAdmin
        .from('admin_messages')
        .select('id, is_read')
        .eq('user_id', studentUserId)
        .eq('sender_type', 'admin');

      if (currentMsgId) {
        unreadQuery = unreadQuery.eq('id', currentMsgId);
      } else {
        unreadQuery = unreadQuery.order('created_at', { ascending: false }).limit(1);
      }

      const { data: unreadMessages } = await unreadQuery;
      const targetMessage = unreadMessages?.[0];

      if (targetMessage?.is_read === true) {
        return NextResponse.json({
          skipped: true,
          reason: 'Student message was already read within debounce window',
        });
      }

      // Verify message still exists
      if (currentMsgId) {
        const { data: messageData } = await supabaseAdmin
          .from('admin_messages')
          .select('id')
          .eq('id', currentMsgId)
          .single();

        if (!messageData) {
          return NextResponse.json({
            skipped: true,
            reason: 'Original message was deleted during delay window',
          });
        }
      }

      // 3. CHECK STUDENT ONLINE STATUS
      const { data: studentProfile } = await supabaseAdmin
        .from('profiles')
        .select('last_seen_at')
        .eq('user_id', studentUserId)
        .single();

      if (studentProfile?.last_seen_at) {
        const lastSeen = new Date(studentProfile.last_seen_at).getTime();
        const diffSeconds = (Date.now() - lastSeen) / 1000;

        if (diffSeconds <= 45) {
          return NextResponse.json({
            skipped: true,
            reason: 'Recipient is currently online on the website (last_seen within 45s)',
          });
        }
      }

      // 4. RESOLVE EMAILS
      const [adminUserRes, studentUserRes] = await Promise.all([
        supabaseAdmin.auth.admin.getUserById(senderUserId),
        supabaseAdmin.auth.admin.getUserById(studentUserId),
      ]);

      senderEmail =
        adminUserRes.data?.user?.email ||
        authData.user.email ||
        process.env.ADMIN_EMAIL ||
        'thanapatappakarat@gmail.com';
      receiverEmail = studentUserRes.data?.user?.email;

      emailSubject = 'LostReturn: ผู้ดูแลระบบตอบกลับข้อความของคุณแล้ว';
      emailTitle = 'ผู้ดูแลระบบตอบกลับข้อความของคุณแล้ว';
      emailBodyText =
        'ทีมงานผู้ดูแลระบบ LostReturn ได้ตอบกลับข้อความของคุณแล้ว สามารถเข้าสู่ระบบเพื่ออ่านข้อความและพูดคุยต่อได้ทันที';
    }

    if (!senderEmail || !receiverEmail) {
      return NextResponse.json({ skipped: true, reason: 'Email address not found for participants' });
    }

    if (senderEmail.toLowerCase().trim() === receiverEmail.toLowerCase().trim()) {
      return NextResponse.json({ skipped: true, reason: 'Sender and receiver are the same email' });
    }

    const emailHtml = generateMinimalEmailHtml(chatLink, emailTitle, emailBodyText);

    await transporter.sendMail({
      from: senderFrom,
      to: receiverEmail,
      replyTo: senderEmail,
      subject: emailSubject,
      html: emailHtml,
    });

    // Record Cooldown timestamp
    emailCooldownMap.set(cooldownKey, Date.now());

    return NextResponse.json({ success: true, message: 'Notification email sent' });
  } catch (error: unknown) {
    console.error('[send-chat-notification] Unexpected error sending email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
