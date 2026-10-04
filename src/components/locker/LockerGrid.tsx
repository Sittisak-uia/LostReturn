'use client';
import { motion } from "framer-motion";
import { LockerCard } from "./LockerCard";
import { Locker } from "@/types/locker";

interface LockerGridProps {
  lockers: Locker[];
  onLockerClick?: (locker: Locker) => void;
}

export function LockerGrid({ lockers, onLockerClick }: LockerGridProps) {
  return (
    <motion.div 
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.06,
          },
        },
      }}
    >
      {lockers.map((locker) => (
        <LockerCard
          key={locker.id}
          locker={locker}
          onClick={onLockerClick}
        />
      ))}
    </motion.div>
  );
}
