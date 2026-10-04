'use client';
import React from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SearchBar = ({ value, onChange, placeholder = 'ค้นหา' }: SearchBarProps) => {
  return (
    <div className="max-w-2xl mx-auto px-4 py-3">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 stroke-[2] pointer-events-none z-10" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-12 pr-4 py-3 bg-white border border-zinc-300 hover:border-zinc-400 rounded-xl text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-0 focus:shadow-none focus:border-zinc-900 shadow-sm transition-all"
        />
      </div>
    </div>
  );
};

