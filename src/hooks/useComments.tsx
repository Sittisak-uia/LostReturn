'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  profiles?: { username: string | null; full_name: string | null; avatar_url: string | null; };
  replies?: Comment[];
}

export const useComments = (postId: string) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setLoading(true);
    }
    const { data: commentsData, error } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error || !commentsData) {
      setLoading(false);
      return;
    }

    const userIds = [...new Set(commentsData.map(c => c.user_id))];
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, username, full_name, avatar_url')
        .in('user_id', userIds);
      const profilesMap = new Map((profilesData || []).map(p => [p.user_id, p]));
      const withProfiles = commentsData.map(c => ({ ...c, profiles: profilesMap.get(c.user_id) || null } as Comment));
      const parentComments = withProfiles.filter(c => !c.parent_id);
      const childComments = withProfiles.filter(c => c.parent_id);
      setComments(parentComments.map(parent => ({
        ...parent,
        replies: childComments.filter(child => child.parent_id === parent.id)
      })));
    } else {
      setComments([]);
    }
    setLoading(false);
  }, [postId]);

  useEffect(() => {
    if (postId) {
      fetchComments();
      const channel = supabase.channel(`comments-${postId}-${Date.now()}-${Math.random()}`);
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` }, () => { fetchComments(true); });
      channel.subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [postId, fetchComments]);

  const createComment = async (content: string, parentId?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('กรุณาเข้าสู่ระบบก่อนแสดงความคิดเห็น'); return { error: new Error('Not authenticated') }; }
    const { data, error } = await supabase.from('comments').insert({ post_id: postId, user_id: user.id, parent_id: parentId || null, content }).select('*').single();
    if (error) { toast.error('ไม่สามารถแสดงความคิดเห็นได้'); return { error }; }
    await fetchComments(true);
    toast.success('แสดงความคิดเห็นสำเร็จ');
    return { data, error: null };
  };

  const deleteComment = async (commentId: string) => {
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) { toast.error('ไม่สามารถลบความคิดเห็นได้'); return { error }; }
    await fetchComments(true);
    toast.success('ลบความคิดเห็นแล้ว');
    return { error: null };
  };

  return { comments, loading, createComment, deleteComment, refreshComments: fetchComments };
};
