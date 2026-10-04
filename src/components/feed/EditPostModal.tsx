'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ImagePlus, Loader2, AlertCircle, Package, Trash2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EditPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: {
    id: string;
    post_type: 'lost' | 'found' | 'locker';
    title: string;
    content: string;
    image_url: string | null;
  };
  onUpdate: () => void;
}

export const EditPostModal = ({ 
  isOpen, 
  onClose, 
  post, 
  onUpdate 
}: EditPostModalProps) => {
  const [mounted, setMounted] = useState(false);
  const [postType, setPostType] = useState<'lost' | 'found'>(
    post.post_type === 'found' ? 'found' : 'lost'
  );
  const [content, setContent] = useState(post.content);
  const [imageUrl, setImageUrl] = useState<string | null>(post.image_url);
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
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
      const filePath = `post-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(filePath, file);

      if (uploadError) {
        toast.error('อัปโหลดรูปภาพไม่สำเร็จ');
        return;
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
      const { error } = await supabase
        .from('posts')
        .update({
          title: content.slice(0, 50),
          content: content,
          post_type: postType,
          image_url: imageUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', post.id);

      if (error) {
        toast.error('แก้ไขโพสต์ไม่สำเร็จ');
      } else {
        toast.success('แก้ไขโพสต์สำเร็จ!');
        onUpdate();
        onClose();
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการแก้ไขโพสต์');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative z-10 w-full sm:max-w-lg backdrop-blur-2xl bg-white border border-zinc-200 rounded-t-3xl sm:rounded-3xl max-h-[85vh] sm:max-h-[88vh] flex flex-col overflow-hidden shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex-none shrink-0 flex items-center justify-between p-4 sm:p-5 border-b border-zinc-100 bg-white">
          <h2 className="text-base sm:text-lg font-semibold text-zinc-800">แก้ไขโพสต์</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-500 hover:text-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Content */}
        <form id="edit-post-form" onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Post Type Toggle */}
          <div className="flex gap-2 p-1 bg-zinc-100 border border-zinc-200 rounded-2xl">
            <button
              type="button"
              onClick={() => setPostType('lost')}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                postType === 'lost' 
                  ? 'border border-rose-300 bg-rose-50 text-rose-700 shadow-sm' 
                  : 'text-zinc-600 hover:text-zinc-800'
              }`}
            >
              <AlertCircle className="w-4 h-4" />
              ของหาย
            </button>
            <button
              type="button"
              onClick={() => setPostType('found')}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                postType === 'found' 
                  ? 'border border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm' 
                  : 'text-zinc-600 hover:text-zinc-800'
              }`}
            >
              <Package className="w-4 h-4" />
              เจอของ
            </button>
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-700">
              รายละเอียด <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-zinc-300 hover:border-zinc-400 bg-white text-zinc-900 font-normal placeholder:text-zinc-400 text-base md:text-sm focus:outline-none focus:ring-0 focus:shadow-none focus:border-zinc-900 transition-all resize-none shadow-sm"
              required
            />
          </div>

          {/* Image Upload */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-700">
              รูปภาพ
            </label>
            
            {imageUrl ? (
              <div className="relative rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-900/[0.03] shadow-sm flex items-center justify-center">
                <img src={imageUrl} alt="Preview" className="w-full max-h-72 sm:max-h-80 object-contain rounded-2xl" />
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
                  className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-full hover:bg-rose-600 transition-colors shadow-lg cursor-pointer"
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
                {uploading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-zinc-800" />
                ) : (
                  <ImagePlus className="w-6 h-6 text-zinc-500 group-hover:text-zinc-900 transition-colors" />
                )}
                <span className="text-xs font-medium">{uploading ? 'กำลังอัปโหลด...' : 'คลิกเพื่อเลือกรูปภาพ'}</span>
              </button>
            )}
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex-none shrink-0 p-4 sm:p-5 border-t border-zinc-100 bg-white">
          <button
            type="submit"
            form="edit-post-form"
            onClick={handleSubmit}
            disabled={!content.trim() || isSubmitting}
            className="w-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-zinc-900 font-semibold py-3.5 rounded-xl shadow-lg shadow-amber-500/20 hover:shadow-amber-400/30 disabled:opacity-40 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer active:scale-[0.98]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
                <span>กำลังบันทึก...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 stroke-[2.2]" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
