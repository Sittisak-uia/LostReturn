'use client';

import React from 'react';
import { Package, User, ShieldCheck, Eye, CheckCircle2, X } from 'lucide-react';
import { formatThaiDate } from '@/lib/formatters';
import type { EnrichedLockerTransaction } from './TransactionHistoryTable';

interface TransactionDetailModalProps {
  transaction: EnrichedLockerTransaction | null;
  onClose: () => void;
  onPreviewImage: (url: string) => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  onClose,
  onPreviewImage,
}) => {
  if (!transaction) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl border border-zinc-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 font-bold text-xs">
              ตู้ #{String(transaction.locker_id).padStart(2, '0')}
            </span>
            <h3 className="font-semibold text-zinc-900 text-sm sm:text-base">รายละเอียดการทำรายการ</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-zinc-200/80 text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Scrollable */}
        <div className="p-5 space-y-5 overflow-y-auto text-xs sm:text-sm">
          {/* Image Preview & Description */}
          <div className="flex gap-4 items-start">
            {transaction.image_url ? (
              <button
                type="button"
                onClick={() => onPreviewImage(transaction.image_url!)}
                className="w-24 h-24 rounded-2xl overflow-hidden border border-zinc-200 shrink-0 cursor-pointer relative group"
                title="คลิกดูภาพขนาดใหญ่"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={transaction.image_url} alt="Transaction preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                  <Eye className="w-4 h-4" />
                </div>
              </button>
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0 text-zinc-400">
                <Package className="w-8 h-8 opacity-50" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="mb-2">
                {transaction.status === 'deposited' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    อยู่ในตู้ (รอผู้มารับ)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ส่งมอบเรียบร้อยแล้ว
                  </span>
                )}
              </div>
              <p className="font-semibold text-zinc-900 text-sm sm:text-base leading-snug">
                {transaction.item_description}
              </p>
              <p className="text-[11px] text-zinc-400 font-mono mt-1 truncate" title={transaction.id}>
                ID: {transaction.id}
              </p>
            </div>
          </div>

          {/* Depositor Section */}
          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2">
            <div className="flex items-center gap-2 text-zinc-700 font-semibold text-xs uppercase tracking-wider">
              <User className="w-4 h-4 text-amber-600" />
              <span>ข้อมูลผู้ฝาก (Depositor)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
              <div>
                <span className="text-zinc-400 block text-[11px]">ชื่อผู้ฝาก:</span>
                <span className="font-medium text-zinc-800">
                  {transaction.depositor_profile?.full_name || transaction.depositor_name || transaction.depositor_profile?.username || '-'}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[11px]">เบอร์ติดต่อ:</span>
                <span className="font-medium text-zinc-800">
                  {transaction.depositor_contact || transaction.depositor_profile?.phone || '-'}
                </span>
              </div>
              {transaction.depositor_profile?.student_id && (
                <div>
                  <span className="text-zinc-400 block text-[11px]">รหัสนักศึกษา:</span>
                  <span className="font-medium text-zinc-800 font-mono">
                    {transaction.depositor_profile.student_id}
                  </span>
                </div>
              )}
              <div>
                <span className="text-zinc-400 block text-[11px]">เวลาที่ฝาก:</span>
                <span className="font-medium text-zinc-800">
                  {formatThaiDate(transaction.deposited_at || transaction.created_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Collector Section */}
          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2">
            <div className="flex items-center gap-2 text-zinc-700 font-semibold text-xs uppercase tracking-wider">
              <CheckCircle2 className={`w-4 h-4 ${transaction.status === 'collected' ? 'text-emerald-600' : 'text-zinc-400'}`} />
              <span>ข้อมูลผู้รับ (Collector)</span>
            </div>
            {transaction.status === 'collected' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                <div>
                  <span className="text-zinc-400 block text-[11px]">ชื่อผู้รับ:</span>
                  <span className="font-medium text-zinc-800">
                    {transaction.collector_profile?.full_name || transaction.collector_name || transaction.collector_profile?.username || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[11px]">เบอร์ติดต่อ:</span>
                  <span className="font-medium text-zinc-800">
                    {transaction.collector_contact || transaction.collector_profile?.phone || '-'}
                  </span>
                </div>
                {transaction.collector_profile?.student_id && (
                  <div>
                    <span className="text-zinc-400 block text-[11px]">รหัสนักศึกษา:</span>
                    <span className="font-medium text-zinc-800 font-mono">
                      {transaction.collector_profile.student_id}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-zinc-400 block text-[11px]">เวลาที่รับของ:</span>
                  <span className="font-medium text-zinc-800">
                    {formatThaiDate(transaction.collected_at)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 italic pt-1">
                ยังไม่มีผู้มารับของ รายการนี้ยังคงอยู่ในตู้ #{transaction.locker_id}
              </p>
            )}
          </div>

          {/* Security & Verification Section */}
          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/60 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>ข้อมูลการยืนยันตัวตนและความปลอดภัย</span>
            </div>

            <div className="space-y-2 pt-1 text-xs">
              {transaction.security_question && (
                <div>
                  <span className="text-zinc-500 block text-[11px]">คำถามความปลอดภัย:</span>
                  <span className="font-medium text-zinc-800">{transaction.security_question}</span>
                </div>
              )}

              {transaction.security_answer && (
                <div>
                  <span className="text-zinc-500 block text-[11px]">คำตอบความปลอดภัย:</span>
                  <span className="font-medium text-zinc-800 bg-white px-2 py-0.5 rounded border border-amber-200 inline-block">
                    {transaction.security_answer}
                  </span>
                </div>
              )}

              {transaction.otp && (
                <div className="flex flex-wrap items-center gap-2">
                  <div>
                    <span className="text-zinc-500 block text-[11px]">รหัส OTP ปลดล็อกล่าสุด:</span>
                    {transaction.otp === '******' ? (
                      <span className="font-mono text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200 inline-block text-xs" title="สงวนสิทธิ์ความปลอดภัยขณะสิ่งของยังอยู่ในตู้">
                        ****** (ซ่อนขณะอยู่ในตู้)
                      </span>
                    ) : (
                      <span className="font-mono font-bold text-amber-900 bg-amber-100/80 px-2.5 py-0.5 rounded border border-amber-300 inline-block tracking-widest text-sm">
                        {transaction.otp}
                      </span>
                    )}
                  </div>
                  {transaction.otp_generated_at && (
                    <span className="text-[11px] text-zinc-400 mt-4">
                      (สร้างเมื่อ {formatThaiDate(transaction.otp_generated_at)})
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
