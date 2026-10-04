'use client';
import React, { useState } from 'react';
import { MessageSquare, Search, ShieldCheck, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Locker {
  id: number;
  status: 'available' | 'occupied' | 'maintenance' | 'temp_storage';
}

interface UserData {
  name: string;
  type: 'student' | 'general';
  profileImage: string | null;
}

interface FeedHeaderProps {
  lockers: Locker[];
  currentUser: UserData | null;
  isAdmin?: boolean;
  unreadCount: number;
  onLoginClick: () => void;
  onProfileClick: () => void;
  onChatClick: () => void;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
}

export const FeedHeader = ({
  currentUser,
  isAdmin = false,
  unreadCount,
  onLoginClick,
  onProfileClick,
  onChatClick,
  searchQuery = '',
  onSearchChange
}: FeedHeaderProps) => {
  const router = useRouter();
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const handleProfileClick = () => {
    router.push('/profile');
  };

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    onSearchChange?.(value);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/45 backdrop-blur-2xl border-b border-white/40 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden transition-colors">
      {/* Ambient warm-light glow overlay behind the navbar */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-amber-500/[0.06] via-amber-500/[0.02] to-transparent pointer-events-none" />
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-96 h-20 bg-amber-400/20 blur-2xl rounded-full pointer-events-none -z-10" />

      <div className="max-w-2xl mx-auto px-2.5 sm:px-4 py-2 sm:py-3 w-full relative z-10">
        {/* Responsive Row: Logo + Search + User Actions in one single row on mobile and desktop */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-3 w-full flex-nowrap">
          {/* Brand Logo - Minimal Luxury Editorial */}
          <div className="flex items-center shrink-0">
            <span className="font-brand font-bold text-sm sm:text-xl tracking-tight text-zinc-950 uppercase select-none whitespace-nowrap">
              LOSTRETURN
            </span>
          </div>

          {/* Search Bar - Translucent Glass Input Pill */}
          <div className="relative flex-1 min-w-0 max-w-full">
            <Search className="absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-400 stroke-[2] pointer-events-none z-10" />
            <input
              type="text"
              placeholder="ค้นหา"
              className="w-full pl-7 sm:pl-10 pr-2.5 sm:pr-4 py-1.5 sm:py-2.5 rounded-xl border border-white/60 bg-white/60 backdrop-blur-md text-zinc-900 placeholder:text-zinc-400 font-normal focus:bg-white focus:outline-none focus:ring-0 focus:shadow-none focus:border-zinc-900 text-base md:text-sm shadow-sm transition-all"
              value={localSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>

          {/* User Actions */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {currentUser ? (
              <>
                {isAdmin && (
                  <button
                    onClick={() => router.push('/admin')}
                    className="p-1 sm:p-2 hover:bg-white/50 rounded-full transition-colors min-h-[32px] min-w-[32px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center cursor-pointer text-amber-600 shadow-sm shrink-0"
                    title="Admin Dashboard"
                  >
                    <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                )}
                <button
                  onClick={onChatClick}
                  className="relative p-1 sm:p-2 hover:bg-white/50 rounded-full transition-colors min-h-[32px] min-w-[32px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center cursor-pointer text-zinc-600 hover:text-zinc-800 shadow-sm shrink-0"
                >
                  <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-gradient-to-r from-amber-400 to-yellow-500 text-zinc-900 text-[9px] sm:text-[10px] rounded-full flex items-center justify-center font-bold shadow-sm">
                      {unreadCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={handleProfileClick}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/70 border border-amber-300 flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-amber-400 transition-all cursor-pointer shrink-0 shadow-sm"
                >
                  {currentUser.profileImage ? (
                    <img src={currentUser.profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs sm:text-sm font-bold text-amber-700">{currentUser.name.charAt(0)}</span>
                  )}
                </button>
              </>
            ) : (
              <button
                onClick={onLoginClick}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-transparent hover:bg-white/50 text-zinc-900 hover:text-amber-500 text-xs sm:text-sm rounded-xl font-semibold transition-all duration-200 cursor-pointer group shrink-0"
              >
                <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2] text-zinc-900 group-hover:text-amber-500 transition-colors" />
                <span className="text-zinc-900 group-hover:text-amber-500 transition-colors whitespace-nowrap">Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
