'use client';

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function PresenceTracker() {
  const { user } = useAuth();
  const lastPingRef = useRef<number>(0);

  const sendHeartbeat = useCallback(async () => {
    if (!user) return;

    const now = Date.now();
    // Throttle heartbeats to at most once every 10 seconds on frequent interaction events
    if (now - lastPingRef.current < 10000) {
      return;
    }
    lastPingRef.current = now;

    try {
      await supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('user_id', user.id);
    } catch (err) {
      console.warn('Presence heartbeat error:', err);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // 1. Initial heartbeat on mount
    sendHeartbeat();

    // 2. Periodic heartbeat every 30 seconds
    const interval = setInterval(() => {
      sendHeartbeat();
    }, 30000);

    // 3. Event listeners for focus and visibility change
    const handleActivity = () => {
      sendHeartbeat();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    };

    window.addEventListener('focus', handleActivity);
    window.addEventListener('click', handleActivity);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleActivity);
      window.removeEventListener('click', handleActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, sendHeartbeat]);

  return null;
}
