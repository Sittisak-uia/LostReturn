'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useAdmin = (userId?: string) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!userId) {
        setIsAdmin(false);
        setVerifiedUserId(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();

      if (error) {
        console.error('Error checking admin role:', error);
      }

      setIsAdmin(!!data);
      setVerifiedUserId(userId);
      setLoading(false);
    };

    checkAdmin();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAdmin();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  // It is loading if we are fetching, or if we have a userId but haven't verified it yet
  const isLoading = loading || (!!userId && verifiedUserId !== userId);

  return { isAdmin, loading: isLoading };
};
