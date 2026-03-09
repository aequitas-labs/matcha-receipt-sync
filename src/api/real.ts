import type { MatchaApiClient } from './client';
import type {
  CreateTransactionRequest,
  CreateTransactionResponse,
  BatchUpsertReceiptsRequest,
  BatchUpsertReceiptsResponse,
} from '../types/api';
import { getSessionCookie, buildAuthHeaders } from '../auth/session';
import { logRequest } from '../debug/logger';

export class RealMatchaApiClient implements MatchaApiClient {
  private async getBaseUrl(): Promise<string> {
    const { apiBaseUrl = 'https://matcha.money' } =
      await chrome.storage.local.get(['apiBaseUrl']);
    return apiBaseUrl;
  }

  async createTransaction(
    req: CreateTransactionRequest
  ): Promise<CreateTransactionResponse> {
    const baseUrl = await this.getBaseUrl();
    const cookie = await getSessionCookie();

    if (!cookie) {
      const error = 'Not authenticated - log in to matcha.money first';
      await logRequest({
        endpoint: '/api/v1/transactions',
        method: 'POST',
        payload: req,
        error,
      });
      throw new Error(error);
    }

    const url = `${baseUrl}/api/v1/transactions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: buildAuthHeaders(cookie),
      body: JSON.stringify(req),
    });

    if (!response.ok) {
      const errorText = await response.text();
      await logRequest({
        endpoint: '/api/v1/transactions',
        method: 'POST',
        payload: req,
        error: `${response.status}: ${errorText}`,
      });
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as CreateTransactionResponse;

    await logRequest({
      endpoint: '/api/v1/transactions',
      method: 'POST',
      payload: req,
      response: data,
    });

    return data;
  }

  async batchUpsertReceipts(
    req: BatchUpsertReceiptsRequest
  ): Promise<BatchUpsertReceiptsResponse> {
    const baseUrl = await this.getBaseUrl();
    const cookie = await getSessionCookie();

    if (!cookie) {
      const error = 'Not authenticated - log in to matcha.money first';
      await logRequest({
        endpoint: '/api/v1/receipts/batch',
        method: 'POST',
        payload: req,
        error,
      });
      throw new Error(error);
    }

    const url = `${baseUrl}/api/v1/receipts/batch`;
    const response = await fetch(url, {
      method: 'POST',
      headers: buildAuthHeaders(cookie),
      body: JSON.stringify(req),
    });

    if (!response.ok) {
      const errorText = await response.text();
      await logRequest({
        endpoint: '/api/v1/receipts/batch',
        method: 'POST',
        payload: req,
        error: `${response.status}: ${errorText}`,
      });
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as BatchUpsertReceiptsResponse;

    await logRequest({
      endpoint: '/api/v1/receipts/batch',
      method: 'POST',
      payload: req,
      response: data,
    });

    return data;
  }

  async isConnected(): Promise<boolean> {
    const cookie = await getSessionCookie();
    return cookie !== null;
  }
}
