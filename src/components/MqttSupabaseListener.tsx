'use client';

import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Supabase Realtime Listener for Lockers and Locker Transactions
 * Replaces direct client-side MQTT with secure Supabase Postgres Change streams.
 */
export function MqttSupabaseListener() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Listen to real-time status changes in lockers table
    const channel = supabase
      .channel('lockers-realtime-listener')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lockers',
        },
        () => {
          // Realtime event received; components consuming useLockerTransactions or local hooks will auto-sync
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'locker_transactions',
        },
        () => {
          // Realtime event received for transactions
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
