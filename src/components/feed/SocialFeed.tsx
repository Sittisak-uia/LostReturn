'use client';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { FeedPost, FeedPostData } from './FeedPost';
import { LockerSearchResults } from './LockerSearchResults';
import { Loader2, PenSquare } from 'lucide-react';
import { usePosts, Post } from '@/hooks/usePosts';
import { CreatePostModal } from './CreatePostModal';
import { supabase } from '@/integrations/supabase/client';
import { useLockerTransactions } from '@/hooks/useLockerTransactions';

interface BlockedUser {
  blocked_user_id: string;
}

// Convert database post to feed post format
const convertToFeedPost = (post: Post): FeedPostData => {
  const typeMap: Record<string, FeedPostData['type']> = {
    'lost': 'lost_item',
    'found': 'found_item',
    'locker': 'locker_deposit'
  };
  // Remove duplicated title from content (legacy posts stored title+content concatenated)
  let cleanContent = post.content;
  if (post.title && cleanContent.startsWith(post.title)) {
    cleanContent = cleanContent.slice(post.title.length).replace(/^\n+/, '');
  }

  return {
    id: post.id,
    type: typeMap[post.post_type] || 'lost_item',
    user: {
      id: post.user_id,
      name: post.profiles?.username || post.profiles?.full_name || 'ผู้ใช้',
      avatar: post.profiles?.avatar_url || null,
      isSystem: post.post_type === 'locker'
    },
    content: cleanContent || post.content,
    image: post.image_url || undefined,
    timestamp: new Date(post.created_at),
    lockerId: post.locker_number || undefined,
    likes: post.likes_count,
    comments: post.comments_count
  };
};

interface SocialFeedProps {
  onPostClick?: (post: FeedPostData) => void;
  isLoggedIn?: boolean;
  isAdmin?: boolean;
  userName?: string;
  currentUserId?: string;
  onLoginRequired?: () => void;
  onLockerClick?: (lockerId: number) => void;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
}

export const SocialFeed = ({ isLoggedIn, isAdmin, userName, currentUserId, onLoginRequired, onLockerClick, searchQuery: externalSearchQuery, onSearchChange }: SocialFeedProps) => {
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const searchQuery = externalSearchQuery ?? internalSearchQuery;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [userId, setUserId] = useState<string | undefined>(currentUserId);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [locallyBlockedPosts, setLocallyBlockedPosts] = useState<string[]>([]);
  const { posts: dbPosts, loading, createPost, fetchPosts } = usePosts();
  const { transactions, loading: lockerLoading } = useLockerTransactions();

  // Fetch blocked users
  const fetchBlockedUsers = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('blocks')
      .select('blocked_user_id')
      .eq('blocker_id', userId);
    
    if (data) {
      setBlockedUsers(data.map((b: BlockedUser) => b.blocked_user_id));
    }
  }, [userId]);

  // Sync userId when currentUserId prop changes
  useEffect(() => {
    if (currentUserId) {
      setUserId(currentUserId);
    } else if (isLoggedIn) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setUserId(user.id);
      });
    }
  }, [currentUserId, isLoggedIn]);

  // Fetch blocked users when userId changes
  useEffect(() => {
    if (userId) {
      fetchBlockedUsers();
    }
  }, [userId, fetchBlockedUsers]);

  // Set up realtime subscription for posts
  useEffect(() => {
    const channel = supabase
      .channel('posts-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts'
        },
        () => {
          fetchPosts(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPosts]);

  // Filter blocked users from database posts
  const allPosts = useMemo(() => {
    const convertedPosts = dbPosts.map(convertToFeedPost);
    
    return convertedPosts.filter(post => {
      if (post.user.id && blockedUsers.includes(post.user.id)) return false;
      if (locallyBlockedPosts.includes(post.id)) return false;
      return true;
    });
  }, [dbPosts, blockedUsers, locallyBlockedPosts]);

  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return allPosts;
    const query = searchQuery.toLowerCase();
    return allPosts.filter(
      post =>
        post.content.toLowerCase().includes(query) ||
        post.user.name.toLowerCase().includes(query) ||
        (post.title && post.title.toLowerCase().includes(query))
    );
  }, [allPosts, searchQuery]);

  const handleLike = (_id: string) => {};

  const handleComment = (_id: string) => {};

  const handleCreatePostClick = () => {
    if (!isLoggedIn) {
      onLoginRequired?.();
      return;
    }
    setShowCreateModal(true);
  };

  const handleCreatePost = async (data: {
    post_type: 'lost' | 'found';
    title: string;
    content: string;
    image_url?: string;
  }) => {
    return await createPost({
      ...data,
      image_url: data.image_url
    });
  };

  const handlePostDeleted = () => {
    fetchPosts();
  };

  // Handler for when a user is blocked - hide their posts immediately
  const handleUserBlocked = (blockedUserId: string, postId: string) => {
    setBlockedUsers(prev => [...prev, blockedUserId]);
    setLocallyBlockedPosts(prev => [...prev, postId]);
  };

  const scrollToTop = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
      document.body.scrollTo({ top: 0, behavior: 'smooth' });
    }
    const scrollContainers = document.querySelectorAll('.overflow-y-auto, .overflow-auto');
    scrollContainers.forEach((container) => {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, []);

  const handlePostCreated = useCallback(() => {
    fetchPosts(true);
    scrollToTop();
    setTimeout(scrollToTop, 150);
  }, [fetchPosts, scrollToTop]);

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      {/* Locker Search Results - Show when searching */}
      {onLockerClick && (
        <LockerSearchResults
          transactions={transactions}
          loading={lockerLoading}
          searchQuery={searchQuery}
          onLockerClick={onLockerClick}
        />
      )}

      {/* Feed */}
      <div className="divide-y divide-zinc-200/80">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-zinc-500 text-xs sm:text-sm font-normal">ไม่มีโพสต์ที่ตรงกับการค้นหา</p>
          </div>
        ) : (
          filteredPosts.map(post => (
            <FeedPost
              key={post.id}
              post={post}
              currentUserId={userId}
              isLoggedIn={isLoggedIn}
              isAdmin={isAdmin}
              onLike={handleLike}
              onComment={handleComment}
              onLoginRequired={onLoginRequired}
              onPostDeleted={handlePostDeleted}
              onUserBlocked={(blockedUserId) => handleUserBlocked(blockedUserId, post.id)}
            />
          ))
        )}
      </div>

      {/* Floating Create Post Button */}
      <button
        onClick={handleCreatePostClick}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-12 h-12 sm:w-14 sm:h-14 bg-white hover:bg-zinc-50 border border-zinc-300 hover:border-zinc-900 focus:border-zinc-900 active:border-zinc-900 text-zinc-800 rounded-2xl shadow-md flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40 cursor-pointer outline-none"
        aria-label="สร้างโพสต์ใหม่"
      >
        <PenSquare className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2] text-zinc-800" />
      </button>

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPostCreated={handlePostCreated}
        onSubmit={handleCreatePost}
        userName={userName}
      />
    </div>
  );
};
