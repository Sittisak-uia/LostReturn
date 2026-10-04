'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ImagePlus, Loader2, AlertCircle, Package, Trash2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
  onSubmit?: (data: { post_type: 'lost' | 'found'; title: string; content: string; image_url?: string }) => Promise<unknown>;
  currentUserId?: string;
  userName?: string;
}

export const CreatePostModal = ({ 
  isOpen, 
  onClose, 
  onPostCreated,
  onSubmit,
  currentUserId,
}: CreatePostModalProps) => {
  const [mounted, setMounted] = useState(false);
  const [postType, setPostType] = useState<'lost' | 'found'>('lost');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('กรุณาเลือกไฟล์รูปภาพ');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('ขนาดรูปภาพต้องไม่เกิน 5MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `post-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from('post-images')
        .getPublicUrl(filePath);

      setImageUrl(publicUrlData.publicUrl);
    } catch {
      toast.error('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast.error('กรุณาระบุรายละเอียด');
      return;
    }

    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit({
          post_type: postType,
          title: content.slice(0, 50),
          content: content,
          image_url: imageUrl || undefined
        });
        toast.success('สร้างโพสต์สำเร็จ!');
        setContent('');
        setImageUrl(null);
        onPostCreated?.();
        onClose();
      } else {
        const { error } = await supabase
          .from('posts')
          .insert({
            user_id: currentUserId || '00000000-0000-0000-0000-000000000000',
            title: content.slice(0, 50),
            content: content,
            post_type: postType,
            image_url: imageUrl,
            location: 'จุดรับฝาก'
          });

        if (error) {
          toast.error('สร้างโพสต์ไม่สำเร็จ');
        } else {
          toast.success('สร้างโพสต์สำเร็จ!');
          setContent('');
          setImageUrl(null);
          onPostCreated?.();
          onClose();
        }
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการสร้างโพสต์');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative z-10 w-full sm:max-w-lg backdrop-blur-2xl bg-white border border-zinc-200 rounded-t-3xl sm:rounded-3xl max-h-[85vh] sm:max-h-[88vh] flex flex-col overflow-hidden shadow-2xl animate-slide-up">
        <div className="flex-none shrink-0 flex items-center justify-between p-4 sm:p-5 border-b border-zinc-100 bg-white">
          <h2 className="text-base sm:text-lg font-semibold text-zinc-800">สร้างโพสต์ใหม่</h2>
          <button type="button" onClick={onClose} className="p-1.5 sm:p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-500 hover:text-zinc-800 cursor-pointer">
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        <form id="create-post-form" onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
          <div className="flex gap-2 p-1 bg-zinc-100 border border-zinc-200 rounded-2xl">
            <button
              type="button"
              onClick={() => setPostType('lost')}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                postType === 'lost' ? 'border border-rose-300 bg-rose-50 text-rose-700 shadow-sm' : 'text-zinc-600 hover:text-zinc-800'
              }`}
            >
              <AlertCircle className="w-4 h-4" />
              ของหาย
            </button>
            <button
              type="button"
              onClick={() => setPostType('found')}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                postType === 'found' ? 'border border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm' : 'text-zinc-600 hover:text-zinc-800'
              }`}
            >
              <Package className="w-4 h-4" />
              เจอของ
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-700">
              รายละเอียด <span className="text-rose-500">*</span>
            </label>
            <textarea
              placeholder={postType === 'lost' ? 'อธิบายลักษณะของที่หาย...' : 'อธิบายลักษณะของที่เจอ...'}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-zinc-300 hover:border-zinc-400 bg-white text-zinc-900 font-normal placeholder:text-zinc-400 text-base md:text-sm focus:outline-none focus:ring-0 focus:shadow-none focus:border-zinc-900 transition-all resize-none shadow-sm"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-700">รูปภาพ</label>
            {imageUrl ? (
              <div className="relative rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-900/[0.03] shadow-sm flex items-center justify-center">
                <img src={imageUrl} alt="Preview" className="w-full max-h-72 sm:max-h-80 object-contain rounded-2xl" />
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
                  className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-full shadow-lg cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full py-6 border-2 border-dashed border-zinc-300 rounded-2xl hover:border-zinc-900 bg-zinc-50 transition-all flex flex-col items-center gap-2 text-zinc-500 hover:text-zinc-900 cursor-pointer font-normal group"
              >
                {uploading ? <Loader2 className="w-6 h-6 animate-spin text-zinc-800" /> : <ImagePlus className="w-6 h-6 text-zinc-500 group-hover:text-zinc-900 transition-colors" />}
                <span className="text-xs font-medium">{uploading ? 'กำลังอัปโหลด...' : 'เพิ่มรูปภาพ'}</span>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </div>
        </form>

        <div className="flex-none shrink-0 p-4 sm:p-5 border-t border-zinc-100 bg-white">
          <button
            type="submit"
            form="create-post-form"
            onClick={handleSubmit}
            disabled={!content.trim() || isSubmitting}
            className="w-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-zinc-900 font-semibold py-3.5 rounded-xl shadow-lg shadow-amber-500/20 hover:shadow-amber-400/30 disabled:opacity-40 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer active:scale-[0.98]"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-zinc-900" /> : <Send className="w-4 h-4 stroke-[2.2]" />}
            <span>{isSubmitting ? 'กำลังโพสต์...' : 'Post'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
