'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Like {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
}

export const useLikes = (postId: string, userId?: string) => {
  const [likes, setLikes] = useState<Like[]>([]);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchLikes = useCallback(async () => {
    const { data, error } = await supabase.from('likes').select('*').eq('post_id', postId);
    if (!error && data) {
      setLikes(data);
      setLikesCount(data.length);
      if (userId) setIsLiked(data.some(like => like.user_id === userId));
    }
  }, [postId, userId]);

  useEffect(() => { fetchLikes(); }, [fetchLikes]);

  useEffect(() => {
    const channel = supabase.channel(`likes-${postId}-${Date.now()}-${Math.random()}`);
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'likes', filter: `post_id=eq.${postId}` }, () => { fetchLikes(); });
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [postId, fetchLikes]);

  const toggleLike = async () => {
    if (!userId) return { error: new Error('Not authenticated') };
    setLoading(true);

    const wasLiked = isLiked;
    // Optimistic UI state update immediately
    setIsLiked(!wasLiked);
    setLikesCount(prev => wasLiked ? Math.max(0, prev - 1) : prev + 1);

    if (wasLiked) {
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);

      if (error) {
        // Rollback optimistic update on error
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
        setLoading(false);
        return { error };
      }

      setLoading(false);
      return { error: null };
    } else {
      const { error } = await supabase
        .from('likes')
        .insert({ post_id: postId, user_id: userId });

      if (error) {
        // Rollback optimistic update on error
        setIsLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
        setLoading(false);
        return { error };
      }

      setLoading(false);
      return { error: null };
    }
  };

  return { likes, isLiked, likesCount, loading, toggleLike, fetchLikes };
};
