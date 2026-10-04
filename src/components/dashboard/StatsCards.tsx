'use client';
import { Box, Package, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Locker } from "@/types/locker";

interface StatsCardsProps {
  lockers: Locker[];
}

export function StatsCards({ lockers }: StatsCardsProps) {
  const empty = lockers.filter((l) => l.status === "empty").length;
  const occupied = lockers.filter((l) => l.status === "occupied").length;
  const locked = lockers.filter((l) => l.status === "locked").length;
  const total = lockers.length;

  const stats = [
    {
      label: "ช่องทั้งหมด",
      value: total,
      icon: Box,
      color: "text-zinc-800",
      bg: "bg-zinc-100 border border-zinc-200",
    },
    {
      label: "ช่องว่าง",
      value: empty,
      icon: Box,
      color: "text-emerald-700",
      bg: "bg-emerald-50 border border-emerald-200 shadow-sm",
    },
    {
      label: "มีของฝาก",
      value: occupied,
      icon: Package,
      color: "text-amber-800",
      bg: "bg-amber-50 border border-amber-200 shadow-sm",
    },
    {
      label: "ล็อก/ซ่อม",
      value: locked,
      icon: Lock,
      color: "text-rose-700",
      bg: "bg-rose-50 border border-rose-200 shadow-sm",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.08 }}
        >
          <Card variant="default" className="overflow-hidden backdrop-blur-xl bg-white/85 border border-zinc-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-3.5">
                <div className={`p-3 rounded-2xl ${stat.bg}`}>
                  <stat.icon className={`w-5 h-5 ${stat.color} stroke-[1.8]`} />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-zinc-800 tracking-tight">{stat.value}</p>
                  <p className="text-xs text-zinc-500 font-normal">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
