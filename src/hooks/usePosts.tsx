'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Post {
  id: string;
  user_id: string;
  post_type: 'lost' | 'found' | 'locker';
  title: string;
  content: string;
  image_url: string | null;
  location: string | null;
  locker_number: number | null;
  contact_info: string | null;
  status: 'active' | 'resolved' | 'expired';
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
  profiles?: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
}

// Module-level in-memory cache to prevent reloading feed on every route/view switch
let cachedPosts: Post[] | null = null;
let lastFetchedTime = 0;

export const clearPostsCache = () => {
  cachedPosts = null;
  lastFetchedTime = 0;
};

export const usePosts = () => {
  // Initialize state with cached posts if available (instant 0ms display)
  const [posts, setPosts] = useState<Post[]>(() => cachedPosts ?? []);
  // Only show initial loading spinner if there is no cache at all
  const [loading, setLoading] = useState<boolean>(() => cachedPosts === null);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = useCallback(async (isSilent = false, showLoader = false) => {
    if (showLoader || (!isSilent && cachedPosts === null)) {
      setLoading(true);
    }
    setError(null);

    try {
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (postsError || !postsData) {
        setError('ไม่สามารถโหลดโพสต์ได้');
        return;
      }

      let enrichedPosts: Post[] = [];
      const userIds = [...new Set(postsData.map(p => p.user_id))];

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, username, full_name, avatar_url')
          .in('user_id', userIds);

        const profilesMap = new Map((profilesData || []).map(p => [p.user_id, p]));
        enrichedPosts = postsData.map(post => ({
          ...post,
          profiles: profilesMap.get(post.user_id) || null
        } as Post));
      } else {
        enrichedPosts = postsData as Post[];
      }

      // Update module cache and state
      cachedPosts = enrichedPosts;
      lastFetchedTime = Date.now();
      setPosts(enrichedPosts);
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError('เกิดข้อผิดพลาดในการโหลดโพสต์');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cachedPosts === null) {
      // First mount ever: fetch with loading spinner
      fetchPosts(false);
    } else {
      // Returning to page: cached posts already shown instantly (0ms),
      // revalidate silently in background to immediately catch any posts created/updated while away
      fetchPosts(true);
    }
  }, [fetchPosts]);

  const createPost = async (postData: {
    post_type: 'lost' | 'found' | 'locker';
    title: string;
    content: string;
    image_url?: string;
    location?: string;
    locker_number?: number;
    contact_info?: string;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('กรุณาเข้าสู่ระบบก่อนสร้างโพสต์');
      return { error: new Error('Not authenticated') };
    }

    const { data, error } = await supabase
      .from('posts')
      .insert({ user_id: user.id, ...postData })
      .select('*')
      .single();

    if (error) {
      toast.error('ไม่สามารถสร้างโพสต์ได้');
      return { error };
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('user_id, username, full_name, avatar_url')
      .eq('user_id', user.id)
      .maybeSingle();

    const newPost = { ...data, profiles: profileData || null } as Post;

    setPosts(prev => {
      const next = [newPost, ...prev];
      cachedPosts = next;
      return next;
    });
    lastFetchedTime = Date.now();

    toast.success('สร้างโพสต์สำเร็จ!');
    return { data, error: null };
  };

  const updatePost = async (postId: string, updates: Partial<Omit<Post, 'profiles'>>) => {
    const { data, error } = await supabase
      .from('posts')
      .update(updates)
      .eq('id', postId)
      .select()
      .single();

    if (error) {
      toast.error('ไม่สามารถอัปเดตโพสต์ได้');
      return { error };
    }

    setPosts(prev => {
      const next = prev.map(p => (p.id === postId ? { ...p, ...(data as Post) } : p));
      cachedPosts = next;
      return next;
    });

    return { data, error: null };
  };

  const deletePost = async (postId: string) => {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (error) {
      toast.error('ไม่สามารถลบโพสต์ได้');
      return { error };
    }

    setPosts(prev => {
      const next = prev.filter(p => p.id !== postId);
      cachedPosts = next;
      return next;
    });

    toast.success('ลบโพสต์สำเร็จ');
    return { error: null };
  };

  return { posts, loading, error, fetchPosts, createPost, updatePost, deletePost };
};
