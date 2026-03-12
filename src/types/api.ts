import type { LineItem, PaymentMethod } from '@matchamoney/api';

// Extension-only types (not shared with server)

export interface TransactionMetadata {
  retailer: string;
  orderId: string;
  orderUrl?: string;
  tax?: number;
  paymentMethods?: PaymentMethod[];
  items?: LineItem[];
}

export interface CreateTransactionRequest {
  name: string;
  /** Negative = expense (e.g. -42.99) */
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  account_id?: string;
  category?: string;
  notes?: string;
  metadata?: TransactionMetadata;
}

export interface CreateTransactionResponse {
  id: string;
  name: string;
  amount: number;
  date: string;
  category: string | null;
  notes: string | null;
  account_id: string;
  created_at: string;
}
