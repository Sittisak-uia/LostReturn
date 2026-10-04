import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request) {
  try {
    // 1. Authenticate Request
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
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired token' }, { status: 401 });
    }

    const user = authData.user;

    // 2. Authorize Admin Role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      return NextResponse.json({ error: 'Forbidden: Admin privileges required' }, { status: 403 });
    }

    // 3. Fetch transactions with safe limit to prevent unbounded memory spike
    const { data: transactions, error: txError } = await supabaseAdmin
      .from('locker_transactions')
      .select('id, locker_id, item_description, image_url, status, created_at, deposited_at, depositor_name, depositor_contact, user_id, collected_at, collector_name, collector_contact, collector_user_id, security_question, security_answer, otp, otp_generated_at, locked_by, locked_until, lock_reason')
      .order('created_at', { ascending: false })
      .limit(200);

    if (txError) {
      console.error('Error fetching admin transactions:', txError);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ transactions: [] });
    }

    // 4. Batch query profiles for both depositors and collectors
    const userIds = Array.from(
      new Set(
        transactions
          .flatMap((tx) => [tx.user_id, tx.collector_user_id])
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    );

    let profileMap = new Map<string, {
      user_id: string;
      username: string | null;
      full_name: string | null;
      avatar_url: string | null;
      phone: string | null;
      student_id: string | null;
    }>();

    if (userIds.length > 0) {
      const { data: profiles, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('user_id, username, full_name, avatar_url, phone, student_id')
        .in('user_id', userIds);

      if (!profileError && profiles) {
        profileMap = new Map(profiles.map((p) => [p.user_id, p]));
      }
    }

    // 5. Enrich transactions with profile metadata & sanitize sensitive active OTPs
    const enrichedTransactions = transactions.map((tx) => {
      const isStillDeposited = tx.status === 'deposited';
      return {
        ...tx,
        // Mask active OTP while item is still in locker to protect locker contents
        otp: isStillDeposited && tx.otp ? '******' : tx.otp,
        depositor_profile: tx.user_id ? profileMap.get(tx.user_id) || null : null,
        collector_profile: tx.collector_user_id ? profileMap.get(tx.collector_user_id) || null : null,
      };
    });

    return NextResponse.json({ transactions: enrichedTransactions });
  } catch (err: unknown) {
    console.error('Unhandled admin transactions error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
