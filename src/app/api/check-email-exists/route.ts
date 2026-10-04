import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/rateLimit';

const checkEmailSchema = z.object({
  email: z.string().trim().email('รูปแบบอีเมลไม่ถูกต้อง').max(100, 'อีเมลยาวเกินไป'),
});

export async function POST(req: Request) {
  try {
    // 1. Rate Limiting Guard (Max 10 requests / min / IP)
    const rateLimit = checkRateLimit(req, {
      limit: 10,
      windowMs: 60 * 1000,
      prefix: 'check-email',
    });

    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit.reset, 'คุณตรวจสอบอีเมลบ่อยเกินไป กรุณารอสักครู่');
    }

    // 2. Auth Guard
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return NextResponse.json({ exists: null, error: 'Unauthorized: Missing authentication token' }, { status: 401 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return NextResponse.json({ exists: null, error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    // 3. Zod Input Validation
    const rawBody = await req.json().catch(() => null);
    const parsed = checkEmailSchema.safeParse(rawBody);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'อีเมลไม่ถูกต้อง';
      return NextResponse.json({ exists: false, error: firstError }, { status: 400 });
    }

    const cleanEmail = parsed.data.email.toLowerCase();

    // 4. Memory-optimized user existence check (Paginated & Short-circuit)
    let userExists = false;
    let page = 1;
    const perPage = 50; // Small batch size to avoid memory spikes

    while (page <= 20) { // Safety ceiling of 1,000 users max
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        console.error('[check-email-exists] Error querying users');
        return NextResponse.json({ exists: null, error: 'Failed to verify email' }, { status: 500 });
      }

      const users = data?.users || [];
      if (users.length === 0) break;

      const found = users.some((u) => u.email?.toLowerCase() === cleanEmail);
      if (found) {
        userExists = true;
        break;
      }

      if (users.length < perPage) break;
      page += 1;
    }

    return NextResponse.json({ exists: userExists });
  } catch (err: unknown) {
    console.error('Error in check-email-exists:', err);
    return NextResponse.json({ exists: null, error: 'Internal server error' }, { status: 500 });
  }
}
