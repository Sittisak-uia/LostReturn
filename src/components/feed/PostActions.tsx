'use client';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Edit2, Trash2, Flag, Ban, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PostActionsProps {
  postId: string;
  postUserId: string;
  currentUserId?: string;
  isAdmin?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onBlock?: () => void;
}

export const PostActions = ({ 
  postId, 
  postUserId, 
  currentUserId, 
  isAdmin = false,
  isOpen, 
  onClose, 
  onEdit, 
  onDelete, 
  onBlock 
}: PostActionsProps) => {
  const [mounted, setMounted] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen) return null;

  const isOwner = currentUserId === postUserId;

  const handleDelete = async () => {
    if (!confirm('คุณต้องการลบโพสต์นี้หรือไม่?')) return;
    
    setSubmitting(true);
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (error) {
      toast.error('ไม่สามารถลบโพสต์ได้');
    } else {
      toast.success('ลบโพสต์แล้ว');
      onDelete?.();
    }
    setSubmitting(false);
    onClose();
  };

  const handleReport = async () => {
    const finalReason = reportReason === 'อื่นๆ' ? customReason.trim() : reportReason;
    
    if (!finalReason) {
      toast.error('กรุณาระบุเหตุผล');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase
      .from('reports')
      .insert({
        reporter_id: currentUserId!,
        post_id: postId,
        reported_user_id: postUserId,
        reason: finalReason
      });

    if (error) {
      toast.error('ไม่สามารถรายงานได้');
    } else {
      toast.success('รายงานโพสต์แล้ว ขอบคุณที่แจ้งเรา');
      setShowReportModal(false);
      setReportReason('');
      setCustomReason('');
    }
    setSubmitting(false);
    onClose();
  };

  const handleBlock = async () => {
    if (!confirm('คุณต้องการบล็อกผู้ใช้นี้หรือไม่? คุณจะไม่เห็นโพสต์จากผู้ใช้นี้อีก')) return;
    
    setSubmitting(true);
    const { error } = await supabase
      .from('blocks')
      .insert({
        blocker_id: currentUserId!,
        blocked_user_id: postUserId
      });

    if (error) {
      if (error.code === '23505') {
        toast.error('คุณบล็อกผู้ใช้นี้อยู่แล้ว');
      } else {
        toast.error('ไม่สามารถบล็อกได้');
      }
    } else {
      toast.success('บล็อกผู้ใช้แล้ว');
      onBlock?.();
    }
    setSubmitting(false);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      
      {/* Menu */}
      <div className="absolute right-0 top-8 z-50 backdrop-blur-2xl bg-white border border-zinc-200 rounded-2xl shadow-xl py-1.5 min-w-[160px]">
        {isOwner ? (
          <>
            <button 
              onClick={onEdit}
              className="w-full px-4 py-2.5 text-left text-xs font-medium text-zinc-800 hover:bg-zinc-100 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Edit2 className="w-4 h-4 text-amber-600" />
              <span>Edit</span>
            </button>
            <button 
              onClick={handleDelete}
              disabled={submitting}
              className="w-full px-4 py-2.5 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-2 cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span>Delete</span>
            </button>
          </>
        ) : isAdmin ? (
          <>
            <button 
              onClick={handleDelete}
              disabled={submitting}
              className="w-full px-4 py-2.5 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-2 cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span>Delete (Admin)</span>
            </button>
          </>
        ) : (
          <>
            <button 
              onClick={() => setShowReportModal(true)}
              className="w-full px-4 py-2.5 text-left text-xs font-medium text-zinc-800 hover:bg-zinc-100 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Flag className="w-4 h-4 text-amber-600" />
              <span>Report</span>
            </button>
            <button 
              onClick={handleBlock}
              disabled={submitting}
              className="w-full px-4 py-2.5 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-2 cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
              <span>Block User</span>
            </button>
          </>
        )}
      </div>

      {/* Report Modal - Portaled to document.body */}
      {showReportModal && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowReportModal(false)} />
          <div className="relative z-10 backdrop-blur-2xl bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-zinc-200 animate-slide-up">
            <button
              type="button"
              onClick={() => setShowReportModal(false)}
              className="absolute top-4 right-4 p-1.5 hover:bg-zinc-100 rounded-full transition-colors cursor-pointer text-zinc-500 hover:text-zinc-800"
            >
              <X className="w-4 h-4" />
            </button>
            
            <h3 className="text-base sm:text-lg font-semibold text-zinc-800 mb-4">รายงานโพสต์</h3>
            
            <div className="space-y-2 mb-4">
              {['เนื้อหาไม่เหมาะสม', 'สแปมหรือโฆษณา', 'ข้อมูลเท็จ', 'อื่นๆ'].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setReportReason(reason)}
                  className={`w-full px-4 py-2.5 text-left text-xs sm:text-sm font-medium rounded-xl border transition-all cursor-pointer ${
                    reportReason === reason 
                      ? 'border-amber-400 bg-amber-50 text-amber-800 shadow-sm' 
                      : 'border-zinc-200 hover:border-zinc-300 text-zinc-700'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            {reportReason === 'อื่นๆ' && (
              <textarea
                placeholder="ระบุเหตุผล..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                maxLength={500}
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 hover:border-zinc-400 bg-white text-zinc-900 font-normal placeholder:text-zinc-400 focus:outline-none focus:ring-0 focus:shadow-none focus:border-zinc-900 resize-none mb-4 text-base md:text-sm shadow-sm transition-all"
                rows={3}
              />
            )}

            <button
              type="button"
              onClick={handleReport}
              disabled={!reportReason || (reportReason === 'อื่นๆ' && !customReason.trim()) || submitting}
              className="w-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-zinc-900 font-semibold py-3.5 rounded-xl shadow-lg shadow-amber-500/20 hover:shadow-amber-400/30 disabled:opacity-40 flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer active:scale-[0.98]"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin text-zinc-900" /> : <Flag className="w-4 h-4 stroke-[2.2]" />}
              <span>Submit Report</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
