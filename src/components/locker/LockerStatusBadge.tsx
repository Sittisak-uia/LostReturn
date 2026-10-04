import React from 'react';

interface LockerStatusBadgeProps {
  status: 'empty' | 'occupied' | 'locked' | 'available' | string;
  className?: string;
}

export const LockerStatusBadge: React.FC<LockerStatusBadgeProps> = ({ status, className = '' }) => {
  const getBadgeStyle = () => {
    switch (status) {
      case 'empty':
      case 'available':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'occupied':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'locked':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-zinc-100 text-zinc-600 border-zinc-200';
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'empty':
      case 'available':
        return 'ว่าง';
      case 'occupied':
        return 'มีของ';
      case 'locked':
        return 'ล็อก';
      default:
        return status;
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getBadgeStyle()} ${className}`}>
      {getLabel()}
    </span>
  );
};
