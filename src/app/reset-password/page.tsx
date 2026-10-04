'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, Loader2, KeyRound, Home } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ResetPasswordPage = () => {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Check if recovery session exists in URL hash or active session
    const checkRecoverySession = async () => {
      try {
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        const search = typeof window !== 'undefined' ? window.location.search : '';
        const urlParams = new URLSearchParams(search);
        const hasCodeParam = urlParams.has('code');
        const hasRecoveryType = hash.includes('type=recovery') || hash.includes('access_token=');

        if (hasCodeParam) {
          const code = urlParams.get('code')!;
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            if (isMounted) {
              setSessionError('ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว กรุณากดขอลิงก์ใหม่อีกครั้ง');
              setCheckingSession(false);
            }
            return;
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        
        if (isMounted) {
          if (session || hasRecoveryType || hasCodeParam) {
            setSessionReady(true);
          } else {
            setSessionError('ไม่พบเซสชันการรีเซ็ตรหัสผ่าน กรุณาใช้ลิงก์ที่ส่งไปยังอีเมลของคุณ');
          }
          setCheckingSession(false);
        }
      } catch (err) {
        console.error('Session check error:', err);
        if (isMounted) {
          setSessionError('เกิดข้อผิดพลาดในการตรวจสอบลิงก์ กรุณาลองใหม่อีกครั้ง');
          setCheckingSession(false);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        if (isMounted) {
          setSessionReady(true);
          setSessionError(null);
          setCheckingSession(false);
        }
      }
    });

    checkRecoverySession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      toast.error('กรุณากรอกรหัสผ่านใหม่');
      return;
    }

    if (password.length < 8) {
      toast.error('รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('รหัสผ่านยืนยันไม่ตรงกัน');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        toast.error(error.message || 'ไม่สามารถตั้งรหัสผ่านใหม่ได้');
        return;
      }

      setIsSuccess(true);
      toast.success('ตั้งรหัสผ่านใหม่สำเร็จ!');

      setTimeout(() => {
        router.push('/');
      }, 2500);
    } catch (err: unknown) {
      console.error('Reset password error:', err);
      toast.error('เกิดข้อผิดพลาดในการตั้งรหัสผ่านใหม่');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-amber-400/10 rounded-full blur-[130px] pointer-events-none" />

      {/* Header Brand - Minimal Luxury Editorial */}
      <div className="text-center mb-6 z-10">
        <div className="mb-2">
          <span className="font-brand font-bold text-xl sm:text-2xl tracking-tight text-zinc-950 uppercase select-none">
            LOSTRETURN
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
          ตั้งรหัสผ่านใหม่
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-1.5 font-normal leading-relaxed">
          กำหนดรหัสผ่านใหม่เพื่อเข้าใช้งานบัญชีของคุณ
        </p>
      </div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md backdrop-blur-2xl bg-white/85 rounded-3xl p-6 sm:p-8 shadow-[0_16px_48px_rgba(0,0,0,0.06)] border border-zinc-200/90 relative z-10"
      >
        {checkingSession ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            <p className="text-xs sm:text-sm text-zinc-500 font-normal">กำลังตรวจสอบลิงก์ความปลอดภัย...</p>
          </div>
        ) : isSuccess ? (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="py-6 text-center space-y-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900">ตั้งรหัสผ่านใหม่สำเร็จ!</h2>
              <p className="text-xs sm:text-sm text-zinc-500 mt-1 font-normal leading-relaxed">
                รหัสผ่านของคุณถูกอัปเดตเรียบร้อยแล้ว กำลังนำคุณกลับสู่หน้าหลัก...
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => router.push('/')}
                className="w-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-zinc-900 font-semibold py-3.5 rounded-xl shadow-lg shadow-amber-500/20 hover:shadow-amber-400/30 flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer transition-all active:scale-[0.98]"
              >
                <span>Sign In Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ) : sessionError || !sessionReady ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900">ลิงก์ไม่ถูกต้องหรือหมดอายุ</h2>
              <p className="text-xs sm:text-sm text-zinc-500 mt-1 px-2 font-normal leading-relaxed">
                {sessionError || 'ไม่พบเซสชันการรีเซ็ตรหัสผ่าน หรือลิงก์นี้ถูกใช้งานไปแล้ว กรุณากดขอลิงก์ใหม่อีกครั้ง'}
              </p>
            </div>
            <div className="pt-2 space-y-2.5">
              <button
                onClick={() => router.push('/auth')}
                className="w-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-zinc-900 font-semibold py-3.5 rounded-xl shadow-lg shadow-amber-500/20 hover:shadow-amber-400/30 flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer transition-all active:scale-[0.98]"
              >
                <KeyRound className="w-4 h-4" />
                <span>Request New Link</span>
              </button>
              <button
                onClick={() => router.push('/')}
                className="w-full bg-white hover:bg-zinc-50 text-zinc-800 font-medium py-3 rounded-xl border border-zinc-200 flex items-center justify-center gap-2 text-sm transition-all cursor-pointer shadow-sm"
              >
                <Home className="w-4 h-4" />
                <span>Back to Home</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-semibold text-zinc-800 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                <span>รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="กรอกรหัสผ่านใหม่"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-3 sm:py-3.5 rounded-xl border border-zinc-300 hover:border-zinc-400 bg-white text-zinc-900 font-normal placeholder:text-zinc-400 focus:outline-none focus:ring-0 focus:shadow-none focus:border-zinc-900 text-base md:text-sm transition-all shadow-sm"
                  required
                  minLength={8}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-semibold text-zinc-800 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-zinc-700" />
                <span>ยืนยันรหัสผ่านใหม่</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-3 sm:py-3.5 rounded-xl border border-zinc-300 hover:border-zinc-400 bg-white text-zinc-900 font-normal placeholder:text-zinc-400 focus:outline-none focus:ring-0 focus:shadow-none focus:border-zinc-900 text-base md:text-sm transition-all shadow-sm"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors p-1 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !password || !confirmPassword}
                className="w-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-zinc-900 font-semibold py-3.5 rounded-xl shadow-lg shadow-amber-500/20 hover:shadow-amber-400/30 disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer transition-all active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <span>Reset Password</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default ResetPasswordPage;
