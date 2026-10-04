'use client';

import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Profile {
  id: string;
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer profile fetch with setTimeout
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        // Auto-recover if refresh token is revoked, expired, or invalid
        if (
          error.message?.includes('Refresh Token') ||
          error.message?.includes('invalid_grant') ||
          error.status === 400
        ) {
          supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        }
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    }).catch(async (err: unknown) => {
      const authErr = err as { message?: string; status?: number };
      if (
        authErr?.message?.includes('Refresh Token') ||
        authErr?.message?.includes('invalid_grant') ||
        authErr?.status === 400
      ) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      }
      setSession(null);
      setUser(null);
      setProfile(null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
      }
      setProfile(null);
      return;
    }
    
    setProfile(data ?? null);
  };

  const signUp = async (
    email: string, 
    password: string, 
    metadata?: { full_name?: string; phone?: string; user_type?: string; [key: string]: unknown }
  ) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: metadata,
      }
    });

    if (error) {
      toast.error(error.message === 'User already registered' || error.message.includes('already registered')
        ? 'อีเมลนี้ถูกใช้งานแล้ว' 
        : error.message);
      return { data: null, error };
    }

    if (data?.user && data.user.identities && data.user.identities.length === 0) {
      toast.error('อีเมลนี้ถูกใช้งานแล้ว');
      return { data, error: new Error('User already registered') };
    }

    return { data, error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      toast.error(error.message === 'Invalid login credentials' 
        ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' 
        : error.message);
      return { error };
    }

    toast.success('เข้าสู่ระบบสำเร็จ!');
    return { data, error: null };
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Fallback to local signout if server session is already invalid
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      }
    } catch {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    }
    setSession(null);
    setUser(null);
    setProfile(null);
    toast.success('ออกจากระบบแล้ว');
    return { error: null };
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      toast.error('ไม่สามารถอัปเดตโปรไฟล์ได้');
      return { error };
    }

    setProfile(data);
    toast.success('อัปเดตโปรไฟล์สำเร็จ');
    return { data, error: null };
  };

  const verifyOtp = async (email: string, token: string, type: 'signup' | 'email' = 'signup') => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type
    });

    if (error) {
      return { error };
    }

    if (data.session) {
      setSession(data.session);
      setUser(data.user);
      if (data.user) {
        await fetchProfile(data.user.id);
      }
    }

    return { data, error: null };
  };

  const resendOtp = async (email: string, type: 'signup' | 'email_change' = 'signup') => {
    const { data, error } = await supabase.auth.resend({
      type,
      email
    });

    if (error) {
      return { error };
    }

    return { data, error: null };
  };

  const resetPasswordForEmail = async (email: string) => {
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : (process.env.NEXT_PUBLIC_APP_URL || 'https://lostreturn.me');
    const redirectTo = `${baseUrl.replace(/\/+$/, '')}/reset-password`;

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    return { data, error };
  };

  return {
    user,
    session,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    verifyOtp,
    resendOtp,
    resetPasswordForEmail,
    updateProfile,
    refreshProfile: () => { if (user) return fetchProfile(user.id); }
  };
};

