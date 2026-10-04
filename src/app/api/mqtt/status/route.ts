import { NextResponse } from 'next/server';
import { getMqttSubscriberStatus, startMqttLockerSubscriber } from '@/lib/serverMqttSubscriber';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request) {
  const status = getMqttSubscriberStatus();

  // If not connected yet, attempt to start it
  if (!status.connected) {
    startMqttLockerSubscriber();
  }

  // Check if admin is requesting
  let isAdmin = false;
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (token) {
      try {
        const { data: authData } = await supabaseAdmin.auth.getUser(token);
        if (authData?.user) {
          const { data: roleData } = await supabaseAdmin
            .from('user_roles')
            .select('role')
            .eq('user_id', authData.user.id)
            .eq('role', 'admin')
            .maybeSingle();
          if (roleData) isAdmin = true;
        }
      } catch {}
    }
  }

  const currentStatus = getMqttSubscriberStatus();

  // If admin, return full diagnostic info; if public/healthcheck, return sanitized status
  return NextResponse.json({
    service: 'mqtt-locker-subscriber',
    status: isAdmin
      ? currentStatus
      : {
          connected: currentStatus.connected,
          lastConnectedAt: currentStatus.lastConnectedAt,
          lastMessageAt: currentStatus.lastMessageAt,
        },
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
  }

  const { data: roleData } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', authData.user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (!roleData) {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  const client = startMqttLockerSubscriber();
  return NextResponse.json({
    message: 'MQTT subscriber startup triggered',
    active: !!client,
    status: getMqttSubscriberStatus(),
  });
}
