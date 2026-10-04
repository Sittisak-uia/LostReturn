'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { Package, ArrowRight, MapPin, Clock, Loader2 } from 'lucide-react';
import { LockerTransaction } from '@/hooks/useLockerTransactions';

interface LockerSearchResultsProps {
  transactions: LockerTransaction[];
  loading: boolean;
  searchQuery: string;
  onLockerClick: (lockerId: number) => void;
}

export const LockerSearchResults = ({ 
  transactions, 
  loading, 
  searchQuery,
  onLockerClick 
}: LockerSearchResultsProps) => {
  if (!searchQuery.trim()) return null;

  // Filter transactions by item description
  const filteredTransactions = transactions.filter(t => 
    t.status === 'deposited' && 
    t.item_description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 pb-4">
        <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
          <div className="flex items-center justify-center gap-2 text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
            <span className="text-xs sm:text-sm font-normal">กำลังค้นหาตู้ล็อกเกอร์...</span>
          </div>
        </div>
      </div>
    );
  }

  if (filteredTransactions.length === 0) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 pb-4">
      <div className="backdrop-blur-xl bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-sm">
        {/* Header */}
        <div className="bg-amber-50 px-4 py-3 border-b border-amber-200">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 sm:w-5 sm:h-5 text-amber-700 stroke-[2]" />
            <h3 className="font-semibold text-xs sm:text-sm text-zinc-800">
              ตู้ล็อกเกอร์ที่มีของตรงกัน ({filteredTransactions.length})
            </h3>
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5 font-normal">
            กดเพื่อไปรับของจากตู้ล็อกเกอร์
          </p>
        </div>

        {/* Results */}
        <div className="divide-y divide-zinc-100">
          {filteredTransactions.map((transaction, index) => (
            <motion.button
              key={transaction.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              onClick={() => onLockerClick(transaction.locker_id)}
              className="w-full p-4 flex items-center gap-3.5 hover:bg-amber-50/40 transition-colors text-left group cursor-pointer"
            >
              {/* Locker number badge */}
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 text-zinc-900 flex flex-col items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
                <span className="text-[10px] font-semibold opacity-80">ตู้</span>
                <span className="text-base font-semibold leading-none">
                  {String(transaction.locker_id).padStart(2, '0')}
                </span>
              </div>

              {/* Item details */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-xs sm:text-sm text-zinc-800 truncate">
                  {transaction.item_description}
                </p>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-500 font-normal">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-600" />
                    {new Date(transaction.deposited_at).toLocaleDateString('th-TH', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-600" />
                    ผู้ฝาก: {transaction.depositor_name}
                  </span>
                </div>
              </div>

              {/* Arrow */}
              <div className="shrink-0">
                <div className="w-8 h-8 rounded-xl bg-amber-50 group-hover:bg-gradient-to-r group-hover:from-amber-400 group-hover:to-yellow-500 group-hover:text-zinc-900 text-amber-700 flex items-center justify-center transition-all">
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform stroke-[2]" />
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};
