/**
 * Unified Date and Time Formatting Utilities
 */

/**
 * Format a Date or ISO string to Thai localized date/time.
 * Example: "24 ธ.ค. 2567 เวลา 10:30 น."
 */
export function formatThaiDate(dateInput: string | Date | number | null | undefined, includeTime = true): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return String(dateInput);

  const datePart = date.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  if (!includeTime) return datePart;

  const timePart = date.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${datePart} เวลา ${timePart} น.`;
}

/**
 * Format a Date to short Thai date: DD/MM/BBBB (e.g. "11/09/2569")
 */
export function formatThaiShortDate(dateInput: string | Date | number | null | undefined): string {
  if (!dateInput) return '-';
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '-';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const yearBE = date.getFullYear() + 543;

  return `${day}/${month}/${yearBE}`;
}

/**
 * Format a Date to relative time in Thai (e.g. "เมื่อสักครู่", "5 นาทีที่แล้ว", "2 วันที่แล้ว")
 */
export function getTimeAgo(dateInput: string | Date | number | null | undefined): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 0) return 'เมื่อสักครู่';
  if (diffInSeconds < 60) return 'เมื่อสักครู่';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} นาทีที่แล้ว`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ชั่วโมงที่แล้ว`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} วันที่แล้ว`;
  
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

/**
 * Format countdown seconds into MM:SS format.
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Standard date formatter
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
