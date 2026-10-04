'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, Loader2, Trash2, Edit2, AlertCircle, Package } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EditPostModal } from '@/components/feed/EditPostModal';
import { formatThaiDate } from '@/lib/formatters';

interface Post {
  id: string;
  post_type: 'lost' | 'found' | 'locker';
  title: string;
  content: string;
  image_url: string | null;
  status: string;
  created_at: string;
}

const MyPostsPage = () => {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  const fetchMyPosts = async (isSilent = false) => {
    if (!isSilent && posts.length === 0) {
      setLoading(true);
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('กรุณาเข้าสู่ระบบ');
      router.push('/');
      return;
    }
    const { data, error } = await supabase.from('posts').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (error) {
      toast.error('ไม่สามารถโหลดโพสต์ได้');
    } else {
      setPosts((data as Post[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchMyPosts(); }, []);

  const handleDelete = async (postId: string) => {
    if (!confirm('คุณต้องการลบโพสต์นี้หรือไม่?')) return;
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) { toast.error('ไม่สามารถลบโพสต์ได้'); }
    else { toast.success('ลบโพสต์แล้ว'); setPosts(prev => prev.filter(p => p.id !== postId)); }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'lost': return { text: 'ของหาย', color: 'border-rose-200 bg-rose-50 text-rose-700', icon: AlertCircle };
      case 'found': return { text: 'เจอของ', color: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: Package };
      default: return { text: 'โพสต์', color: 'border-amber-300 bg-amber-50 text-amber-800', icon: Package };
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-2xl border-b border-zinc-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/profile')} className="p-2 hover:bg-zinc-100 rounded-full transition-colors cursor-pointer text-zinc-700">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base sm:text-lg font-semibold text-zinc-800 tracking-tight">โพสต์ของฉัน</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-zinc-500 text-sm font-normal">คุณยังไม่มีโพสต์</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => {
              const typeInfo = getTypeLabel(post.post_type);
              const Icon = typeInfo.icon;
              return (
                <div key={post.id} className="backdrop-blur-xl bg-white rounded-3xl border border-zinc-200 p-4 sm:p-5 hover:border-amber-400/50 transition-colors shadow-sm">
                  <div className="flex items-start gap-3.5">
                    {post.image_url && (
                      <img src={post.image_url} alt="" className="w-20 h-20 rounded-2xl object-cover shrink-0 border border-zinc-200" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full border ${typeInfo.color} font-medium`}>
                          <Icon className="w-3 h-3" />{typeInfo.text}
                        </span>
                        <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-normal ${post.status === 'active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-zinc-100 text-zinc-600'}`}>
                          {post.status === 'active' ? 'กำลังแสดง' : post.status}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-zinc-800 line-clamp-3 mt-1.5 leading-relaxed font-normal whitespace-pre-wrap">
                        {post.content || post.title}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-2 font-normal">
                        {formatThaiDate(post.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2.5 mt-4 pt-3.5 border-t border-zinc-100">
                    <button onClick={() => setEditingPost(post)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-medium transition-colors cursor-pointer">
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button onClick={() => handleDelete(post.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium border border-rose-200 transition-colors cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editingPost && (
        <EditPostModal
          isOpen={!!editingPost}
          onClose={() => setEditingPost(null)}
          post={editingPost}
          onUpdate={() => fetchMyPosts(true)}
        />
      )}
    </div>
  );
};

export default MyPostsPage;
