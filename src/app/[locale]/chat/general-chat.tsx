'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';
import { Send, Loader2, Users, Trash2, X } from 'lucide-react';
import { VerifiedBadge } from '@/components/verified-badge';

type Profile = { id: string; full_name: string | null; is_verified: boolean; role: string | null };
type Message = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: Profile | null;
  optimistic?: boolean;
};

export function GeneralChat({ user }: { user: any }) {
  const t = useTranslations('chat');
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const profilesMapRef = useRef<Record<string, Profile>>({});

  const scrollBottom = () => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  };

  const fetchProfiles = async (ids: string[]) => {
    const unique = [...new Set(ids)].filter(id => !profilesMapRef.current[id]);
    if (unique.length === 0) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, is_verified, role')
      .in('id', unique);
    if (data) {
      const newMap = { ...profilesMapRef.current };
      (data as Profile[]).forEach(p => { newMap[p.id] = p; });
      profilesMapRef.current = newMap;
      setProfilesMap(newMap);
    }
  };

  useEffect(() => {
    let alive = true;

    const loadInitial = async () => {
      // Check admin status
      const { data: myProf } = await supabase
        .from('profiles').select('role').eq('id', user.id).single();
      if (myProf?.role === 'admin') setIsAdmin(true);

      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, user_id, content, created_at')
        .order('created_at', { ascending: false })
        .limit(300);

      if (!alive) return;
      if (error) { console.error('Chat load error:', error); setLoading(false); return; }

      const msgs = (data || []).slice().reverse();
      const userIds = [...new Set(msgs.map((m: any) => m.user_id))];
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles').select('id, full_name, is_verified, role').in('id', userIds);
        if (profs) {
          const map: Record<string, Profile> = {};
          (profs as Profile[]).forEach(p => { map[p.id] = p; });
          profilesMapRef.current = map;
          setProfilesMap(map);
        }
      }
      setMessages(msgs);
      setLoading(false);
      scrollBottom();
    };
    loadInitial();

    // Realtime : INSERT + DELETE
    const channel = supabase
      .channel(`general_chat_${user.id}_${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, async (payload: any) => {
        const newMsg = payload.new as Message;
        if (!alive) return;
        if (!profilesMapRef.current[newMsg.user_id]) {
          await fetchProfiles([newMsg.user_id]);
        }
        setMessages(prev => {
          // Remove optimistic duplicate (same user + same content within 3s)
          const filtered = prev.filter(m => !(m.optimistic && m.user_id === newMsg.user_id && m.content === newMsg.content));
          if (filtered.some(m => m.id === newMsg.id)) return filtered;
          return [...filtered, newMsg];
        });
        scrollBottom();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (payload: any) => {
        if (!alive) return;
        const deletedId = payload.old?.id;
        if (deletedId) {
          setMessages(prev => prev.filter(m => m.id !== deletedId));
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

    // OPTIMISTIC : ajouter immédiatement
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      user_id: user.id,
      content: text,
      created_at: new Date().toISOString(),
      optimistic: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    scrollBottom();

    const { error } = await supabase.from('chat_messages').insert({ user_id: user.id, content: text });
    setSending(false);

    if (error) {
      // Rollback
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setInput(text);
      alert(t('sendError') + ': ' + error.message);
      return;
    }
    inputRef.current?.focus();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    setDeleteTarget(null);
    // Optimistic remove
    setMessages(prev => prev.filter(m => m.id !== targetId));
    const { error } = await supabase.from('chat_messages').delete().eq('id', targetId);
    if (error) {
      alert('Erreur suppression: ' + error.message);
      // Reload messages
      const { data } = await supabase.from('chat_messages').select('id, user_id, content, created_at').order('created_at', { ascending: true }).limit(300);
      if (data) setMessages(data);
    }
  };

  const canDelete = (m: Message) => !m.optimistic && (m.user_id === user.id || isAdmin);

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

  return (
    <div className="flex flex-col h-[65vh] min-h-[400px]">
      <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Users size={14} className="text-fuchsia-600" />
          <span className="font-medium">{t('generalChat')}</span>
        </div>
        <span className="text-slate-400">{messages.length} message{messages.length !== 1 ? 's' : ''}</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-8">{t('noMessages')}</p>
        ) : messages.map(m => {
          const profile = profilesMap[m.user_id] || m.profiles;
          const isOwn = m.user_id === user.id;
          const isAdminMsg = profile?.role === 'admin';
          const displayName = profile?.full_name || m.user_id.slice(0, 8);
          return (
            <div key={m.id} className={`group flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white ${isAdminMsg ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-fuchsia-500 to-purple-600'}`}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`flex items-center gap-1.5 mb-1 text-xs ${isOwn ? 'flex-row-reverse' : ''}`}>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    {displayName}
                    {profile?.is_verified && <VerifiedBadge size={12} />}
                    {isAdminMsg && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase">Admin</span>}
                  </span>
                  <span className="text-slate-400">{formatTime(m.created_at)}</span>
                  {canDelete(m) && (
                    <button
                      onClick={() => setDeleteTarget(m)}
                      className="opacity-0 group-hover:opacity-100 transition p-0.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"
                      title="Supprimer"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <div className={`px-3 py-2 rounded-2xl text-sm break-words whitespace-pre-wrap ${
                  isOwn
                    ? 'bg-fuchsia-600 text-white rounded-tr-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm'
                } ${m.optimistic ? 'opacity-60' : ''}`}>
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
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>

      {/* Modal de confirmation de suppression */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center shrink-0">
                <Trash2 className="text-red-600" size={22} />
              </div>
              <button onClick={() => setDeleteTarget(null)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <X size={18} />
              </button>
            </div>
            <h3 className="font-bold text-lg mb-2">Supprimer ce message ?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Le message sera supprimé pour tous les utilisateurs. Cette action est irréversible.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                Annuler
              </button>
              <button onClick={confirmDelete} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}