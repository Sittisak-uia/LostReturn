'use client';

import React, { useState, useMemo } from 'react';
import { 
  Package, Search, RefreshCw, User, 
  Eye, CheckCircle2, X
} from 'lucide-react';
import { formatThaiShortDate } from '@/lib/formatters';
import { TransactionDetailModal } from './TransactionDetailModal';
import { ImageLightbox } from './ImageLightbox';

export interface EnrichedLockerTransaction {
  id: string;
  locker_id: number;
  item_description: string;
  image_url: string | null;
  status: string; // 'deposited' | 'collected'
  created_at: string;
  deposited_at: string;
  depositor_name: string;
  depositor_contact: string;
  user_id: string | null;
  collected_at: string | null;
  collector_name: string | null;
  collector_contact: string | null;
  collector_user_id: string | null;
  security_question: string | null;
  security_answer: string | null;
  otp: string | null;
  otp_generated_at: string | null;
  locked_by?: string | null;
  locked_until?: string | null;
  lock_reason?: string | null;
  depositor_profile?: {
    user_id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    phone: string | null;
    student_id: string | null;
  } | null;
  collector_profile?: {
    user_id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    phone: string | null;
    student_id: string | null;
  } | null;
}

interface TransactionHistoryTableProps {
  transactions: EnrichedLockerTransaction[];
  loading: boolean;
  onRefresh: () => void;
}

type StatusFilter = 'all' | 'deposited' | 'collected';

