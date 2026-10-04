import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { publishMqttServer } from '@/lib/serverMqtt';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/rateLimit';

const sendOtpSchema = z.object({
  transactionId: z.string().uuid('Invalid transactionId format'),
  lockerId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]).optional(),
});

export async function POST(req: Request) {
  try {
    // 1. Rate Limiting (10 requests / min / IP)
    const rateLimit = checkRateLimit(req, {
      limit: 10,
      windowMs: 60 * 1000,
      prefix: 'chat-send-otp',
    });

    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit.reset, 'คุณส่งคำขอ OTP บ่อยเกินไป กรุณารอสักครู่');
    }

    // 2. Auth Guard
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: Missing authentication token' }, { status: 401 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const user = authData.user;

    // 3. Input Validation
    const rawBody = await req.json().catch(() => null);
    const parsed = sendOtpSchema.safeParse(rawBody);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'ข้อมูลนำเข้าไม่ถูกต้อง';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { transactionId, lockerId: requestedLockerId } = parsed.data;

    // 4. Fetch Active Transaction
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('locker_transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('status', 'deposited')
      .maybeSingle();

    if (txError || !transaction) {
      return NextResponse.json({ error: 'ไม่พบรายการฝากของ หรือของถูกรับไปแล้ว' }, { status: 404 });
    }

    // 5. Authorization: Ensure user is the depositor or an admin
    const isOwner = transaction.user_id === user.id;
    if (!isOwner) {
      // Check admin status
      const { data: adminRole } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!adminRole) {
        return NextResponse.json({ error: 'คุณไม่มีสิทธิ์ส่งรหัส OTP สำหรับรายการนี้' }, { status: 403 });
      }
    }

    // 6. Generate Secure 6-digit OTP
    const generatedOtp = crypto.randomInt(100000, 1000000).toString();
    const otpGeneratedAt = new Date().toISOString();

    // 7. Update Transaction in DB and extend lock for 10 minutes
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('locker_transactions')
      .update({
        otp: generatedOtp,
        otp_generated_at: otpGeneratedAt,
        locked_until: lockedUntil,
        lock_reason: 'otp_active',
      })
      .eq('id', transaction.id);

    if (updateError) {
      console.error('[API /api/locker/send-otp] Failed to update OTP in DB:', updateError);
      return NextResponse.json({ error: 'ไม่สามารถบันทึกรหัส OTP ได้' }, { status: 500 });
    }

    // 8. Publish OTP to Locker Hardware via Server MQTT
    const targetLockerId = transaction.locker_id || requestedLockerId;
    if (targetLockerId) {
      try {
        await publishMqttServer(
          `lostreturn/locker/${targetLockerId}/command`,
          JSON.stringify({ otp: generatedOtp })
        );
      } catch (mqttErr) {
        console.warn('[API /api/locker/send-otp] Server MQTT publish warning (non-fatal):', mqttErr);
      }
    }

    return NextResponse.json({
      success: true,
      otp: generatedOtp,
      otpGeneratedAt,
      lockerId: targetLockerId,
      transactionId: transaction.id,
    });
  } catch (err: unknown) {
    console.error('[API /api/locker/send-otp] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
