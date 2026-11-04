'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';
import { X, Mail, Phone, MessageSquare, Loader2, CheckCircle, Send } from 'lucide-react';

type Props = { open: boolean; onClose: () => void };

export function ContactModal({ open, onClose }: Props) {
  const t = useTranslations('contact');
  const supabase = createClient();
  const [method, setMethod] = useState<'email' | 'whatsapp'>('email');
  const [name, setName] = useState('');
  const [contactValue, setContactValue] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    const { error } = await supabase.from('contact_messages').insert({
      name: name.trim() || null,
      contact_method: method,
      contact_value: contactValue.trim(),
      message: message.trim(),
    });
    setLoading(false);
    if (error) {
      setError(t('error'));
      return;
    }
    setSuccess(true);
    setName(''); setContactValue(''); setMessage(''); setMethod('email');
    setTimeout(() => {
      setSuccess(false);
      onClose();
    }, 2500);
  };

  const inputClass = "w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl dark:bg-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition text-sm";

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-lg">{t('title')}</h2>
            <p className="text-xs text-slate-500">{t('subtitle')}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
              <CheckCircle className="text-green-600" size={32} />
            </div>
            <p className="font-semibold text-green-700 dark:text-green-400">{t('success')}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t('method')}</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setMethod('email'); setContactValue(''); }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition ${
                    method === 'email'
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-700 dark:text-indigo-300'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Mail size={16} /> {t('email')}
                </button>
                <button
                  type="button"
                  onClick={() => { setMethod('whatsapp'); setContactValue(''); }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition ${
                    method === 'whatsapp'
                      ? 'bg-green-50 dark:bg-green-950/40 border-green-500 text-green-700 dark:text-green-300'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Phone size={16} /> {t('whatsapp')}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">{t('name')}</label>
              <input placeholder={t('namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                {method === 'email' ? t('emailLabel') : t('whatsappLabel')} <span className="text-red-500">*</span>
              </label>
              <input
                required
                type={method === 'email' ? 'email' : 'tel'}
                inputMode={method === 'email' ? 'email' : 'tel'}
                placeholder={method === 'email' ? t('emailPlaceholder') : t('whatsappPlaceholder')}
                value={contactValue}
                onChange={(e) => setContactValue(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">{t('messageLabel')} <span className="text-red-500">*</span></label>
              <textarea
                required
                rows={4}
                placeholder={t('messagePlaceholder')}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className={inputClass}
              />
            </div>

            {error && <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm">{error}</div>}

            <button
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-semibold disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              {loading ? t('sending') : t('send')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}