'use client';
import React from 'react';
import { Package, Search } from 'lucide-react';

interface StickyActionBarProps {
  onFinderClick: () => void;
  onReceiverClick: () => void;
}

export const StickyActionBar = ({
  onFinderClick,
  onReceiverClick,
}: StickyActionBarProps) => {
  return (
    <div className="bg-white/90 backdrop-blur-2xl border-b border-zinc-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all flex w-full py-2.5 sm:py-3">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 w-full">
        <div className="flex flex-row gap-2.5 sm:gap-3 items-center justify-center w-full">
          {/* Found Item (Deposit) */}
          <button
            onClick={onFinderClick}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 px-3 sm:px-4 min-h-[44px] sm:min-h-[48px] bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-zinc-900 rounded-xl font-semibold text-xs sm:text-sm transition-all shadow-md shadow-amber-500/20 hover:shadow-amber-400/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Package className="w-4 h-4 stroke-[2.2]" />
            <span className="whitespace-nowrap">ฝากของที่พบ</span>
          </button>

          {/* Lost Item (Receive) */}
          <button
            onClick={onReceiverClick}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 px-3 sm:px-4 min-h-[44px] sm:min-h-[48px] bg-white border border-zinc-300 hover:border-zinc-900 focus:border-zinc-900 active:border-zinc-900 text-zinc-800 hover:bg-zinc-50 rounded-xl font-semibold text-xs sm:text-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm outline-none"
          >
            <Search className="w-4 h-4 text-amber-500 stroke-[2.2]" />
            <span className="whitespace-nowrap">ตามหาของหาย</span>
          </button>
        </div>
      </div>
    </div>
  );
};
