'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Mail, Phone, Trash2, Check, Circle, MessageSquare, Copy, ExternalLink } from 'lucide-react';

type Msg = {
  id: string;
  name: string | null;
  contact_method: 'email' | 'whatsapp';
  contact_value: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export default function MessagesPage() {
  const supabase = createClient();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });
    setMessages(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleRead = async (m: Msg) => {
    const { error } = await supabase.from('contact_messages').update({ is_read: !m.is_read }).eq('id', m.id);
    if (error) { alert(error.message); return; }
    setMessages(prev => prev.map(x => x.id === m.id ? { ...x, is_read: !m.is_read } : x));
  };

  const del = async (id: string) => {
    if (!confirm('Supprimer ce message ?')) return;
    const { error } = await supabase.from('contact_messages').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    setMessages(prev => prev.filter(x => x.id !== id));
  };

  const copyValue = (v: string) => {
    navigator.clipboard.writeText(v);
    alert('Copie !');
  };

  const displayed = filter === 'unread' ? messages.filter(m => !m.is_read) : messages;
  const unreadCount = messages.filter(m => !m.is_read).length;

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Messages</h1>
          <p className="text-sm text-slate-500 mt-1">
            {messages.length} message(s) — {unreadCount} non lu(s)
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${filter === 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}>
            Tous
          </button>
          <button onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${filter === 'unread' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}>
            Non lus ({unreadCount})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500">Chargement...</div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500">
          {filter === 'unread' ? 'Aucun message non lu.' : 'Aucun message.'}
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(m => (
            <div key={m.id}
              className={`p-4 rounded-2xl border transition ${
                m.is_read
                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  : 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800'
              }`}>
              <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  {!m.is_read && <Circle size={8} className="fill-indigo-500 text-indigo-500" />}
                  <span className="font-semibold text-sm">{m.name || 'Anonyme'}</span>
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                    m.contact_method === 'email'
                      ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400'
                      : 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400'
                  }`}>
                    {m.contact_method === 'email' ? <Mail size={10} /> : <Phone size={10} />}
                    {m.contact_method === 'email' ? 'Email' : 'WhatsApp'}
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  {new Date(m.created_at).toLocaleString('fr-FR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>

              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="font-mono text-sm bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg break-all">
                  {m.contact_value}
                </span>
                <button onClick={() => copyValue(m.contact_value)}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition" title="Copier">
                  <Copy size={14} />
                </button>
                {m.contact_method === 'email' ? (
                  <a href={`mailto:${m.contact_value}`}
                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded transition" title="Repondre par email">
                    <ExternalLink size={14} />
                  </a>
                ) : (
                  <a href={`https://wa.me/${m.contact_value.replace(/[^0-9]/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 rounded transition" title="Ouvrir WhatsApp">
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>

              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap mb-3">{m.message}</p>

              <div className="flex items-center justify-end gap-2">
                <button onClick={() => toggleRead(m)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                    m.is_read
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      : 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900'
                  }`}>
                  <Check size={12} /> {m.is_read ? 'Marquer non lu' : 'Marquer lu'}
                </button>
                <button onClick={() => del(m.id)}
                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition" title="Supprimer">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}