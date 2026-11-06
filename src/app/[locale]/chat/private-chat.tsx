'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';
import { Send, Loader2, ArrowLeft, MessageSquare } from 'lucide-react';
import { VerifiedBadge } from '@/components/verified-badge';

type Profile = { id: string; full_name: string | null; is_verified: boolean; role: string | null };
type Message = {
  id: string;
  user_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
};
type Conversation = {
  user_id: string;
  full_name: string;
  is_verified: boolean;
  last_message: string;
  last_at: string;
  unread: number;
};

export function PrivateChat({ user, isAdmin, onRead }: { user: any; isAdmin: boolean; onRead?: () => void }) {
  const t = useTranslations('chat');
  const supabase = createClient();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [activeConvProfile, setActiveConvProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      if (isAdmin) {
        // Load all messages (sans jointure)
        const { data, error } = await supabase
          .from('private_messages')
          .select('id, user_id, sender_id, content, is_read, created_at')
          .order('created_at', { ascending: false });
        if (!alive) return;
        if (error) { console.error('PM load error:', error); setLoading(false); return; }

        const msgs = data || [];
        // Load unique profiles
        const userIds = [...new Set(msgs.map((m: any) => m.user_id))];
        let profsMap: Record<string, Profile> = {};
        if (userIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, full_name, is_verified, role')
            .in('id', userIds);
          if (profs) {
            (profs as Profile[]).forEach(p => { profsMap[p.id] = p; });
          }
        }

        const map = new Map<string, Conversation>();
        msgs.forEach((m: any) => {
          if (!map.has(m.user_id)) {
            const prof = profsMap[m.user_id];
            map.set(m.user_id, {
              user_id: m.user_id,
              full_name: prof?.full_name || `User ${m.user_id.slice(0, 6)}`,
              is_verified: prof?.is_verified || false,
              last_message: m.content,
              last_at: m.created_at,
              unread: 0,
            });
          }
          const conv = map.get(m.user_id)!;
          if (m.sender_id === m.user_id && !m.is_read) conv.unread++;
        });
        setConversations(Array.from(map.values()));
      } else {
        setActiveConv(user.id);
      }
      setLoading(false);
    };
    load();
    return () => { alive = false; };
  }, [isAdmin, user.id]);

  useEffect(() => {
    if (!activeConv) return;
    let alive = true;

    const loadMessages = async () => {
      const { data } = await supabase
        .from('private_messages')
        .select('id, user_id, sender_id, content, is_read, created_at')
        .eq('user_id', activeConv)
        .order('created_at', { ascending: true });
      if (!alive) return;
      setMessages(data || []);

      // Load profile of the active conversation (for admin)
      if (isAdmin) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, full_name, is_verified, role')
          .eq('id', activeConv)
          .single();
        setActiveConvProfile(prof);
      }

      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      });

      // Mark as read
      const unreadIds = (data || []).filter((m: any) => m.sender_id !== user.id && !m.is_read).map((m: any) => m.id);
      if (unreadIds.length > 0) {
        await supabase.from('private_messages').update({ is_read: true }).in('id', unreadIds);
        if (onRead) onRead();
      }
    };
    loadMessages();

    const channel = supabase
      .channel(`pm_${activeConv}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'private_messages', filter: `user_id=eq.${activeConv}` },
        (payload: any) => {
          if (!alive) return;
          const newMsg = payload.new as Message;
          setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
          requestAnimationFrame(() => {
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          });
          if (newMsg.sender_id !== user.id) {
            supabase.from('private_messages').update({ is_read: true }).eq('id', newMsg.id);
            if (onRead) onRead();
          }
        }
      )
      .subscribe();

    return () => { alive = false; supabase.removeChannel(channel); };
  }, [activeConv]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !activeConv) return;
    setSending(true);
    setInput('');
    const { error } = await supabase.from('private_messages').insert({
      user_id: activeConv,
      sender_id: user.id,
      content: text,
    });
    setSending(false);
    if (error) { setInput(text); alert(t('sendError') + ': ' + error.message); }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay
      ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-fuchsia-600" size={28} /></div>;
  }

  // ADMIN : liste des conversations
  if (isAdmin && !activeConv) {
    if (conversations.length === 0) {
      return <div className="p-8 text-center text-sm text-slate-500">{t('noConversations')}</div>;
    }
    return (
      <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[65vh] overflow-y-auto">
        {conversations.map(c => (
          <button
            key={c.user_id}
            onClick={() => setActiveConv(c.user_id)}
            className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition text-left"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center text-white font-bold shrink-0">
              {c.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-sm truncate">{c.full_name}</p>
                {c.is_verified && <VerifiedBadge size={12} />}
                {c.unread > 0 && (
                  <span className="ml-auto bg-fuchsia-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">{c.unread}</span>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">{c.last_message}</p>
            </div>
          </button>
        ))}
      </div>
    );
  }

  // CONVERSATION
  return (
    <div className="flex flex-col h-[65vh] min-h-[400px]">
      {isAdmin && (
        <button
          onClick={() => { setActiveConv(null); setMessages([]); setActiveConvProfile(null); }}
          className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-fuchsia-600 transition bg-slate-50 dark:bg-slate-900"
        >
          <ArrowLeft size={16} /> {t('backToList')}
        </button>
      )}

      {!isAdmin && (
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center gap-2">
          <MessageSquare size={16} className="text-fuchsia-600" />
          <p className="text-sm font-semibold">{t('supportChat')}</p>
          <span className="text-xs text-slate-500">— {t('supportChatSub')}</span>
        </div>
      )}

      {isAdmin && activeConvProfile && (
        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
            {(activeConvProfile.full_name || 'U').charAt(0).toUpperCase()}
          </div>
          <p className="text-sm font-semibold">{activeConvProfile.full_name || 'Utilisateur'}</p>
          {activeConvProfile.is_verified && <VerifiedBadge size={14} />}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-8">{t('startConversation')}</p>
        ) : messages.map(m => {
          const isOwn = m.sender_id === user.id;
          return (
            <div key={m.id} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white ${isOwn ? 'bg-gradient-to-br from-fuchsia-500 to-purple-600' : 'bg-gradient-to-br from-amber-500 to-orange-600'}`}>
                {isOwn ? 'M' : 'A'}
              </div>
              <div className={`max-w-[75%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-center gap-1.5 mb-1 text-xs ${isOwn ? 'flex-row-reverse' : ''}`}>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    {isOwn ? t('you') : t('support')}
                    {!isOwn && <VerifiedBadge size={12} />}
                  </span>
                  <span className="text-slate-400">{formatTime(m.created_at)}</span>
                </div>
                <div className={`px-3 py-2 rounded-2xl text-sm break-words whitespace-pre-wrap ${
                  isOwn ? 'bg-fuchsia-600 text-white rounded-tr-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm'
                }`}>
                  {m.content}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800 p-3 flex gap-2 items-end bg-slate-50 dark:bg-slate-900">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={t('placeholder')}
          rows={1}
          maxLength={1000}
          className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl dark:bg-slate-800 focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20 outline-none transition text-sm resize-none max-h-24"
        />
        <button
          onClick={send}
          disabled={!input.trim() || sending}
          className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white p-2.5 rounded-xl disabled:opacity-40 transition shrink-0"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}