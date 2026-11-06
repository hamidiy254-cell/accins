'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';
import { Send, Loader2 } from 'lucide-react';
import { VerifiedBadge } from '@/components/verified-badge';

type Message = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { full_name: string | null; is_verified: boolean; role: string | null } | null;
};

export function GeneralChat({ user }: { user: any }) {
  const t = useTranslations('chat');
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollBottom = () => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*, profiles!chat_messages_user_id_fkey(full_name, is_verified, role)')
        .order('created_at', { ascending: true })
        .limit(200);
      if (!alive) return;
      setMessages(data || []);
      setLoading(false);
      scrollBottom();
    })();

    const channel = supabase
      .channel('chat_messages_channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, async (payload: any) => {
        const { data } = await supabase
          .from('chat_messages')
          .select('*, profiles!chat_messages_user_id_fkey(full_name, is_verified, role)')
          .eq('id', payload.new.id)
          .single();
        if (data && alive) {
          setMessages(prev => {
            if (prev.some(m => m.id === data.id)) return prev;
            return [...prev, data];
          });
          scrollBottom();
        }
      })
      .subscribe();

    return () => { alive = false; supabase.removeChannel(channel); };
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    const { error } = await supabase.from('chat_messages').insert({ user_id: user.id, content: text });
    setSending(false);
    if (error) {
      setInput(text);
      alert(t('sendError'));
      return;
    }
    inputRef.current?.focus();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay
      ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-fuchsia-600" size={28} /></div>;
  }

  return (
    <div className="flex flex-col h-[65vh] min-h-[400px]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-8">{t('noMessages')}</p>
        ) : messages.map(m => {
          const isOwn = m.user_id === user.id;
          const isAdminMsg = m.profiles?.role === 'admin';
          return (
            <div key={m.id} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white ${isAdminMsg ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-fuchsia-500 to-purple-600'}`}>
                {(m.profiles?.full_name || '?').charAt(0).toUpperCase()}
              </div>
              <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`flex items-center gap-1.5 mb-1 text-xs ${isOwn ? 'flex-row-reverse' : ''}`}>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    {m.profiles?.full_name || t('anonymous')}
                    {m.profiles?.is_verified && <VerifiedBadge size={12} />}
                  </span>
                  <span className="text-slate-400">{formatTime(m.created_at)}</span>
                </div>
                <div className={`px-3 py-2 rounded-2xl text-sm break-words whitespace-pre-wrap ${
                  isOwn
                    ? 'bg-fuchsia-600 text-white rounded-tr-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm'
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
          ref={inputRef}
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
          aria-label="Envoyer"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}