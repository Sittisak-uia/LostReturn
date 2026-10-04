'use client';
import React, { useState } from 'react';
import { Send, Trash2, Loader2, CornerDownRight } from 'lucide-react';
import { useComments, Comment } from '@/hooks/useComments';

interface CommentSectionProps {
  postId: string;
  isLoggedIn: boolean;
  currentUserId?: string;
  onLoginRequired?: () => void;
  onCommentsCountChange?: (count: number) => void;
}

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  onReply: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  isReply?: boolean;
}

const CommentItem = ({ comment, currentUserId, onReply, onDelete, isReply = false }: CommentItemProps) => {
  const [deleting, setDeleting] = useState(false);
  const isOwner = currentUserId === comment.user_id;

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(comment.id);
    setDeleting(false);
  };

  return (
    <div className={`flex gap-2.5 ${isReply ? 'ml-8 mt-2' : 'mt-3'}`}>
      <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
        {comment.profiles?.avatar_url ? (
          <img src={comment.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-semibold text-amber-700">
            {(comment.profiles?.username || comment.profiles?.full_name || 'U').charAt(0)}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="backdrop-blur-md bg-white border border-zinc-200 rounded-2xl px-3.5 py-2.5 shadow-sm">
          <p className="text-xs font-semibold text-amber-800 mb-0.5">
            {comment.profiles?.username || comment.profiles?.full_name || 'ผู้ใช้'}
          </p>
          <p className="text-xs sm:text-sm text-zinc-700 font-normal whitespace-pre-wrap leading-relaxed">{comment.content}</p>
        </div>
        <div className="flex items-center gap-3 mt-1 px-2">
          <span className="text-[10px] text-zinc-400 font-normal">
            {new Date(comment.created_at).toLocaleString('th-TH', { 
              day: 'numeric', 
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
          {!isReply && (
            <button 
              onClick={() => onReply(comment.id)}
              className="text-[11px] text-amber-700 hover:text-amber-800 font-medium transition-colors cursor-pointer"
            >
              Reply
            </button>
          )}
          {isOwner && (
            <button 
              onClick={handleDelete}
              disabled={deleting}
              className="text-[11px] text-rose-600 hover:text-rose-700 font-medium transition-colors flex items-center gap-1 cursor-pointer"
            >
              {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const CommentSection = ({ postId, isLoggedIn, currentUserId, onLoginRequired, onCommentsCountChange }: CommentSectionProps) => {
  const { comments, loading, createComment, deleteComment } = useComments(postId);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Notify parent of total comment count (including replies)
  React.useEffect(() => {
    const totalCount = comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);
    onCommentsCountChange?.(totalCount);
  }, [comments, onCommentsCountChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    if (!isLoggedIn) {
      onLoginRequired?.();
      return;
    }

    setSubmitting(true);
    await createComment(newComment.trim(), replyingTo || undefined);
    setNewComment('');
    setReplyingTo(null);
    setSubmitting(false);
  };

  const handleReply = (commentId: string) => {
    setReplyingTo(commentId);
  };

  const handleDelete = async (commentId: string) => {
    await deleteComment(commentId);
  };

  return (
    <div className="border-t border-zinc-200/80 pt-3 mt-3">
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* Comments list */}
          {comments.length > 0 && (
            <div className="space-y-1 mb-3">
              {comments.map(comment => (
                <div key={comment.id}>
                  <CommentItem 
                    comment={comment} 
                    currentUserId={currentUserId}
                    onReply={handleReply}
                    onDelete={handleDelete}
                  />
                  {/* Replies */}
                  {comment.replies && comment.replies.map(reply => (
                    <CommentItem 
                      key={reply.id} 
                      comment={reply} 
                      currentUserId={currentUserId}
                      onReply={handleReply}
                      onDelete={handleDelete}
                      isReply
                    />
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Reply indicator */}
          {replyingTo && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-t-xl text-xs text-amber-800 font-medium">
              <CornerDownRight className="w-3.5 h-3.5 text-amber-600" />
              <span>กำลังตอบกลับความคิดเห็น</span>
              <button 
                onClick={() => setReplyingTo(null)}
                className="ml-auto text-xs text-rose-600 hover:underline cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Comment input */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder={isLoggedIn ? "เขียนความคิดเห็น..." : "เข้าสู่ระบบเพื่อแสดงความคิดเห็น"}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              disabled={!isLoggedIn || submitting}
              className="flex-1 px-4 py-2 rounded-full border border-zinc-300 hover:border-zinc-400 bg-white text-zinc-900 placeholder:text-zinc-400 text-xs sm:text-sm font-normal focus:outline-none focus:ring-0 focus:shadow-none focus:border-zinc-900 disabled:opacity-50 transition-all shadow-sm"
            />
            <button
              type="submit"
              disabled={!newComment.trim() || submitting || !isLoggedIn}
              className="w-9 h-9 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-zinc-900 flex items-center justify-center disabled:opacity-40 transition-all cursor-pointer shadow-md shadow-amber-500/20 hover:shadow-amber-400/30 shrink-0 font-semibold"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
              ) : (
                <Send className="w-3.5 h-3.5 stroke-[2.2]" />
              )}
            </button>
          </form>
        </>
      )}
    </div>
  );
};
