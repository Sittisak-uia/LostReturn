'use client';

import React from 'react';
import { X } from 'lucide-react';

interface ImageLightboxProps {
  imageUrl: string | null;
  onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full max-h-[85vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt="Preview"
          className="max-w-full max-h-[80vh] object-contain rounded-2xl border border-white/20 shadow-2xl"
        />
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 w-9 h-9 rounded-full bg-white text-zinc-800 flex items-center justify-center shadow-lg hover:bg-zinc-100 cursor-pointer transition-colors"
          title="ปิด"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
