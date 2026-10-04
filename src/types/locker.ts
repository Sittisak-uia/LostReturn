export type LockerStatus = 'empty' | 'occupied' | 'locked';

export interface SecurityQuestion {
  question: string;
  answer: string;
}

export interface Locker {
  id: number;
  status: LockerStatus;
  itemDescription?: string;
  depositedAt?: Date;
  otp?: string;
  otpExpiresAt?: Date;
  depositorName?: string;
  depositorContact?: string;
  securityQuestion?: SecurityQuestion;
  imageUrl?: string;
}

export interface DepositRecord {
  id: string;
  lockerId: number;
  itemDescription: string;
  depositorName: string;
  depositorContact: string;
  depositedAt: Date;
  collectedAt?: Date;
  status: 'deposited' | 'collected';
  securityQuestion?: SecurityQuestion;
}

export interface ChatMessage {
  id: string;
  sender: 'depositor' | 'claimer';
  message: string;
  timestamp: Date;
}

export interface VerificationResult {
  isMatch: boolean;
  confidence: number;
  reason?: string;
}

export interface OTPRequest {
  lockerId: number;
  action: 'deposit' | 'collect';
  otp: string;
  expiresAt: Date;
}
