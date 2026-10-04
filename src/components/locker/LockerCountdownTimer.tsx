import React from 'react';
import { formatTime } from '@/lib/formatters';

interface LockerCountdownTimerProps {
  seconds: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export const LockerCountdownTimer: React.FC<LockerCountdownTimerProps> = ({
  seconds,
  prefix = 'รหัสจะหมดอายุใน',
  suffix = 'นาที',
  className = 'text-xs text-rose-600 font-medium',
}) => {
  if (seconds <= 0) return null;

  return (
    <p className={className}>
      {prefix} {formatTime(seconds)} {suffix}
    </p>
  );
};