export const TransactionHistoryTable: React.FC<TransactionHistoryTableProps> = ({
  transactions,
  loading,
  onRefresh
}) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTx, setSelectedTx] = useState<EnrichedLockerTransaction | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Filter & Search logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // 1. Status Filter
      if (statusFilter !== 'all' && tx.status !== statusFilter) {
        return false;
      }

      // 2. Search Query
      const rawQ = searchQuery.trim();
      if (!rawQ) return true;
      const q = rawQ.toLowerCase();

      // Locker normalization & flexible matching
      const lockerIdRaw = String(tx.locker_id ?? '').trim();
      const lockerIdNum = Number(tx.locker_id);
      const lockerPadded = !isNaN(lockerIdNum) ? String(lockerIdNum).padStart(2, '0') : lockerIdRaw;

      // Strip common prefixes: "ตู้", "locker", "#", spaces
      const qStripped = q.replace(/^(ตู้|locker)\s*/i, '').replace(/^#\s*/, '').trim();

      const isLockerMatch =
        // Numeric match: e.g. "1" or "01" matches locker 1
        (qStripped !== '' && !isNaN(Number(qStripped)) && !isNaN(lockerIdNum) && Number(qStripped) === lockerIdNum) ||
        // Exact string matches
        qStripped === lockerIdRaw ||
        qStripped === lockerPadded ||
        // Substring checks across common representations
        lockerIdRaw.includes(q) ||
        lockerPadded.includes(q) ||
        `#${lockerIdRaw}`.includes(q) ||
        `# ${lockerIdRaw}`.includes(q) ||
        `#${lockerPadded}`.includes(q) ||
        `# ${lockerPadded}`.includes(q) ||
        `ตู้${lockerIdRaw}`.includes(q) ||
        `ตู้ ${lockerIdRaw}`.includes(q) ||
        `ตู้${lockerPadded}`.includes(q) ||
        `ตู้ ${lockerPadded}`.includes(q) ||
        `ตู้ #${lockerIdRaw}`.includes(q) ||
        `ตู้ # ${lockerIdRaw}`.includes(q) ||
        `ตู้ #${lockerPadded}`.includes(q) ||
        `ตู้ # ${lockerPadded}`.includes(q) ||
        `locker ${lockerIdRaw}`.includes(q) ||
        `locker ${lockerPadded}`.includes(q) ||
        `locker #${lockerIdRaw}`.includes(q) ||
        `locker #${lockerPadded}`.includes(q) ||
        // If user simply types "ตู้" or "locker"
        (q === 'ตู้' || q === 'locker');

      // Item description
      const descStr = (tx.item_description || '').toLowerCase();
      const isItemMatch = descStr.includes(q);

      // Names (depositor / collector)
      const depName = (tx.depositor_name || tx.depositor_profile?.full_name || tx.depositor_profile?.username || '').toLowerCase();
      const colName = (tx.collector_name || tx.collector_profile?.full_name || tx.collector_profile?.username || '').toLowerCase();
      const isNameMatch = depName.includes(q) || colName.includes(q);

      // Contacts: require >= 3 characters or starts with 0 to prevent single digits from matching inside 10-digit phone numbers
      const depContact = (tx.depositor_contact || tx.depositor_profile?.phone || '').toLowerCase();
      const colContact = (tx.collector_contact || tx.collector_profile?.phone || '').toLowerCase();
      const isContactMatch = (q.length >= 3 || q.startsWith('0')) && (depContact.includes(q) || colContact.includes(q));

      // Security Question (public description, not private answer)
      const secQuestion = (tx.security_question || '').toLowerCase();
      const isSecMatch = secQuestion.includes(q);

      return isLockerMatch || isItemMatch || isNameMatch || isContactMatch || isSecMatch;
    });
  }, [transactions, statusFilter, searchQuery]);

  // Counts for tabs
  const depositedCount = useMemo(() => transactions.filter(t => t.status === 'deposited').length, [transactions]);
  const collectedCount = useMemo(() => transactions.filter(t => t.status === 'collected').length, [transactions]);

  return (
    <div className="space-y-4">
      {/* Header Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 rounded-2xl border border-zinc-200">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200/80'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <span>ทั้งหมด</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-200/80 text-zinc-700">
              {transactions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('deposited')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'deposited'
                ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/20'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>อยู่ในตู้</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === 'deposited' ? 'bg-amber-600 text-white' : 'bg-zinc-200/80 text-zinc-700'}`}>
              {depositedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('collected')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'collected'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>รับคืนแล้ว</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === 'collected' ? 'bg-emerald-700 text-white' : 'bg-zinc-200/80 text-zinc-700'}`}>
              {collectedCount}
            </span>
          </button>
        </div>

        {/* Search & Refresh Actions */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                if (val.trim() && statusFilter !== 'all') {
                  setStatusFilter('all');
                }
              }}
              placeholder="ค้นหาตู้และสิ่งของ"
              className="w-full pl-9 pr-8 py-2 bg-white border border-zinc-200 rounded-xl text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            title="รีเฟรชข้อมูล"
            className="p-2.5 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-xl text-zinc-700 hover:text-zinc-900 transition-colors shadow-sm disabled:opacity-50 cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && transactions.length === 0 ? (
        <div className="bg-white rounded-3xl border border-zinc-200 p-8 text-center space-y-3 shadow-sm">
          <RefreshCw className="w-8 h-8 mx-auto text-amber-500 animate-spin" />
          <p className="text-sm font-medium text-zinc-600">กำลังโหลดประวัติการทำรายการ...</p>
        </div>
      ) : filteredTransactions.length === 0 ? (
        /* Empty State */
        <div className="backdrop-blur-xl bg-white rounded-3xl border border-zinc-200 p-12 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center mx-auto mb-3 text-zinc-400">
            <Package className="w-6 h-6 opacity-60" />
          </div>
          <p className="text-sm font-semibold text-zinc-700">ไม่พบประวัติการทำรายการ</p>
          <p className="text-xs text-zinc-400 mt-1">
            {searchQuery
              ? statusFilter !== 'all'
                ? 'ไม่พบรายการที่ตรงกับคำค้นหาในสถานะนี้ ลองค้นหาในแท็บ "ทั้งหมด"'
                : 'ลองค้นหาด้วยเลขตู้หรือชื่อสิ่งของอื่น'
              : 'ยังไม่มีรายการฝากหรือรับของในระบบ'}
          </p>
          {searchQuery && (
            <div className="mt-3 flex items-center justify-center gap-3">
              {statusFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-colors cursor-pointer"
                >
                  ค้นหาใน &quot;ทั้งหมด&quot;
                </button>
              )}
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs font-semibold text-amber-600 hover:text-amber-700 cursor-pointer"
              >
                ล้างคำค้นหา
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ============================================================ */}
          {/* DESKTOP VIEW: Clean Structured Table (hidden on mobile)      */}
          {/* ============================================================ */}
          <div className="hidden md:block bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">ช่องตู้</th>
                    <th className="py-3 px-4">สิ่งของ</th>
                    <th className="py-3 px-4">ข้อมูลผู้ฝาก</th>
                    <th className="py-3 px-4">ข้อมูลผู้รับ</th>
                    <th className="py-3 px-4">สถานะ</th>
                    <th className="py-3 px-4">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                  {filteredTransactions.map((tx) => {
                    const isDeposited = tx.status === 'deposited';
                    const depProfile = tx.depositor_profile;
                    const colProfile = tx.collector_profile;

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors group">
                        {/* Locker ID (Clean number matching typography of user info) */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className="font-medium text-slate-800 text-xs">
                            {tx.locker_id}
                          </span>
                        </td>

                        {/* Item & Image Thumbnail */}
                        <td className="py-4 px-4 max-w-xs">
                          <div className="flex items-center gap-3">
                            {tx.image_url ? (
                              <button
                                type="button"
                                onClick={() => setPreviewImage(tx.image_url)}
                                title="คลิกเพื่อดูรูปขยาย"
                                className="relative w-11 h-11 rounded-lg overflow-hidden border border-slate-200 shrink-0 cursor-pointer group/img"
                              >
                                <img
                                  src={tx.image_url}
                                  alt={tx.item_description}
                                  className="w-full h-full object-cover transition-transform group-hover/img:scale-110"
                                />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                                  <Eye className="w-3.5 h-3.5" />
                                </div>
                              </button>
                            ) : (
                              <div className="w-11 h-11 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                                <Package className="w-5 h-5 opacity-60" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-slate-800 text-xs truncate" title={tx.item_description}>
                                {tx.item_description}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Depositor Info & Time */}
                        <td className="py-4 px-4">
                          <div className="flex items-start gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center text-xs font-bold overflow-hidden shrink-0 mt-0.5">
                              {depProfile?.avatar_url ? (
                                <img src={depProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                (tx.depositor_name || depProfile?.username || 'ผ').charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-800 text-xs">
                                {depProfile?.full_name || tx.depositor_name || depProfile?.username || 'ไม่ระบุชื่อ'}
                              </p>
                              <p className="text-xs text-slate-400 mt-0.5 font-normal">
                                {formatThaiShortDate(tx.deposited_at || tx.created_at)}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Collector Info & Time */}
                        <td className="py-4 px-4">
                          {isDeposited ? (
                            <span className="text-slate-300 font-normal text-sm pl-2 select-none" title="ยังไม่มีผู้รับ">
                              —
                            </span>
                          ) : (
                            <div className="flex items-start gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center text-xs font-bold overflow-hidden shrink-0 mt-0.5">
                                {colProfile?.avatar_url ? (
                                  <img src={colProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  (tx.collector_name || colProfile?.username || 'ร').charAt(0).toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-slate-800 text-xs">
                                  {colProfile?.full_name || tx.collector_name || colProfile?.username || 'ผู้รับของ'}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5 font-normal">
                                  {formatThaiShortDate(tx.collected_at)}
                                </p>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Status Badge (Minimal Pill with Dot) */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          {isDeposited ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              <span>อยู่ในตู้</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>รับคืนแล้ว</span>
                            </span>
                          )}
                        </td>

                        {/* Action / Detail (Ghost/Outline style) */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedTx(tx)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-medium transition-all cursor-pointer shadow-xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>ดูรายละเอียด</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ============================================================ */}
          {/* MOBILE VIEW: Responsive Cards (visible only on mobile)       */}
          {/* ============================================================ */}
          <div className="md:hidden space-y-3">
            {filteredTransactions.map((tx) => {
              const isDeposited = tx.status === 'deposited';
              const depProfile = tx.depositor_profile;
              const colProfile = tx.collector_profile;

              return (
                <div
                  key={tx.id}
                  className="backdrop-blur-xl bg-white rounded-3xl border border-slate-200/80 p-4 shadow-sm space-y-3"
                >
                  {/* Card Header: Locker # and Status */}
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800 text-xs">
                      ตู้ {tx.locker_id}
                    </span>

                    {isDeposited ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        อยู่ในตู้
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        รับคืนแล้ว
                      </span>
                    )}
                  </div>

                  {/* Card Body: Item Image & Description */}
                  <div className="flex items-start gap-3">
                    {tx.image_url ? (
                      <button
                        type="button"
                        onClick={() => setPreviewImage(tx.image_url)}
                        className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 shrink-0 cursor-pointer"
                      >
                        <img src={tx.image_url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                        <Package className="w-6 h-6 opacity-50" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 text-xs">{tx.item_description}</p>
                    </div>
                  </div>

                  {/* Timeline: Depositor & Collector */}
                  <div className="bg-slate-50/70 rounded-2xl p-3 space-y-2 border border-slate-100 text-xs">
                    {/* Depositor */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium text-slate-800">
                          {depProfile?.full_name || tx.depositor_name || 'ผู้ฝาก'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 shrink-0 font-normal">
                        {formatThaiShortDate(tx.deposited_at || tx.created_at)}
                      </span>
                    </div>

                    {/* Collector */}
                    <div className="flex items-start justify-between gap-2 pt-1.5 border-t border-slate-200/60">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <CheckCircle2 className={`w-3.5 h-3.5 ${isDeposited ? 'text-slate-300' : 'text-emerald-600'}`} />
                        <span className={`font-medium ${isDeposited ? 'text-slate-400' : 'text-slate-800'}`}>
                          {isDeposited ? '—' : (colProfile?.full_name || tx.collector_name || 'ผู้รับของ')}
                        </span>
                      </div>
                      {!isDeposited && tx.collected_at && (
                        <span className="text-xs text-slate-400 shrink-0 font-normal">
                          {formatThaiShortDate(tx.collected_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Footer Action */}
                  <button
                    type="button"
                    onClick={() => setSelectedTx(tx)}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs transition-all cursor-pointer shadow-xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>ดูรายละเอียดรายการ</span>
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ============================================================ */}
      {/* DETAIL MODAL: Deep Inspection of Selected Transaction        */}
      {/* ============================================================ */}
      <TransactionDetailModal
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
        onPreviewImage={(url) => setPreviewImage(url)}
      />

      {/* ============================================================ */}
      {/* LIGHTBOX: High-Resolution Image Preview                      */}
      {/* ============================================================ */}
      <ImageLightbox
        imageUrl={previewImage}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
};
