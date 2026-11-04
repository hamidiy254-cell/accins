'use client';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export function BackButton({ label = 'Retour', href, className = '' }: {
  label?: string;
  href?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      onClick={() => href ? router.push(href) : router.back()}
      className={`inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition group ${className}`}
    >
      <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition" />
      {label}
    </button>
  );
}