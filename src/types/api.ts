export interface TransactionMetadata {
  retailer: string;
  orderId: string;
  orderUrl?: string;
  tax?: number;
  paymentMethods?: { type: string; last4?: string }[];
  items?: {
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    /** Per-unit cost including proportional share of tax and shipping */
    effectivePrice?: number;
  }[];
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

export interface BatchUpsertReceiptsRequest {
  receipts: Array<{
    retailer: string;
    orderId: string;
    orderDate: string;
    totalAmount: number;
    tax?: number;
    orderUrl?: string;
    paymentMethods?: { type: string; last4?: string }[];
    items: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      /** Per-unit cost including proportional share of tax and shipping */
      effectivePrice?: number;
    }>;
  }>;
}

export interface BatchUpsertReceiptsResponse {
  created: number;
  updated: number;
}
