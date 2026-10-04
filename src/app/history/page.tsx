'use client';

import { motion } from "framer-motion";
import { Package, CheckCircle, Clock, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLockerTransactions } from "@/hooks/useLockerTransactions";

const formatDate = (dateStr: string): string => {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(dateStr));
};

const HistoryPage = () => {
  const { transactions, loading } = useLockerTransactions();

  return (
    <div className="container mx-auto px-4 py-8 min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-800 tracking-tight">ประวัติการใช้งาน</h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-0.5 font-normal">บันทึกการฝากและรับคืนทรัพย์สิน</p>
      </motion.div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        </div>
      )}

      {!loading && (
        <div className="space-y-4">
          {transactions.map((record, index) => (
            <motion.div
              key={record.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.06 }}
            >
              <Card variant="default" className="overflow-hidden backdrop-blur-xl bg-white/85 border border-zinc-200 shadow-sm hover:border-amber-400/50 hover:shadow-md transition-all duration-300">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    <div className={`p-6 flex items-center justify-center ${
                      record.status === 'collected' ? 'bg-emerald-50' : 'bg-amber-50'
                    }`}>
                      {record.status === 'collected' ? (
                        <CheckCircle className="w-10 h-10 text-emerald-600" />
                      ) : (
                        <Package className="w-10 h-10 text-amber-700" />
                      )}
                    </div>
                    <div className="flex-1 p-5 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium text-zinc-800 text-base">{record.item_description}</h3>
                          <Badge variant={record.status === 'collected' ? 'success' : 'occupied'}>
                            {record.status === 'collected' ? 'รับคืนแล้ว' : 'รอรับคืน'}
                          </Badge>
                        </div>
                        <span className="text-xs text-zinc-500 font-normal">ช่อง {record.locker_id}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                        <div>
                          <p className="text-zinc-400 text-xs font-normal">ผู้ฝาก</p>
                          <p className="font-medium text-zinc-800 mt-0.5">{record.depositor_name}</p>
                        </div>
                        <div>
                          <p className="text-zinc-400 text-xs font-normal">ติดต่อ</p>
                          <p className="font-medium text-zinc-800 mt-0.5">{record.depositor_contact}</p>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-zinc-100 flex flex-wrap gap-4 text-xs text-zinc-500 font-normal">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          ฝากเมื่อ: {formatDate(record.deposited_at)}
                        </span>
                        {record.collected_at && (
                          <span className="flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            รับคืนเมื่อ: {formatDate(record.collected_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {!loading && transactions.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <div className="w-16 h-16 rounded-3xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mx-auto mb-3">
            <Package className="w-8 h-8 text-zinc-400" />
          </div>
          <p className="text-zinc-500 text-sm font-normal">ยังไม่มีประวัติการใช้งาน</p>
        </motion.div>
      )}
    </div>
  );
};

export default HistoryPage;
