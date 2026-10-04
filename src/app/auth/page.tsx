'use client';

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Lock,
  User,
  Phone,
  ArrowRight,
  Loader2,
  ChevronLeft,
  KeyRound,
  MailCheck,
  AlertCircle,
  RotateCw,
  CheckCircle,
  Eye,
  EyeOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const AuthPage = () => {
  const router = useRouter();
  const { signIn, signUp, verifyOtp, resendOtp, user, loading: authLoading } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState<'form' | 'otp' | 'forgot_password'>('form');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    userType: "general" as "student" | "general",
  });

  // OTP State
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Forgot Password State
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
      router.push("/");
    }
  }, [user, authLoading, router]);

  // Handle countdown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      timerRef.current = setTimeout(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          if (error.message.includes('Email not confirmed')) {
            toast.error('กรุณายืนยันอีเมลของคุณก่อนเข้าสู่ระบบ');
            setStep('otp');
            setResendCooldown(60);
          } else if (error.message.includes('Invalid login credentials')) {
            toast.error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
          } else {
            toast.error(error.message);
          }
          return;
        }
        toast.success("เข้าสู่ระบบสำเร็จ!");
        router.push("/");
      } else {
        if (!formData.fullName.trim()) {
          toast.error("กรุณากรอกชื่อ-นามสกุล");
          return;
        }
        if (!formData.phone.trim()) {
          toast.error("กรุณากรอกเบอร์โทรศัพท์");
          return;
        }

        const { error } = await signUp(formData.email, formData.password, {
          full_name: formData.fullName,
          phone: formData.phone,
          user_type: formData.userType,
        });

        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('อีเมลนี้ลงทะเบียนแล้ว กรุณาเข้าสู่ระบบ');
            setIsLogin(true);
          } else {
            toast.error(error.message);
          }
          return;
        }

        toast.success("ส่งรหัส OTP ไปยังอีเมลของคุณแล้ว");
        setStep('otp');
        setResendCooldown(60);
      }
    } catch (err: unknown) {
      console.error('Auth error:', err);
      toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (otpCode.length !== 6) {
      setOtpError('กรุณากรอกรหัส OTP ให้ครบ 6 หลัก');
      return;
    }

    setOtpLoading(true);
    setOtpError('');

    try {
      const { error } = await verifyOtp(formData.email, otpCode, 'signup');
      if (error) {
        setOtpError('รหัส OTP ไม่ถูกต้องหรือหมดอายุ');
        toast.error('ยืนยันรหัส OTP ไม่สำเร็จ');
        return;
      }

      toast.success('ยืนยันอีเมลสำเร็จ! กำลังเข้าสู่ระบบ...');
      router.push('/');
    } catch (err) {
      console.error('Verify OTP error:', err);
      setOtpError('เกิดข้อผิดพลาดในการยืนยัน OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);

    try {
      const { error } = await resendOtp(formData.email, 'signup');
      if (error) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password
        });
        if (signUpError) {
          toast.error(signUpError.message);
          setResending(false);
          return;
        }
      }

      toast.success(`ส่งรหัส OTP ใหม่ไปยัง ${formData.email} แล้ว`);
      setResendCooldown(60);
    } catch (err) {
      console.error('Resend OTP error:', err);
      toast.error('ไม่สามารถส่งรหัส OTP ได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setResending(false);
    }
  };

  const handleSendForgotPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error('กรุณากรอกอีเมลของคุณ');
      return;
    }

    setForgotLoading(true);

    try {
      const baseUrl = typeof window !== 'undefined' 
        ? window.location.origin 
        : (process.env.NEXT_PUBLIC_APP_URL || 'https://lostreturn.me');
      const redirectTo = `${baseUrl.replace(/\/+$/, '')}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo
      });

      if (error) {
        if (error.message.includes('rate limit') || error.message.includes('over_email_send_rate_limit')) {
          toast.error('คุณส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่');
        } else {
          toast.error(error.message);
        }
        return;
      }

      setForgotSent(true);
      toast.success(`ส่งลิงก์รีเซ็ตรหัสผ่านไปยัง ${forgotEmail} แล้ว`);
    } catch (err: unknown) {
      console.error('Forgot password error:', err);
      toast.error('เกิดข้อผิดพลาดในการส่งลิงก์รีเซ็ตรหัสผ่าน');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleBackToForm = () => {
    setStep('form');
    setOtpCode('');
    setOtpError('');
  };

  const update = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-amber-400/10 rounded-full blur-[130px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo - Minimal Luxury Editorial */}
        <div className="text-center mb-6">
          <h1 className="font-brand font-semibold text-2xl sm:text-3xl tracking-tight text-zinc-800 uppercase select-none">
            LOSTRETURN
          </h1>
          <p className="text-xs text-zinc-500 mt-1 font-normal">Smart Locker Lost & Return System</p>
        </div>

        {/* Form Card (Liquid White Glass) */}
        <div className="backdrop-blur-2xl bg-white/85 border border-zinc-200/90 rounded-3xl p-6 sm:p-8 shadow-[0_16px_48px_rgba(0,0,0,0.06)]">
          {step === 'forgot_password' ? (
            <div className="space-y-5">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center mx-auto mb-3 text-amber-600 shadow-sm">
                  <KeyRound className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-semibold text-zinc-800">รีเซ็ตรหัสผ่าน</h2>
                <p className="text-xs sm:text-sm text-zinc-500 mt-1 px-2 font-normal">
                  กรอกอีเมลของคุณเพื่อรับลิงก์สำหรับตั้งรหัสผ่านใหม่
                </p>
              </div>

              {forgotSent ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                    <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto" />
                    <p className="text-sm font-semibold text-zinc-800">
                      ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว!
                    </p>
                    <p className="text-xs text-zinc-600 font-normal">
                      เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปยัง <span className="font-semibold text-amber-700 break-all">{forgotEmail}</span> แล้ว กรุณาตรวจสอบกล่องจดหมายของคุณ
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSendForgotPassword}
                      disabled={forgotLoading}
                      className="w-full flex items-center justify-center gap-2 font-medium"
                    >
                      {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin text-amber-600" /> : <RotateCw className="w-4 h-4" />}
                      <span>Resend Link</span>
                    </Button>

                    <button
                      type="button"
                      onClick={() => {
                        setStep('form');
                        setForgotSent(false);
                      }}
                      className="w-full text-center text-xs sm:text-sm text-amber-600 font-semibold hover:underline py-2 cursor-pointer flex items-center justify-center gap-1 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Back to Sign In</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSendForgotPassword} className="space-y-4">
                  <FormField icon={<Mail className="w-4 h-4 text-zinc-400" />} label="อีเมลของคุณ">
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="pl-10"
                      required
                      autoFocus
                    />
                  </FormField>

                  <Button
                    type="submit"
                    disabled={forgotLoading || !forgotEmail.trim()}
                    className="w-full h-12 text-sm font-semibold shadow-lg shadow-amber-500/20"
                  >
                    {forgotLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
                    ) : (
                      <>
                        <span>Send Reset Link</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setStep('form')}
                      className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 font-medium hover:underline cursor-pointer transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Back to Sign In</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : step === 'otp' ? (
            <div className="space-y-6">
              {/* Header */}
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center mx-auto mb-3 text-amber-600 shadow-sm">
                  <MailCheck className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-semibold text-zinc-800">ยืนยันอีเมลของคุณ</h2>
                <p className="text-xs sm:text-sm text-zinc-500 mt-1.5 px-2 font-normal">
                  ส่งรหัส OTP 6 หลักไปที่{' '}
                  <span className="font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md break-all">
                    {formData.email}
                  </span>{' '}
                  แล้ว
                </p>
              </div>

              {/* OTP Verification Form */}
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div className="flex justify-center my-2">
                  <InputOTP
                    maxLength={6}
                    value={otpCode}
                    onChange={(val) => {
                      setOtpCode(val);
                      setOtpError('');
                    }}
                    pattern={REGEXP_ONLY_DIGITS}
                    autoFocus
                  >
                    <InputOTPGroup className="gap-2 sm:gap-2.5">
                      <InputOTPSlot index={0} className="w-11 h-13 sm:w-12 sm:h-14 text-xl font-semibold rounded-xl border-zinc-300 bg-white" />
                      <InputOTPSlot index={1} className="w-11 h-13 sm:w-12 sm:h-14 text-xl font-semibold rounded-xl border-zinc-300 bg-white" />
                      <InputOTPSlot index={2} className="w-11 h-13 sm:w-12 sm:h-14 text-xl font-semibold rounded-xl border-zinc-300 bg-white" />
                      <InputOTPSlot index={3} className="w-11 h-13 sm:w-12 sm:h-14 text-xl font-semibold rounded-xl border-zinc-300 bg-white" />
                      <InputOTPSlot index={4} className="w-11 h-13 sm:w-12 sm:h-14 text-xl font-semibold rounded-xl border-zinc-300 bg-white" />
                      <InputOTPSlot index={5} className="w-11 h-13 sm:w-12 sm:h-14 text-xl font-semibold rounded-xl border-zinc-300 bg-white" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {otpError && (
                  <div className="flex items-center justify-center gap-1.5 text-rose-600 text-xs sm:text-sm font-medium">
                    <AlertCircle className="w-4 h-4" />
                    <span>{otpError}</span>
                  </div>
                )}

                {/* Primary Button */}
                <Button
                  type="submit"
                  disabled={otpLoading || otpCode.length !== 6}
                  className="w-full h-12 font-semibold shadow-lg shadow-amber-500/20 text-sm"
                >
                  {otpLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-zinc-900" />
                  ) : (
                    <>
                      <span>Verify OTP</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>

                {/* Secondary Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs sm:text-sm">
                  <button
                    type="button"
                    onClick={handleBackToForm}
                    className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 transition-colors font-medium cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || resending}
                    className="flex items-center gap-1.5 text-amber-600 hover:underline font-semibold disabled:text-zinc-400 disabled:no-underline disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    {resending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                    ) : (
                      <RotateCw className={`w-3.5 h-3.5 ${resendCooldown > 0 ? '' : 'animate-none'}`} />
                    )}
                    <span>
                      {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend OTP'}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              {/* Segmented Pill Switcher */}
              <div className="flex gap-2 mb-6">
                <button
                  type="button"
                  disabled={isLogin}
                  onClick={() => {
                    setIsLogin(true);
                    setStep('form');
                  }}
                  className={`flex-1 py-2.5 text-xs sm:text-sm rounded-2xl transition-all ${
                    isLogin
                      ? "bg-white border border-zinc-900 text-amber-500 font-semibold shadow-sm cursor-default"
                      : "bg-transparent text-zinc-900 hover:text-amber-500 font-medium cursor-pointer"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  disabled={!isLogin}
                  onClick={() => {
                    setIsLogin(false);
                    setStep('form');
                  }}
                  className={`flex-1 py-2.5 text-xs sm:text-sm rounded-2xl transition-all ${
                    !isLogin
                      ? "bg-white border border-zinc-900 text-amber-500 font-semibold shadow-sm cursor-default"
                      : "bg-transparent text-zinc-900 hover:text-amber-500 font-medium cursor-pointer"
                  }`}
                >
                  Sign Up
                </button>
              </div>

              <AnimatePresence mode="wait">
                {isLogin ? (
                  <motion.div
                    key="login"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <p className="text-zinc-500 text-xs sm:text-sm mb-5 font-normal">
                      เข้าสู่ระบบเพื่อใช้งาน
                    </p>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <FormField icon={<Mail className="w-4 h-4 text-zinc-400" />} label="อีเมล">
                        <Input
                          type="email"
                          placeholder="email@example.com"
                          value={formData.email}
                          onChange={(e) => update("email", e.target.value)}
                          className="pl-10"
                          required
                        />
                      </FormField>

                      <div className="space-y-1">
                        <FormField icon={<Lock className="w-4 h-4 text-zinc-400" />} label="รหัสผ่าน">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={(e) => update("password", e.target.value)}
                            className="pl-10 pr-10"
                            required
                            minLength={6}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </FormField>

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setForgotEmail(formData.email);
                              setForgotSent(false);
                              setStep('forgot_password');
                            }}
                            className="text-xs font-semibold text-amber-600 hover:underline transition-all cursor-pointer"
                          >
                            Forgot Password?
                          </button>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 font-semibold shadow-lg shadow-amber-500/20 text-sm mt-2"
                      >
                        {loading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
                        ) : (
                          <>
                            <span>Sign In</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                    </form>
                  </motion.div>
                ) : (
                  <motion.div
                    key="register"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <h2 className="text-base sm:text-lg font-semibold text-zinc-800 mb-0.5">สร้างบัญชีใหม่</h2>
                    <p className="text-zinc-500 text-xs sm:text-sm mb-4 font-normal">กรอกข้อมูลเพื่อเริ่มต้นใช้งาน</p>

                    <form onSubmit={handleSubmit} className="space-y-3.5">
                      <FormField icon={<User className="w-4 h-4 text-zinc-400" />} label="ชื่อ-นามสกุล">
                        <Input
                          type="text"
                          placeholder="ชื่อ นามสกุล"
                          value={formData.fullName}
                          onChange={(e) => update("fullName", e.target.value)}
                          className="pl-10"
                          required
                        />
                      </FormField>

                      <FormField icon={<Phone className="w-4 h-4 text-zinc-400" />} label="เบอร์โทร">
                        <Input
                          type="tel"
                          placeholder="0xx-xxx-xxxx"
                          value={formData.phone}
                          onChange={(e) => update("phone", e.target.value.replace(/\D/g, '').slice(0, 10))}
                          className="pl-10"
                          required
                        />
                      </FormField>

                      <FormField icon={<Mail className="w-4 h-4 text-zinc-400" />} label="อีเมล">
                        <Input
                          type="email"
                          placeholder="email@example.com"
                          value={formData.email}
                          onChange={(e) => update("email", e.target.value)}
                          className="pl-10"
                          required
                        />
                      </FormField>

                      <FormField icon={<Lock className="w-4 h-4 text-zinc-400" />} label="รหัสผ่าน">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={formData.password}
                          onChange={(e) => update("password", e.target.value)}
                          className="pl-10 pr-10"
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </FormField>

                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 font-semibold shadow-lg shadow-amber-500/20 text-sm mt-2"
                      >
                        {loading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
                        ) : (
                          <>
                            <span>Sign Up</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        {/* Back to home */}
        <div className="text-center mt-6">
          <button
            onClick={() => router.push("/")}
            className="text-xs sm:text-sm text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer inline-flex items-center gap-1.5 font-normal"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/* ---------- small helper component ---------- */

const FormField = ({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-medium text-zinc-700">{label}</Label>
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
        {icon}
      </span>
      {children}
    </div>
  </div>
);

export default AuthPage;
