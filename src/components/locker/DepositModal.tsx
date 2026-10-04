'use client';
import { useState } from "react";
import { X, Package, ShieldQuestion, ArrowRight, ChevronLeft, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Locker } from "@/types/locker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface DepositModalProps {
  locker: Locker | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (lockerId: number, data: { itemDescription: string; depositorName: string; depositorContact: string }) => void;
}

export function DepositModal({ locker, isOpen, onClose, onSuccess }: DepositModalProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'form' | 'security'>('form');
  const [formData, setFormData] = useState({
    itemDescription: '',
    depositorName: '',
    depositorContact: '',
    securityQuestion: {
      question: '',
      answer: '',
    },
  });

  if (!isOpen || !locker) return null;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.itemDescription || !formData.depositorName || !formData.depositorContact) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    setStep('security');
  };

  const handleSecuritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.securityQuestion.question || !formData.securityQuestion.answer) {
      toast.error('กรุณากรอกคำถามและคำตอบลับ');
      return;
    }

    try {
      const { error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: user?.id || '00000000-0000-0000-0000-000000000000',
          title: `พบสิ่งของ: ${formData.itemDescription}`,
          content: `ฝากไว้ที่ตู้ล็อกเกอร์ ช่อง ${String(locker.id).padStart(2, '0')}\nผู้ฝาก: ${formData.depositorName}`,
          post_type: 'found',
          location: `ตู้ล็อกเกอร์ #${String(locker.id).padStart(2, '0')}`,
        });

      if (postError) {
        console.warn('Could not create feed post:', postError.message);
      }
    } catch {
      // Ignore post error
    }

    onSuccess(locker.id, formData);
    toast.success(`ฝากของลงตู้ ${String(locker.id).padStart(2, '0')} สำเร็จ!`);
    handleClose();
  };

  const handleClose = () => {
    setStep('form');
    setFormData({
      itemDescription: '',
      depositorName: '',
      depositorContact: '',
      securityQuestion: { question: '', answer: '' },
    });
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={handleClose}
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md max-h-[90vh] overflow-y-auto relative z-10"
        >
          <Card variant="elevated" className="overflow-hidden backdrop-blur-2xl bg-white/95 border-zinc-200 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.1)]">
            <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-100 pb-4 px-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 shadow-sm">
                  {step === 'security' ? (
                    <ShieldQuestion className="w-5 h-5" />
                  ) : (
                    <Package className="w-5 h-5 stroke-[2]" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-zinc-800">
                    {step === 'security' ? 'ตั้งคำถามลับ' : 'ฝากของ'} — ช่อง {String(locker.id).padStart(2, '0')}
                  </CardTitle>
                  <p className="text-xs text-zinc-500 font-normal">Smart Locker Lost & Return</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8 text-zinc-500 hover:text-zinc-800 rounded-full">
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            
            <CardContent className="pt-5 px-6">
              {step === 'form' && (
                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="itemDescription" className="text-xs font-medium text-zinc-700">
                      รายละเอียดสิ่งของ
                    </Label>
                    <Textarea
                      id="itemDescription"
                      placeholder="เช่น กระเป๋าสตางค์สีดำ, โทรศัพท์มือถือ..."
                      value={formData.itemDescription}
                      onChange={(e) => setFormData(prev => ({ ...prev, itemDescription: e.target.value }))}
                      className="min-h-[85px] bg-white border-zinc-300 hover:border-zinc-400 text-zinc-900 font-normal placeholder:text-zinc-400 focus:outline-none focus:ring-0 focus:shadow-none focus:border-zinc-900 shadow-sm rounded-xl"
                      required
                      autoFocus
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="depositorName" className="text-xs font-medium text-zinc-700">
                      ชื่อผู้ฝาก
                    </Label>
                    <Input
                      id="depositorName"
                      placeholder="ชื่อ-นามสกุล"
                      value={formData.depositorName}
                      onChange={(e) => setFormData(prev => ({ ...prev, depositorName: e.target.value }))}
                      required
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="depositorContact" className="text-xs font-medium text-zinc-700">
                      เบอร์โทร / Email
                    </Label>
                    <Input
                      id="depositorContact"
                      placeholder="08x-xxx-xxxx หรือ email@example.com"
                      value={formData.depositorContact}
                      onChange={(e) => setFormData(prev => ({ ...prev, depositorContact: e.target.value }))}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full h-12 text-sm font-semibold shadow-lg shadow-amber-500/20 mt-2">
                    <span>Next</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </form>
              )}

              {step === 'security' && (
                <form onSubmit={handleSecuritySubmit} className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
                    <p className="text-xs text-zinc-700 leading-relaxed font-normal">
                      <strong className="text-amber-800 font-semibold">💡 คำถามลับ:</strong> ช่วยยืนยันความเป็นเจ้าของ เพื่อให้ผู้รับของได้รหัส OTP ทันทีโดยไม่ต้องรอติดต่อคุณ
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="securityQuestion" className="text-xs font-medium text-zinc-700">
                      คำถามลับ
                    </Label>
                    <Textarea
                      id="securityQuestion"
                      placeholder="เช่น บัตรใบหน้าสุดในกระเป๋าคือบัตรอะไร? หรือ กระเป๋ามีตำหนิตรงไหน?"
                      value={formData.securityQuestion.question}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        securityQuestion: { ...prev.securityQuestion, question: e.target.value }
                      }))}
                      className="min-h-[80px] bg-white border-zinc-300 hover:border-zinc-400 text-zinc-900 font-normal placeholder:text-zinc-400 focus:outline-none focus:ring-0 focus:shadow-none focus:border-zinc-900 shadow-sm rounded-xl"
                      required
                      autoFocus
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="securityAnswer" className="text-xs font-medium text-zinc-700">
                      คำตอบ (ระบบ AI จะตรวจจับคีย์เวิร์ด)
                    </Label>
                    <Input
                      id="securityAnswer"
                      placeholder="เช่น บัตรประชาชน, มีรอยขีดที่มุมขวา"
                      value={formData.securityQuestion.answer}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        securityQuestion: { ...prev.securityQuestion, answer: e.target.value }
                      }))}
                      required
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={() => setStep('form')} className="flex-1 h-12 font-medium">
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      <span>Back</span>
                    </Button>
                    <Button type="submit" className="flex-1 h-12 font-semibold shadow-lg shadow-amber-500/20">
                      <CheckCircle2 className="w-4 h-4 mr-1.5" />
                      <span>Confirm Deposit</span>
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
