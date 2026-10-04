'use client';
import { Box, Lock, Unlock, Package } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Locker, LockerStatus } from "@/types/locker";
import { getLockerStatusText } from "@/lib/locker-data";

interface LockerCardProps {
  locker: Locker;
  onClick?: (locker: Locker) => void;
}

const statusConfig: Record<LockerStatus, {
  icon: typeof Box;
  badgeClass: string;
  hoverClass: string;
  iconColor: string;
  iconBg: string;
}> = {
  empty: {
    icon: Unlock,
    badgeClass: "border-emerald-300 bg-emerald-50 text-emerald-700",
    hoverClass: "hover:border-emerald-400 hover:shadow-[0_8px_30px_rgba(16,185,129,0.12)]",
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50 border border-emerald-200",
  },
  occupied: {
    icon: Package,
    badgeClass: "border-amber-300 bg-amber-50 text-amber-800",
    hoverClass: "hover:border-amber-400 shadow-[0_4px_20px_rgba(245,158,11,0.08)]",
    iconColor: "text-amber-700",
    iconBg: "bg-amber-50 border border-amber-200",
  },
  locked: {
    icon: Lock,
    badgeClass: "bg-zinc-200 text-zinc-500",
    hoverClass: "",
    iconColor: "text-zinc-400",
    iconBg: "bg-zinc-100 border border-zinc-200",
  },
};

export function LockerCard({ locker, onClick }: LockerCardProps) {
  const config = statusConfig[locker.status];
  const Icon = config.icon;

  return (
    <motion.div
      whileHover={{ scale: locker.status !== 'locked' ? 1.02 : 1 }}
      whileTap={{ scale: locker.status !== 'locked' ? 0.98 : 1 }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-full"
    >
      <button
        onClick={() => locker.status !== 'locked' && onClick?.(locker)}
        disabled={locker.status === 'locked'}
        className={cn(
          "w-full h-full p-5 rounded-3xl bg-white border border-zinc-200/90 transition-all duration-300 group",
          "flex flex-col justify-between gap-3 text-left cursor-pointer shadow-sm",
          locker.status !== 'locked' ? config.hoverClass : "opacity-50 cursor-not-allowed"
        )}
      >
        <div className="flex items-center justify-between w-full">
          <span className="text-2xl font-semibold text-zinc-800 tracking-tight">
            {String(locker.id).padStart(2, '0')}
          </span>
          <span className={cn(
            "px-2.5 py-0.5 rounded-full text-[11px] font-medium border",
            config.badgeClass
          )}>
            {getLockerStatusText(locker.status)}
          </span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center py-6 w-full">
          {locker.imageUrl ? (
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-100 shadow-sm">
              <img 
                src={locker.imageUrl} 
                alt={locker.itemDescription || 'Item'} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            </div>
          ) : (
            <div className={cn(
              "p-3.5 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
              config.iconBg,
              config.iconColor
            )}>
              <Icon className="w-8 h-8 stroke-[1.8]" />
            </div>
          )}
        </div>

        <div className="w-full text-center">
          {locker.itemDescription ? (
            <p className="text-xs text-zinc-600 font-normal line-clamp-1 w-full">
              {locker.itemDescription}
            </p>
          ) : (
            <p className="text-xs text-zinc-400 font-normal line-clamp-1 w-full">
              {locker.status === 'empty' ? 'พร้อมใช้งาน' : 'ไม่มีรายการ'}
            </p>
          )}
        </div>
      </button>
    </motion.div>
  );
}
