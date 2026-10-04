import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/rateLimit';

const markChatReadSchema = z.object({
  roomId: z.string().uuid('Invalid roomId').optional(),
  room_id: z.string().uuid('Invalid room_id').optional(),
  currentUserId: z.string().uuid('Invalid currentUserId').optional(),
  current_user_id: z.string().uuid('Invalid current_user_id').optional(),
  targetUserId: z.string().uuid('Invalid targetUserId').optional(),
  target_user_id: z.string().uuid('Invalid target_user_id').optional(),
  userId: z.string().uuid('Invalid userId').optional(),
  user_id: z.string().uuid('Invalid user_id').optional(),
  viewerRole: z.string().max(20).optional(),
  viewer_role: z.string().max(20).optional(),
  role: z.string().max(20).optional(),
  type: z.enum(['locker', 'admin']).optional(),
});

export async function POST(req: Request) {
  try {
    // 1. Rate Limiting Guard
    const rateLimit = checkRateLimit(req, {
      limit: 30,
      windowMs: 60 * 1000,
      prefix: 'mark-chat-read',
    });

    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit.reset);
    }

    // 2. Mandatory Auth Guard
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized: Missing Authorization header' }, { status: 401 });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: Missing bearer token' }, { status: 401 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const authenticatedUserId = authData.user.id;

    // 3. Zod Input Validation
    const rawBody = await req.json().catch(() => null);
    const parsed = markChatReadSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    const body = parsed.data;
    const roomId = body.roomId || body.room_id;
    const currentUserId = authenticatedUserId;
    const targetUserId = body.targetUserId || body.target_user_id || body.userId || body.user_id || authenticatedUserId;
    const viewerRole = (body.viewerRole || body.viewer_role || body.role || '').toLowerCase();

    // -----------------------------------------------------------------------
    // 1. LOCKER CHAT UPDATES (chat_messages)
    // -----------------------------------------------------------------------
    if (roomId && currentUserId) {
      const { data, error } = await supabaseAdmin
        .from('chat_messages')
        .update({ is_read: true })
        .eq('room_id', roomId)
        .neq('sender_id', currentUserId)
        .select();

      if (error) {
        console.error('[mark-chat-read] Database error updating chat_messages');
        return NextResponse.json(
          { error: 'Failed to update message status' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        type: 'locker',
        roomId,
        updatedCount: data?.length ?? 0,
      });
    }

    // -----------------------------------------------------------------------
    // 2. ADMIN CHAT UPDATES (admin_messages)
    // -----------------------------------------------------------------------
    if (targetUserId && (viewerRole === 'admin' || viewerRole === 'user')) {
      const targetSenderType = viewerRole === 'admin' ? 'user' : 'admin';

      const { data, error } = await supabaseAdmin
        .from('admin_messages')
        .update({ is_read: true })
        .eq('user_id', targetUserId)
        .eq('sender_type', targetSenderType)
        .select();

      if (error) {
        console.error('[mark-chat-read] Database error updating admin_messages');
        return NextResponse.json(
          { error: 'Failed to update message status' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        type: 'admin',
        targetUserId,
        updatedCount: data?.length ?? 0,
      });
    }

    return NextResponse.json(
      { error: 'Missing required parameters' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[mark-chat-read] Unexpected error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
