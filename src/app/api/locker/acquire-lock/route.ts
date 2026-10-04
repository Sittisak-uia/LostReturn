import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/rateLimit';

const acquireLockSchema = z.object({
  lockerId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]).optional(),
  transactionId: z.string().uuid('Invalid transactionId format').optional(),
  reason: z.enum(['verifying', 'otp_active']).default('verifying'),
});

export async function POST(req: Request) {
  try {
    // 1. Rate Limiting Guard (30 requests / min / IP)
    const rateLimit = checkRateLimit(req, {
      limit: 30,
      windowMs: 60 * 1000,
      prefix: 'locker-acquire-lock',
    });

    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit.reset, 'คุณส่งคำขอบ่อยเกินไป กรุณารอสักครู่');
    }

    // 2. Strict Authentication Guard
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Missing authentication token' }, { status: 401 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const user = authData.user;

    // 3. Input Validation
    const rawBody = await req.json().catch(() => null);
    const parsed = acquireLockSchema.safeParse(rawBody);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'ข้อมูลนำเข้าไม่ถูกต้อง';
      return NextResponse.json({ success: false, error: firstError }, { status: 400 });
    }

    const { lockerId, transactionId, reason } = parsed.data;

    if (!lockerId && !transactionId) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุ lockerId หรือ transactionId' }, { status: 400 });
    }

    // 4. Resolve Target Transaction ID
    let targetTxId = transactionId;

    if (!targetTxId && lockerId) {
      const { data: latestTx, error: findError } = await supabaseAdmin
        .from('locker_transactions')
        .select('id')
        .eq('locker_id', lockerId)
        .eq('status', 'deposited')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (findError || !latestTx) {
        return NextResponse.json({ success: false, error: 'ไม่พบรายการฝากของ หรือของถูกรับไปแล้ว' }, { status: 404 });
      }

      targetTxId = latestTx.id;
    }

    if (!targetTxId) {
      return NextResponse.json({ success: false, error: 'ไม่พบรายการที่ต้องการล็อก' }, { status: 404 });
    }

    // 5. Single Atomic Conditional Update (Eliminates TOCTOU Race Condition)
    // Acquire lock only if:
    //  - status = 'deposited' AND
    //  - (locked_by IS NULL OR locked_by = user.id OR locked_until <= NOW())
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const lockDurationMs = reason === 'otp_active' ? 10 * 60 * 1000 : 3 * 60 * 1000;
    const lockedUntil = new Date(now + lockDurationMs).toISOString();

    const { data: updatedTx, error: updateError } = await supabaseAdmin
      .from('locker_transactions')
      .update({
        locked_by: user.id,
        locked_until: lockedUntil,
        lock_reason: reason,
      })
      .eq('id', targetTxId)
      .eq('status', 'deposited')
      .or(`locked_by.is.null,locked_by.eq.${user.id},locked_until.lte.${nowIso}`)
      .select('id, locker_id, locked_by, locked_until, lock_reason')
      .maybeSingle();

    if (updateError) {
      console.error('[acquire-lock] DB update failed:', updateError);
      return NextResponse.json({ success: false, error: 'ไม่สามารถล็อกตู้ได้' }, { status: 500 });
    }

    // 6. Handle Atomic Execution Result
    if (!updatedTx) {
      // 0 rows updated: Determine whether transaction does not exist or was locked by another user
      const { data: existingTx } = await supabaseAdmin
        .from('locker_transactions')
        .select('id, locker_id, status, locked_by, locked_until')
        .eq('id', targetTxId)
        .maybeSingle();

      if (!existingTx || existingTx.status !== 'deposited') {
        return NextResponse.json({ success: false, error: 'ไม่พบรายการฝากของ หรือของถูกรับไปแล้ว' }, { status: 404 });
      }

      // Conflict: Row exists but condition failed because another active lock is held
      return NextResponse.json({
        success: false,
        isLocked: true,
        error: 'ตู้กำลังถูกตรวจสอบโดยผู้ใช้อื่น',
        lockedUntil: existingTx.locked_until,
      }, { status: 409 });
    }

    // Lock successfully acquired atomically
    return NextResponse.json({
      success: true,
      lockerId: updatedTx.locker_id,
      transactionId: updatedTx.id,
      lockedBy: updatedTx.locked_by,
      lockedUntil: updatedTx.locked_until,
      lockReason: updatedTx.lock_reason,
    });
  } catch (err) {
    console.error('[acquire-lock] Unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
