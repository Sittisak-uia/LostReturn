import { Locker, DepositRecord } from '@/types/locker';

// Mock data for demonstration
export const mockLockers: Locker[] = [
  { id: 1, status: 'empty' },
  { 
    id: 2, 
    status: 'occupied', 
    itemDescription: 'กระเป๋าสตางค์สีดำ', 
    depositedAt: new Date('2024-12-24T10:30:00'), 
    depositorName: 'สมชาย',
    securityQuestion: {
      question: 'บัตรใบหน้าสุดในกระเป๋าคือบัตรอะไร?',
      answer: 'บัตรประชาชน'
    }
  },
  { id: 3, status: 'empty' },
  { 
    id: 4, 
    status: 'occupied', 
    itemDescription: 'พวงกุญแจ', 
    depositedAt: new Date('2024-12-24T14:00:00'), 
    depositorName: 'สมหญิง',
    securityQuestion: {
      question: 'พวงกุญแจมีกี่ดอก?',
      answer: '3 ดอก'
    }
  },
  { id: 5, status: 'empty' },
  { id: 6, status: 'locked' },
];

export const mockRecords: DepositRecord[] = [
  {
    id: '1',
    lockerId: 2,
    itemDescription: 'กระเป๋าสตางค์สีดำ',
    depositorName: 'สมชาย ใจดี',
    depositorContact: '0812345678',
    depositedAt: new Date('2024-12-24T10:30:00'),
    status: 'deposited',
    securityQuestion: {
      question: 'บัตรใบหน้าสุดในกระเป๋าคือบัตรอะไร?',
      answer: 'บัตรประชาชน'
    }
  },
  {
    id: '2',
    lockerId: 4,
    itemDescription: 'พวงกุญแจ',
    depositorName: 'สมหญิง มีสุข',
    depositorContact: 'somying@email.com',
    depositedAt: new Date('2024-12-24T14:00:00'),
    status: 'deposited',
    securityQuestion: {
      question: 'พวงกุญแจมีกี่ดอก?',
      answer: '3 ดอก'
    }
  },
  {
    id: '3',
    lockerId: 1,
    itemDescription: 'โทรศัพท์มือถือ Samsung',
    depositorName: 'วิชัย รักเรียน',
    depositorContact: '0898765432',
    depositedAt: new Date('2024-12-23T09:15:00'),
    collectedAt: new Date('2024-12-23T16:45:00'),
    status: 'collected',
  },
];

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function getLockerStatusText(status: Locker['status']): string {
  switch (status) {
    case 'empty':
      return 'ว่าง';
    case 'occupied':
      return 'มีของ';
    case 'locked':
      return 'ล็อก';
    default:
      return 'ไม่ทราบ';
  }
}

export { formatDate } from './formatters';
