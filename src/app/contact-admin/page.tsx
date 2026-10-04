'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Send, Shield, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface AdminMessage {
  id: string;
  user_id: string;
  sender_type: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

const ContactAdminPageContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams?.get('from');
  
  const handleBack = () => {
    if (from === 'inbox') {
      router.push('/?view=chat_list');
    } else if (from === 'profile') {
      router.push('/profile');
    } else {
      router.back();
    }
  };
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Server-side mark as read API call
  const markAdminMessagesAsRead = useCallback(async () => {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      await fetch('/api/mark-chat-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          targetUserId: user.id,
          viewerRole: 'user',
          type: 'admin',
        }),
      });
    } catch (err) {
      console.warn('Error calling mark-chat-read for admin messages:', err);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  const fetchMessages = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('admin_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchMessages();
      markAdminMessagesAsRead();
      if (typeof window !== 'undefined') {
        localStorage.setItem(`admin_chat_read_${user.id}`, new Date().toISOString());
      }
    }
  }, [user, fetchMessages, markAdminMessagesAsRead]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Realtime subscription for admin messages
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`user-admin-chat-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'admin_messages',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        const newMsg = payload.new as AdminMessage;
        setMessages(prev => [...prev, newMsg]);
        
        // If message is from admin, automatically mark as read since user is actively viewing
        if (newMsg.sender_type === 'admin') {
          markAdminMessagesAsRead();
          if (typeof window !== 'undefined') {
            localStorage.setItem(`admin_chat_read_${user.id}`, new Date().toISOString());
          }
        }
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(channel); 
    };
  }, [user, markAdminMessagesAsRead]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;
    const textToSend = newMessage.trim();
    setNewMessage('');

    const { data, error } = await supabase.from('admin_messages').insert({
      user_id: user.id,
      sender_type: 'user',
      content: textToSend
    }).select().single();

    if (error) { 
      toast.error('ไม่สามารถส่งข้อความได้'); 
      setNewMessage(textToSend);
      return;
    }

    // Trigger notification email ONCE during active form submission
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        fetch('/api/send-chat-notification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            type: 'admin',
            sender_type: 'user',
            user_id: user.id,
            content: textToSend,
            messageId: data?.id,
          }),
        }).catch((err) => {
          console.warn('Background admin notification error:', err);
        });
      }
    } catch (notifErr) {
      console.warn('Failed to initiate send-chat-notification for admin:', notifErr);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col w-full h-full bg-zinc-50 overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-amber-400/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="flex-none z-50 bg-white/85 backdrop-blur-2xl border-b border-zinc-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={handleBack} className="p-2 hover:bg-zinc-100 rounded-full transition-colors cursor-pointer text-zinc-700">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-md text-zinc-900">
              <Shield className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-semibold text-zinc-800 leading-tight">ติดต่อ Admin</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Message Feed */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain max-w-2xl w-full mx-auto px-4 py-5 space-y-3.5 relative z-10">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <p className="text-zinc-500 text-xs sm:text-sm font-normal">Admin จะตอบกลับโดยเร็ว</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.sender_type === 'admin' && (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center mr-2 mt-1 shrink-0 shadow-sm text-zinc-900">
                <Shield className="w-3.5 h-3.5 stroke-[2.2]" />
              </div>
            )}
            <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
              msg.sender_type === 'user'
                ? 'bg-amber-100/90 border border-amber-200 text-zinc-900 font-medium rounded-tr-sm'
                : 'backdrop-blur-xl bg-white border border-zinc-200 text-zinc-800 font-normal rounded-tl-sm'
            }`}>
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              <p className={`text-[10px] mt-1 text-right font-normal ${msg.sender_type === 'user' ? 'text-amber-800/70' : 'text-zinc-400'}`}>
                {new Date(msg.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input Dock */}
      <div className="flex-none z-20 bg-white/85 backdrop-blur-2xl border-t border-zinc-200 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <form onSubmit={sendMessage} className="max-w-2xl mx-auto flex gap-2">
          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="พิมพ์ข้อความถึง Admin..."
            className="flex-1 px-4 py-3 rounded-xl border border-zinc-300 hover:border-zinc-400 bg-white text-zinc-900 font-normal placeholder:text-zinc-400 focus:outline-none focus:ring-0 focus:shadow-none focus:border-zinc-900 text-base md:text-sm shadow-sm transition-all"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="px-4 py-3 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-xl text-zinc-900 font-semibold disabled:opacity-40 transition-all cursor-pointer shadow-lg shadow-amber-500/20 hover:shadow-amber-400/30 flex items-center justify-center active:scale-[0.98]"
          >
            <Send className="w-4 h-4 stroke-[2.2]" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default function ContactAdminPage() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    }>
      <ContactAdminPageContent />
    </React.Suspense>
  );
}
