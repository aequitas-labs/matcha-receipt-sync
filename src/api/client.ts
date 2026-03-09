import type {
  CreateTransactionRequest,
  CreateTransactionResponse,
} from '../types/api';
import { FakeMatchaApiClient } from './fake';
import { RealMatchaApiClient } from './real';

export interface MatchaApiClient {
  createTransaction(
    req: CreateTransactionRequest
  ): Promise<CreateTransactionResponse>;
  isConnected(): Promise<boolean>;
}

export async function createApiClient(): Promise<MatchaApiClient> {
  const { useFakeApi } = await chrome.storage.local.get(['useFakeApi']);

  if (useFakeApi !== false) {
    return new FakeMatchaApiClient();
  }

  return new RealMatchaApiClient();
}
