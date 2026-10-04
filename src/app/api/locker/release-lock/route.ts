import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  try {
    // 1. Parse Request Body (supports JSON or plain text)
    let body: any = null;
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      body = await req.json().catch(() => null);
    } else {
      const text = await req.text().catch(() => '');
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }

    const lockerId = body?.lockerId ? Number(body.lockerId) : undefined;
    const transactionId = body?.transactionId || undefined;

    if (!lockerId && !transactionId) {
      return NextResponse.json({ error: 'Missing lockerId or transactionId' }, { status: 400 });
    }

    // 2. Identify Authenticated User strictly from Bearer Token
    let authenticatedUserId: string | null = null;
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (token) {
      const { data: authData } = await supabaseAdmin.auth.getUser(token);
      if (authData?.user) {
        authenticatedUserId = authData.user.id;
      }
    }

    // 3. Find Active Transaction (Selective query to avoid over-fetching)
    let query = supabaseAdmin
      .from('locker_transactions')
      .select('id, locker_id, status, locked_by, locked_until, lock_reason')
      .eq('status', 'deposited');

    if (transactionId) {
      query = query.eq('id', transactionId);
    } else if (lockerId) {
      query = query.eq('locker_id', lockerId);
    }

    const { data: transaction, error: txError } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (txError || !transaction) {
      return NextResponse.json({ success: true, message: 'No active transaction found' });
    }

    // If transaction is not currently locked, return success immediately
    if (!transaction.locked_by) {
      return NextResponse.json({ success: true, message: 'Locker is not currently locked' });
    }

    // 4. Authorization Evaluation:
    // Case 1: Check if the lock has already expired (System/Cleanup)
    const isExpired = Boolean(
      transaction.locked_until && new Date(transaction.locked_until).getTime() <= Date.now()
    );

    let isAuthorized = false;

    if (isExpired) {
      // Lock has expired: allow release by cleanup or any client
      isAuthorized = true;
    } else if (authenticatedUserId) {
      // Case 2: Owner of the lock
      if (transaction.locked_by === authenticatedUserId) {
        isAuthorized = true;
      } else {
        // Case 3: Admin check
        const { data: adminRole } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', authenticatedUserId)
          .eq('role', 'admin')
          .maybeSingle();

        if (adminRole) {
          isAuthorized = true;
        }
      }
    }

    // If neither owner, admin, nor expired, reject the request
    if (!isAuthorized) {
      if (!authenticatedUserId) {
        return NextResponse.json(
          { error: 'Unauthorized: Authentication required to release active lock' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to release this lock' },
        { status: 403 }
      );
    }

    // 5. Release the Lock in DB
    const { error: updateError } = await supabaseAdmin
      .from('locker_transactions')
      .update({
        locked_by: null,
        locked_until: null,
        lock_reason: null,
      })
      .eq('id', transaction.id);

    if (updateError) {
      console.error('[release-lock] DB update error:', updateError);
      return NextResponse.json({ error: 'Failed to release lock' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Lock released successfully',
      lockerId: transaction.locker_id,
      transactionId: transaction.id
    });
  } catch (err) {
    console.error('[release-lock] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
