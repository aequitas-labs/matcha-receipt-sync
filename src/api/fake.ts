import type { MatchaApiClient } from './client';
import type {
  CreateTransactionRequest,
  CreateTransactionResponse,
} from '../types/api';
import { logRequest } from '../debug/logger';

let nextId = 1;

export class FakeMatchaApiClient implements MatchaApiClient {
  async createTransaction(
    req: CreateTransactionRequest
  ): Promise<CreateTransactionResponse> {
    const transaction: CreateTransactionResponse = {
      id: `fake_txn_${nextId++}`,
      name: req.name,
      amount: req.amount,
      date: req.date,
      category: req.category ?? null,
      notes: req.notes ?? null,
      account_id: req.account_id ?? 'fake_cash_account',
      created_at: new Date().toISOString(),
    };

    await logRequest({
      endpoint: '/api/v1/transactions',
      method: 'POST',
      payload: req,
      response: transaction,
    });

    // Simulate network latency
    await new Promise((r) => setTimeout(r, 50));
    return transaction;
  }

  async isConnected(): Promise<boolean> {
    return true;
  }
}
