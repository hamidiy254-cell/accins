'use client';
import { useState } from 'react';

export function ProductGallery({ images, name }: { images: string[], name: string }) {
  const [active, setActive] = useState(0);
  
  if (!images || images.length === 0) {
    return (
      <div className="aspect-square bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400">
        Pas d image
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Image principale */}
      <div className="aspect-square bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden relative border border-slate-200 dark:border-slate-800">
        <img 
          src={images[active]} 
          alt={name} 
          className="w-full h-full object-cover transition-opacity duration-300" 
        />
      </div>
      
      {/* Miniatures (Thumbnails) */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {images.map((img, idx) => (
            <button 
              key={idx}
              onClick={() => setActive(idx)}
              className={`relative w-20 h-20 shrink-0 rounded-xl overflow-hidden border-2 transition-all ${active === idx ? 'border-indigo-600 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`}
            >
              <img src={img} alt={`${name} ${idx}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}