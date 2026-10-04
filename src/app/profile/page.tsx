'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Loader2, Camera, Save, History, LogOut, User, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';

const ProfilePage = () => {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOut, updateProfile, refreshProfile } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin(user?.id);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    phone: ''
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        username: profile.username || '',
        full_name: profile.full_name || '',
        phone: profile.phone || ''
      });
    }
  }, [profile]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) { toast.error('กรุณาเลือกไฟล์รูปภาพ'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('ไฟล์ใหญ่เกินไป (สูงสุด 5MB)'); return; }
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      // Append timestamp to ensure a unique URL and prevent aggressive browser & CDN caching of old avatars
      const fileName = `avatars/${user.id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('post-images').upload(fileName, file, { upsert: true });
      if (uploadError) { 
        toast.error('ไม่สามารถอัปโหลดรูปภาพได้: ' + (uploadError.message || '')); 
        return; 
      }
      const { data: { publicUrl } } = supabase.storage.from('post-images').getPublicUrl(fileName);
      await updateProfile({ avatar_url: publicUrl });
      await refreshProfile?.();
      toast.success('เปลี่ยนรูปโปรไฟล์สำเร็จ!');
    } catch {
      toast.error('เกิดข้อผิดพลาดในการอัปโหลด');
    } finally {
      setUploading(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile({ 
        username: formData.username.trim(), 
        full_name: formData.full_name.trim(), 
        phone: formData.phone.trim() 
      });
      await refreshProfile?.();
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-2xl border-b border-zinc-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/')} className="p-2 hover:bg-zinc-100 rounded-full transition-colors cursor-pointer text-zinc-700">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base sm:text-lg font-semibold text-zinc-800 tracking-tight">โปรไฟล์</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        <div className="flex flex-col items-center py-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-amber-50 border-2 border-amber-300 flex items-center justify-center overflow-hidden shadow-md">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-amber-600" />
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-zinc-900 flex items-center justify-center shadow-lg hover:scale-105 transition-transform cursor-pointer"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin text-zinc-900" /> : <Camera className="w-4 h-4" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
          </div>
          <h2 className="mt-4 text-lg sm:text-xl font-semibold text-zinc-800">{profile?.username || profile?.full_name || 'ผู้ใช้'}</h2>
          <p className="text-xs sm:text-sm text-zinc-500 font-normal">{user.email}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 backdrop-blur-2xl bg-white/85 rounded-3xl p-6 border border-zinc-200 shadow-sm">
          <h3 className="font-semibold text-sm text-zinc-800 mb-3">ข้อมูลส่วนตัว</h3>
          {[
            { label: 'ชื่อผู้ใช้', field: 'username', placeholder: 'ชื่อผู้ใช้', type: 'text' },
            { label: 'ชื่อ-นามสกุล', field: 'full_name', placeholder: 'ชื่อ-นามสกุล', type: 'text' },
            { label: 'เบอร์โทรศัพท์', field: 'phone', placeholder: 'เบอร์โทรศัพท์', type: 'tel' },
          ].map(({ label, field, placeholder, type }) => (
            <div key={field} className="space-y-1">
              <label className="block text-xs font-medium text-zinc-700">{label}</label>
              <input
                type={type}
                value={formData[field as keyof typeof formData]}
                onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 hover:border-zinc-400 bg-white text-zinc-900 font-normal placeholder:text-zinc-400 focus:outline-none focus:ring-0 focus:shadow-none focus:border-zinc-900 text-xs sm:text-sm shadow-sm transition-all"
                placeholder={placeholder}
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-zinc-900 font-semibold py-3.5 rounded-xl shadow-lg shadow-amber-500/20 hover:shadow-amber-400/30 disabled:opacity-50 flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer active:scale-[0.98] mt-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-zinc-900" /> : <><Save className="w-4 h-4" /><span>Save Changes</span></>}
          </button>
        </form>

        <div className="space-y-3">
          <button onClick={() => router.push('/my-posts')} className="w-full flex items-center gap-3.5 px-4 py-3.5 backdrop-blur-xl bg-white rounded-2xl border border-zinc-200 hover:border-amber-300 transition-colors cursor-pointer text-left shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <History className="w-5 h-5" />
            </div>
            <p className="font-medium text-xs sm:text-sm text-zinc-800">ประวัติการโพสต์</p>
            <ChevronLeft className="w-4 h-4 text-zinc-400 ml-auto rotate-180" />
          </button>

          {!adminLoading && !isAdmin && (
            <button onClick={() => router.push('/contact-admin?from=profile')} className="w-full flex items-center gap-3.5 px-4 py-3.5 backdrop-blur-xl bg-white rounded-2xl border border-zinc-200 hover:border-amber-300 transition-colors cursor-pointer text-left shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <MessageSquare className="w-5 h-5" />
              </div>
              <p className="font-medium text-xs sm:text-sm text-zinc-800">ติดต่อ Admin</p>
              <ChevronLeft className="w-4 h-4 text-zinc-400 ml-auto rotate-180" />
            </button>
          )}

          <button onClick={handleSignOut} className="w-full flex items-center gap-3.5 px-4 py-3.5 bg-rose-50 rounded-2xl border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer text-left">
            <div className="w-10 h-10 rounded-xl bg-rose-100/80 flex items-center justify-center text-rose-600">
              <LogOut className="w-5 h-5" />
            </div>
            <p className="font-medium text-xs sm:text-sm text-rose-700">Sign Out</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
