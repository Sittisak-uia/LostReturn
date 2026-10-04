'use client';
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, KeyRound, CheckCircle, AlertCircle, ShieldQuestion, MessageSquare, Loader2, Send, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Locker, ChatMessage, VerificationResult } from "@/types/locker";
import { generateOTP } from "@/lib/locker-data";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { copyToClipboard } from "@/lib/clipboard";

interface CollectModalProps {
  locker: Locker | null;
  isOpen: boolean;
  onClose: () => void;
  onCollect: (lockerId: number) => void;
  transactionId?: string;
}

type CollectStep = 'security' | 'verifying' | 'otp' | 'chat' | 'success';

export function CollectModal({ locker, isOpen, onClose, onCollect, transactionId }: CollectModalProps) {
  const MAX_ATTEMPTS = 3;
  const { user, profile } = useAuth();
  const [step, setStep] = useState<CollectStep>('security');
  const [userAnswer, setUserAnswer] = useState('');
  const [otp, setOtp] = useState('');
  const [generatedOTP, setGeneratedOTP] = useState('');
  const [otpGeneratedAt, setOtpGeneratedAt] = useState<Date | null>(null);
  const [otpTimeLeft, setOtpTimeLeft] = useState<number>(0);
  const [error, setError] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [copied, setCopied] = useState(false);

  // Timer useEffect for Collect OTP timeout
  useEffect(() => {
    if (!otpGeneratedAt) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((new Date().getTime() - otpGeneratedAt.getTime()) / 1000);
      const remaining = 600 - elapsed;
      if (remaining <= 0) {
        setOtpTimeLeft(0);
        clearInterval(interval);
        // Timeout! Handle OTP expiration
        setGeneratedOTP('');
        setOtpGeneratedAt(null);
        setOtp('');
        setStep('security');
        setAttempts(0);
        setUserAnswer('');
        setError('รหัส OTP หมดอายุแล้ว กรุณาตอบคำถามยืนยันสิทธิ์อีกครั้ง');
        toast.error('รหัส OTP หมดอายุแล้ว กรุณาตอบคำถามยืนยันสิทธิ์อีกครั้ง');
      } else {
        setOtpTimeLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [otpGeneratedAt]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleSecuritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (attempts >= MAX_ATTEMPTS) {
      setError(`คุณตอบผิดครบ ${MAX_ATTEMPTS} ครั้งแล้ว กรุณาติดต่อผู้ฝากผ่านแชท`);
      setStep('chat');
      setChatMessages([{
        id: '1',
        sender: 'claimer',
        message: `ตอบคำถามผิดครบ ${MAX_ATTEMPTS} ครั้ง ขอความช่วยเหลือ`,
        timestamp: new Date()
      }]);
      return;
    }

    if (!userAnswer.trim()) {
      setError('กรุณากรอกคำตอบ');
      return;
    }

    if (!locker?.securityQuestion) {
      toast.error('ไม่พบคำถามลับ');
      return;
    }

    setStep('verifying');
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        toast.error('กรุณาเข้าสู่ระบบก่อนยืนยันตัวตน');
        setStep('security');
        setError('กรุณาเข้าสู่ระบบก่อนทำรายการ');
        return;
      }

      const response = await fetch('/api/verify-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userAnswer: userAnswer.trim(),
          transactionId: transactionId || undefined,
          lockerId: locker.id
        })
      });

      const data = await response.json();
      setVerificationResult(data);

      if (response.ok && data.isMatch && data.otp) {
        // Answer is correct - receive server-generated OTP
        setGeneratedOTP(data.otp);
        setOtpGeneratedAt(data.otpGeneratedAt ? new Date(data.otpGeneratedAt) : new Date());
        setStep('otp');
        toast.success('ยืนยันตัวตนสำเร็จ!');
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        
        if (newAttempts >= MAX_ATTEMPTS) {
          // Max attempts reached - force chat
          setStep('chat');
          setChatMessages([{
            id: '1',
            sender: 'claimer',
            message: `ตอบคำถามผิดครบ ${MAX_ATTEMPTS} ครั้ง ขอความช่วยเหลือ`,
            timestamp: new Date()
          }]);
          toast.error(`ตอบผิดครบ ${MAX_ATTEMPTS} ครั้ง กรุณาติดต่อผู้ฝาก`);
        } else {
          // Still have attempts left - go back to security
          setStep('security');
          setUserAnswer('');
          const reasonMsg = data?.reason || `คำตอบไม่ถูกต้อง (เหลือ ${MAX_ATTEMPTS - newAttempts} ครั้ง)`;
          setError(reasonMsg);
          toast.error(reasonMsg);
        }
      }
    } catch (err) {
      console.error('Verification error:', err);
      setStep('security');
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
      toast.error('ไม่สามารถตรวจสอบคำตอบได้');
    }
  };

  const handleOTPVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otp.length !== 6) {
      setError('กรุณากรอก OTP 6 หลัก');
      return;
    }

    if (otpGeneratedAt) {
      const elapsed = Math.floor((new Date().getTime() - otpGeneratedAt.getTime()) / 1000);
      if (elapsed >= 600) {
        setError('รหัส OTP หมดอายุแล้ว');
        toast.error('รหัส OTP หมดอายุแล้ว');
        setGeneratedOTP('');
        setOtpGeneratedAt(null);
        setOtp('');
        setStep('security');
        setAttempts(0);
        setUserAnswer('');
        return;
      }
    }

    setError('');
    setStep('verifying');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        toast.error('กรุณาเข้าสู่ระบบ');
        setStep('otp');
        return;
      }

      const collectorName = profile?.username || profile?.full_name || (user?.email ? user.email.split('@')[0] : null);
      const collectorContact = profile?.phone || user?.email || null;

      // Call secure server-side locker unlock API
      const response = await fetch('/api/locker/unlock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          lockerId: locker?.id,
          transactionId: transactionId || undefined,
          otp: otp.trim(),
          collectorName,
          collectorContact,
          action: 'collect',
          autoComplete: true
        })
      });

      const unlockResult = await response.json();

      if (!response.ok || !unlockResult.success) {
        setError(unlockResult.error || 'รหัส OTP ไม่ถูกต้อง หรือตู้ไม่พร้อมใช้งาน');
        toast.error(unlockResult.error || 'ไม่สามารถเปิดตู้ได้');
        setStep('otp');
        return;
      }

      setStep('success');
      toast.success('ตู้ล็อกเกอร์กำลังปลดล็อก...');
    } catch (err) {
      console.error('Error completing collection:', err);
      setError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      setStep('otp');
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      sender: 'claimer',
      message: newMessage.trim(),
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, message]);
    setNewMessage('');

    // Simulate depositor response
    setTimeout(() => {
      const response: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'depositor',
        message: 'ขอบคุณที่ติดต่อมา กรุณารอสักครู่นะครับ',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, response]);
    }, 1500);
  };

  const handleDepositorApprove = () => {
    // Simulate depositor approving and sending OTP
    const newOTP = generateOTP();
    setGeneratedOTP(newOTP);
    setOtpGeneratedAt(new Date());
    setStep('otp');
    toast.success('ผู้ฝากอนุมัติแล้ว! กรุณากรอก OTP');
  };

  const handleCopyOtp = async () => {
    if (!generatedOTP) return;
    const ok = await copyToClipboard(generatedOTP);
    if (ok) {
      setCopied(true);
      toast.success('คัดลอกรหัส OTP แล้ว!');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('ไม่สามารถคัดลอกได้');
    }
  };

  const handleConfirm = async () => {
    if (locker) {
      onCollect(locker.id);
      toast.success('รับของสำเร็จ!');
      handleClose();
    }
  };

  const handleClose = () => {
    setStep('security');
    setUserAnswer('');
    setOtp('');
    setGeneratedOTP('');
    setOtpGeneratedAt(null);
    setOtpTimeLeft(0);
    setError('');
    setChatMessages([]);
    setNewMessage('');
    setVerificationResult(null);
    setAttempts(0);
    onClose();
  };

  if (!locker) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[90vh] overflow-y-auto"
          >
            <Card variant="elevated" className="overflow-hidden backdrop-blur-2xl bg-white/95 border-zinc-200 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.1)]">
              <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-100 pb-4 px-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 shadow-sm">
                    {step === 'security' || step === 'verifying' ? (
                      <ShieldQuestion className="w-5 h-5" />
                    ) : step === 'chat' ? (
                      <MessageSquare className="w-5 h-5 text-amber-600" />
                    ) : (
                      <KeyRound className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold text-zinc-800">
                      {step === 'security' || step === 'verifying' ? 'ยืนยันความเป็นเจ้าของ' : 
                       step === 'chat' ? 'ติดต่อผู้ฝาก' :
                       step === 'otp' ? 'กรอก OTP' : 'สำเร็จ'} — ช่อง {String(locker.id).padStart(2, '0')}
                    </CardTitle>
                    <p className="text-xs text-zinc-500 font-normal">Smart Locker Claim</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8 text-zinc-500 hover:text-zinc-800 rounded-full">
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>
              
              <CardContent className="pt-5 px-6">
                {/* Security Question Step */}
                {step === 'security' && (
                  <form onSubmit={handleSecuritySubmit} className="space-y-5">
                    <div className="text-center p-3 rounded-2xl bg-zinc-50 border border-zinc-200">
                      <p className="text-xs text-zinc-600 font-normal">
                        สิ่งของในช่อง: <span className="font-medium text-zinc-800">{locker.itemDescription || 'ทรัพย์สิน'}</span>
                      </p>
                    </div>

                    {locker.securityQuestion ? (
                      <>
                        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                          <p className="text-xs font-semibold text-amber-800 mb-1">คำถามยืนยัน:</p>
                          <p className="text-sm font-medium text-zinc-800">{locker.securityQuestion.question}</p>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="answer" className="text-xs font-medium text-zinc-700">คำตอบของคุณ</Label>
                          <Input
                            id="answer"
                            placeholder="พิมพ์คำตอบ..."
                            value={userAnswer}
                            onChange={(e) => {
                              setUserAnswer(e.target.value);
                              setError('');
                            }}
                            autoFocus
                          />
                          {error && (
                            <div className="flex items-center gap-1.5 text-rose-600 text-xs mt-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>{error}</span>
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-zinc-500 text-center font-normal">
                          โอกาสตอบคำถาม: {MAX_ATTEMPTS - attempts}/{MAX_ATTEMPTS} ครั้ง
                        </p>

                        <Button type="submit" className="w-full h-12 font-semibold shadow-lg shadow-amber-500/20 text-sm" disabled={attempts >= MAX_ATTEMPTS}>
                          ยืนยันคำตอบ
                        </Button>
                      </>
                    ) : (
                      <div className="text-center py-4 space-y-3">
                        <p className="text-sm text-zinc-500 font-normal">ไม่มีคำถามลับสำหรับช่องนี้</p>
                        <Button onClick={() => setStep('otp')} className="w-full h-12 font-semibold">
                          Enter OTP Directly
                        </Button>
                      </div>
                    )}
                  </form>
                )}

                {/* Verifying Step */}
                {step === 'verifying' && (
                  <div className="text-center py-8 space-y-4">
                    <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto" />
                    <p className="text-sm text-zinc-600 font-medium">กำลังตรวจสอบคำตอบด้วย AI...</p>
                  </div>
                )}

                {/* OTP Step */}
                {step === 'otp' && (
                  <form onSubmit={handleOTPVerify} className="space-y-5">
                    <div className="text-center p-5 rounded-3xl bg-amber-50 border border-amber-200 space-y-2">
                      <div className="p-3 rounded-2xl bg-amber-100/70 inline-flex shadow-sm">
                        <KeyRound className="w-7 h-7 text-amber-600" />
                      </div>
                      <p className="text-xs text-zinc-500 font-normal">OTP ของคุณคือ:</p>
                      <div className="text-2xl sm:text-3xl font-bold tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-700">
                        {generatedOTP}
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyOtp}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-amber-200 text-xs text-amber-800 font-medium transition-all cursor-pointer mt-1 shadow-sm hover:bg-amber-50"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-amber-600" />}
                        <span>{copied ? 'Copied!' : 'Copy OTP'}</span>
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="otp" className="text-xs font-medium text-zinc-700">กรอกรหัส OTP เพื่อยืนยัน</Label>
                      <Input
                        id="otp"
                        placeholder="••••••"
                        value={otp}
                        onChange={(e) => {
                          setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                          setError('');
                        }}
                        className="text-center text-2xl tracking-[0.3em] font-mono h-14 font-semibold text-zinc-800"
                        maxLength={6}
                        autoFocus
                      />
                      {error && (
                        <div className="flex items-center gap-1.5 text-rose-600 text-xs mt-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{error}</span>
                        </div>
                      )}
                    </div>

                    <Button type="submit" className="w-full h-12 font-semibold shadow-lg shadow-amber-500/20 text-sm">
                      Verify OTP
                    </Button>
                    <p className="text-xs text-rose-600 font-medium text-center">
                      รหัสจะหมดอายุใน {formatTime(otpTimeLeft)} นาที
                    </p>
                  </form>
                )}

                {/* Chat Step */}
                {step === 'chat' && (
                  <div className="space-y-4">
                    <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200">
                      <p className="text-xs text-rose-700">
                        ❌ คำตอบไม่ตรงกับที่บันทึกไว้ 
                        {verificationResult?.reason && (
                          <span className="block text-zinc-500 mt-1 font-normal">({verificationResult.reason})</span>
                        )}
                      </p>
                    </div>

                    <p className="text-xs text-zinc-500 font-normal">
                      กรุณาติดต่อผู้ฝากเพื่อยืนยันตัวตน เมื่อผู้ฝากอนุมัติจะส่ง OTP ให้คุณ
                    </p>

                    <ScrollArea className="h-44 border border-zinc-200 rounded-2xl p-3 bg-zinc-50">
                      <div className="space-y-2.5">
                        {chatMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.sender === 'claimer' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                                msg.sender === 'claimer'
                                   ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-zinc-900 font-medium'
                                   : 'bg-white border border-zinc-200 text-zinc-800 font-normal shadow-sm'
                              }`}
                            >
                              {msg.message}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    <form onSubmit={handleSendMessage} className="flex gap-2">
                      <Input
                        placeholder="พิมพ์ข้อความ..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="flex-1"
                      />
                      <Button type="submit" size="icon" className="h-11 w-11 shrink-0">
                        <Send className="w-4 h-4" />
                      </Button>
                    </form>

                    {/* Simulate depositor approval button */}
                    <Button 
                      onClick={handleDepositorApprove} 
                      variant="outline" 
                      className="w-full text-xs font-medium"
                    >
                      🎭 Simulate: Approve & Send OTP
                    </Button>
                  </div>
                )}

                {/* Success Step */}
                {step === 'success' && (
                  <div className="text-center space-y-5 py-4">
                    <div className="p-4 rounded-3xl bg-emerald-50 border border-emerald-200 inline-block shadow-sm">
                      <CheckCircle className="w-12 h-12 text-emerald-600" />
                    </div>
                    
                    <div>
                      <p className="text-xl font-semibold text-zinc-800 mb-1">ยืนยันสำเร็จ!</p>
                      <p className="text-xs sm:text-sm text-zinc-500 font-normal">
                        ตู้ช่อง {String(locker.id).padStart(2, '0')} กำลังปลดล็อก...
                      </p>
                    </div>

                    <Button onClick={handleConfirm} className="w-full h-12 font-semibold text-sm shadow-lg shadow-amber-500/20">
                      Done
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
