'use client';

import { useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Package, Upload, Shield, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Locker } from "@/types/locker";
import { mockLockers } from "@/lib/locker-data";
import { useLockerTransactions } from "@/hooks/useLockerTransactions";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const DepositModePage = () => {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { transactions, fetchTransactions, getTransactionByLocker } = useLockerTransactions();
  
  const [selectedLocker, setSelectedLocker] = useState<Locker | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [itemDescription, setItemDescription] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lockers = useMemo(() => {
    return mockLockers.map(locker => {
      const transaction = getTransactionByLocker(locker.id);
      if (transaction) {
        return { ...locker, status: 'occupied' as const, itemDescription: transaction.item_description, imageUrl: transaction.image_url || undefined };
      }
      return { ...locker, status: 'empty' as const };
    });
  }, [transactions, getTransactionByLocker]);

  const handleLockerSelect = (locker: Locker) => {
    if (locker.status === 'empty') setSelectedLocker(locker);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => { setImagePreview(e.target?.result as string); };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setSelectedLocker(null);
    setImageFile(null);
    setImagePreview(null);
    setItemDescription("");
    setSecurityQuestion("");
    setSecurityAnswer("");
  };

  const handleSubmit = async () => {
    if (!selectedLocker || !itemDescription.trim()) { toast.error("กรุณากรอกข้อมูลให้ครบ"); return; }
    if (!securityQuestion.trim() || !securityAnswer.trim()) { toast.error("กรุณาตั้งคำถามยืนยันตัวตน"); return; }
    setIsSubmitting(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `locker-${selectedLocker.id}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('locker-items').upload(filePath, imageFile);
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('locker-items').getPublicUrl(filePath);
          imageUrl = publicUrl;
        }
      }
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const { data: insertedTx, error } = await supabase.from('locker_transactions').insert({
        locker_id: selectedLocker.id,
        item_description: itemDescription.trim(),
        depositor_name: profile?.username || profile?.full_name || user?.email?.split('@')[0] || 'ไม่ระบุ',
        depositor_contact: profile?.phone || user?.email || '',
        security_question: securityQuestion.trim(),
        security_answer: securityAnswer.trim().toLowerCase(),
        otp: otp,
        image_url: imageUrl,
        status: 'deposited',
        user_id: user?.id || null
      }).select('id').single();
      if (error) throw error;

      // Unlock locker for deposit via server API
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        fetch('/api/locker/unlock', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            lockerId: selectedLocker.id,
            transactionId: insertedTx?.id,
            action: 'deposit'
          })
        }).catch(console.error);
      }

      toast.success(
        <div className="space-y-2">
          <p className="font-semibold">ฝากของสำเร็จ! ตู้กำลังเปิด...</p>
          <p className="text-sm">ตู้หมายเลข #{String(selectedLocker.id).padStart(2, '0')}</p>
        </div>,
        { duration: 5000 }
      );
      fetchTransactions();
      resetForm();
    } catch (error) {
      toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!selectedLocker) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-base font-bold text-foreground">LostReturn System</h1>
              </div>
            </div>
          </div>
        </header>

        <button onClick={() => router.push('/')} className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
          <span>กลับไปหน้าหลัก</span>
        </button>

        <main className="px-4 pb-8">
          <div className="mb-3">
            <h2 className="text-lg font-bold text-foreground">เลือกตู้ล็อกเกอร์</h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {lockers.map((locker, index) => (
              <motion.button
                key={locker.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => handleLockerSelect(locker)}
                disabled={locker.status !== 'empty'}
                className={cn(
                  "relative p-3 rounded-xl border-2 transition-all",
                  "flex flex-col items-center justify-center aspect-square",
                  locker.status === 'empty' && "bg-primary/5 border-primary/30 hover:border-primary active:scale-95",
                  locker.status === 'occupied' && "bg-warning/5 border-warning/30 opacity-50 cursor-not-allowed"
                )}
              >
                <span className={cn("text-2xl font-bold", locker.status === 'empty' ? "text-primary" : "text-warning")}>
                  {String(locker.id).padStart(2, '0')}
                </span>
                <span className={cn("text-[10px] font-medium mt-1", locker.status === 'empty' ? "text-primary" : "text-warning")}>
                  {locker.status === 'empty' ? 'ว่าง' : 'มีของ'}
                </span>
              </motion.button>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      <header className="shrink-0 bg-gradient-to-r from-primary/10 to-primary/5 border-b border-primary/20">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Package className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground">LostReturn System</h1>
            </div>
          </div>
        </div>
      </header>

      <button onClick={resetForm} className="flex items-center gap-1 px-3 py-1.5 text-[11px] text-primary shrink-0">
        <ArrowLeft className="w-3 h-3" />
        <span>กลับไปหน้าหลัก</span>
      </button>

      <main className="flex-1 px-3 flex flex-col min-h-0">
        <div className="flex-1 bg-gradient-to-b from-primary/5 to-primary/10 rounded-xl p-3 border border-primary/20 flex flex-col">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <div>
              <h2 className="text-sm font-bold text-foreground">ฝากของ</h2>
              <p className="text-[10px] text-muted-foreground">ตู้หมายเลข #{String(selectedLocker.id).padStart(2, '0')}</p>
            </div>
            <div className="p-1.5 rounded-lg bg-primary/20">
              <Package className="w-4 h-4 text-primary" />
            </div>
          </div>

          <div className="mb-2 shrink-0">
            <label className="block text-[10px] font-medium text-foreground mb-1">1. อัปโหลดรูปสิ่งของ</label>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" onChange={handleImageUpload} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "w-full py-3 rounded-lg border-2 border-dashed transition-all",
                "flex flex-col items-center justify-center",
                imagePreview ? "border-primary/50 bg-background" : "border-primary/30 hover:border-primary/50 bg-background"
              )}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-12 h-12 object-cover rounded-md" />
              ) : (
                <>
                  <Upload className="w-4 h-4 text-primary/70 mb-0.5" />
                  <span className="text-[10px] text-muted-foreground">แตะเพื่อเลือกรูป</span>
                </>
              )}
            </button>
          </div>

          <div className="mb-2 shrink-0">
            <label className="block text-[10px] font-medium text-foreground mb-1">2. สิ่งที่พบ</label>
            <Input
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              placeholder="เช่น กุญแจรถ"
              className="bg-background border-primary/20 h-8 text-xs rounded-lg"
            />
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 mb-2 shrink-0">
              <div className="p-1 rounded-md bg-primary/20">
                <Shield className="w-3 h-3 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-foreground">คำถามยืนยัน</p>
                <p className="text-[8px] text-muted-foreground">ตั้งคำถามที่เจ้าของตัวจริงเท่านั้นที่รู้</p>
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-2 min-h-0">
              <div className="shrink-0">
                <label className="block text-[9px] font-medium text-muted-foreground mb-0.5">คำถาม</label>
                <Input
                  value={securityQuestion}
                  onChange={(e) => setSecurityQuestion(e.target.value)}
                  placeholder="เช่น รุ่นอะไร"
                  className="bg-background border-primary/20 h-8 text-xs rounded-lg"
                />
              </div>
              <div className="shrink-0">
                <label className="block text-[9px] font-medium text-muted-foreground mb-0.5">คำตอบ</label>
                <Input
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  placeholder="คำตอบที่ถูกต้อง"
                  className="bg-background border-primary/20 h-8 text-xs rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      <div className="shrink-0 px-3 py-2 bg-background">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !itemDescription.trim()}
          className="w-full h-10 text-sm font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {isSubmitting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />กำลังบันทึก...</>
          ) : (
            "เปิดตู้ล๊อกเกอร์"
          )}
        </Button>
      </div>
    </div>
  );
};

export default DepositModePage;
