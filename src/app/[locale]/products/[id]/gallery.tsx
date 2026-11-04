'use client';
import { useState } from 'react';
import { ImageOff } from 'lucide-react';

export function ProductGallery({ images, name }: { images: string[], name: string }) {
  const [active, setActive] = useState(0);
  
  if (!images || images.length === 0) {
    return (
      <div className="aspect-square bg-slate-100 dark:bg-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-400 border border-slate-200 dark:border-slate-800">
        <ImageOff size={48} className="mb-2 opacity-50" />
        <span className="text-sm font-medium">Pas d'image</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col-reverse md:flex-row gap-4">
      {/* Miniatures (à gauche sur desktop, en bas sur mobile) */}
      {images.length > 1 && (
        <div className="flex md:flex-col gap-3 overflow-x-auto md:overflow-visible pb-2 md:pb-0 md:w-24 shrink-0 custom-scrollbar">
          {images.map((img, idx) => (
            <button 
              key={idx}
              onMouseEnter={() => setActive(idx)} // Change au survol sur PC
              onClick={() => setActive(idx)}      // Change au clic sur Mobile
              className={`relative w-20 h-20 md:w-full md:h-24 shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                active === idx ? 'border-indigo-600 shadow-md' : 'border-slate-200 dark:border-slate-700 opacity-70 hover:opacity-100'
              }`}
            >
              <img src={img} alt={`${name} ${idx}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Image principale */}
      <div className="flex-1 aspect-square bg-white dark:bg-slate-900 rounded-2xl overflow-hidden relative border border-slate-200 dark:border-slate-800 shadow-sm group">
        <img 
          src={images[active]} 
          alt={name} 
          className="w-full h-full object-contain p-4 transition-transform duration-500 group-hover:scale-105" 
        />
      </div>
    </div>
  );
}