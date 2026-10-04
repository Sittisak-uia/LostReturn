'use client';
import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, MoreHorizontal, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { PostActions } from './PostActions';
import { CommentSection } from './CommentSection';
import { EditPostModal } from './EditPostModal';
import { getTimeAgo } from '@/lib/formatters';
import { useLikes } from '@/hooks/useLikes';

export interface FeedPostData {
  id: string;
  type: 'lost_item' | 'locker_deposit' | 'found_item';
  user: {
    id?: string;
    name: string;
    avatar: string | null;
    isSystem?: boolean;
  };
  title?: string;
  content: string;
  image?: string;
  timestamp: Date;
  lockerId?: number;
  likes: number;
  comments: number;
  isLiked?: boolean;
}

interface FeedPostProps {
  post: FeedPostData;
  currentUserId?: string;
  isLoggedIn?: boolean;
  isAdmin?: boolean;
  onLike?: (id: string) => void;
  onComment?: (id: string) => void;
  onLoginRequired?: () => void;
  onPostDeleted?: () => void;
  onUserBlocked?: (blockedUserId: string) => void;
}

export const FeedPost = ({ 
  post, 
  currentUserId, 
  isLoggedIn = false,
  isAdmin = false,
  onLike, 
  onComment,
  onLoginRequired,
  onPostDeleted,
  onUserBlocked
}: FeedPostProps) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.comments);

  useEffect(() => {
    setCommentsCount(post.comments);
  }, [post.comments]);
  
  // Use real likes hook
  const { isLiked, likesCount, toggleLike, loading: likeLoading } = useLikes(post.id, currentUserId);

  const handleLike = async () => {
    if (!isLoggedIn) {
      onLoginRequired?.();
      return;
    }
    await toggleLike();
    onLike?.(post.id);
  };

  const handleCommentClick = () => {
    setShowComments(!showComments);
    onComment?.(post.id);
  };

  const getTypeLabel = () => {
    switch (post.type) {
      case 'lost_item':
        return { text: 'ตามหาของหาย', color: 'border-rose-200 bg-rose-50 text-rose-700' };
      case 'locker_deposit':
        return { text: 'ฝากเข้าตู้', color: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
      case 'found_item':
        return { text: 'เจอของ', color: 'border-amber-300 bg-amber-50 text-amber-800' };
    }
  };

  const typeLabel = getTypeLabel();

  // Only show content once — no duplicate title
  const displayContent = post.content;

  return (
    <article className="bg-white/75 backdrop-blur-xl border-b border-zinc-200/80 px-3 sm:px-4 py-3.5 sm:py-4.5 hover:bg-white transition-colors">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-start gap-2.5 sm:gap-3">
          {/* Avatar */}
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 border border-zinc-200 shadow-sm ${
            post.user.isSystem 
              ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-black shadow-md shadow-amber-500/20' 
              : 'bg-amber-50'
          }`}>
            {post.user.isSystem ? (
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-black stroke-[2.5]" />
            ) : post.user.avatar ? (
              <img src={post.user.avatar} alt={post.user.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs sm:text-sm font-bold text-amber-700">{post.user.name.charAt(0)}</span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* User info & menu */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <span className="font-bold text-zinc-900 text-sm sm:text-base truncate max-w-[120px] sm:max-w-none">{post.user.name}</span>
                <span className="text-zinc-300 text-xs sm:text-sm">·</span>
                <span className="text-zinc-500 text-xs sm:text-sm whitespace-nowrap font-normal">{getTimeAgo(post.timestamp)}</span>
              </div>
              
              {/* Menu - only show for logged in users */}
              {isLoggedIn && !post.user.isSystem && (
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-1.5 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400 hover:text-zinc-700 cursor-pointer"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  <PostActions
                    postId={post.id}
                    postUserId={post.user.id || ''}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    isOpen={showMenu}
                    onClose={() => setShowMenu(false)}
                    onEdit={() => {
                      setShowMenu(false);
                      setShowEditModal(true);
                    }}
                    onDelete={onPostDeleted}
                    onBlock={() => {
                      if (post.user.id) {
                        onUserBlocked?.(post.user.id);
                      }
                    }}
                  />
                </div>
              )}
            </div>

            {/* Type Badge */}
            <span className={`inline-block text-[11px] sm:text-xs px-2.5 py-0.5 rounded-full mt-1 border font-medium ${typeLabel.color}`}>
              {typeLabel.text}
            </span>

            {/* Post content */}
            {displayContent && (
              <p className="text-zinc-800 text-xs sm:text-sm mt-2 whitespace-pre-wrap break-words leading-relaxed font-normal">{displayContent}</p>
            )}

            {/* Image */}
            {post.image && (
              <div className="mt-2.5 sm:mt-3 rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-50 shadow-sm">
                <img 
                  src={post.image} 
                  alt="Post image"
                  className="w-full h-auto max-h-60 sm:max-h-80 object-cover"
                />
              </div>
            )}

            {/* Locker info */}
            {post.lockerId && (
              <div className="flex items-center gap-2 sm:gap-3 mt-2 sm:mt-3 text-xs sm:text-sm">
                <span className="flex items-center gap-1 text-emerald-700 font-medium">
                  <Package className="w-3.5 h-3.5" />
                  ตู้ #{String(post.lockerId).padStart(2, '0')}
                </span>
              </div>
            )}

            <div className="flex items-center gap-5 sm:gap-6 mt-3 sm:mt-3.5">
              <button
                onClick={handleLike}
                disabled={likeLoading}
                className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isLiked ? 'text-rose-600' : 'text-zinc-400 hover:text-rose-600'
                } ${likeLoading ? 'opacity-50' : ''}`}
              >
                <Heart className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${isLiked ? 'fill-current' : ''}`} />
                <span className="text-xs font-medium">{likesCount > 0 ? likesCount : ''}</span>
              </button>

              <button
                onClick={handleCommentClick}
                className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                  showComments ? 'text-amber-600' : 'text-zinc-400 hover:text-amber-600'
                }`}
              >
                <MessageCircle className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${showComments ? 'fill-amber-500/20' : ''}`} />
                <span className="text-xs font-medium">{commentsCount > 0 ? commentsCount : ''}</span>
                {showComments ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Comments Section */}
            {showComments && (
              <CommentSection
                postId={post.id}
                isLoggedIn={isLoggedIn}
                currentUserId={currentUserId}
                onLoginRequired={onLoginRequired}
                onCommentsCountChange={setCommentsCount}
              />
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditPostModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          post={{
            id: post.id,
            post_type: post.type === 'lost_item' ? 'lost' : post.type === 'found_item' ? 'found' : 'locker',
            title: post.title || '',
            content: displayContent || post.content,
            image_url: post.image || null
          }}
          onUpdate={() => {
            setShowEditModal(false);
            onPostDeleted?.(); // Refresh the list
          }}
        />
      )}
    </article>
  );
};
