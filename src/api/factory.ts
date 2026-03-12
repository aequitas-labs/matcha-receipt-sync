import {
  MatchaApiClient,
  FakeMatchaApiClient,
  type IMatchaApiClient,
} from '@matchamoney/api';
import { getSessionCookie, buildAuthHeaders } from '../auth/session';

export async function createApiClient(): Promise<IMatchaApiClient> {
  const { useFakeApi } = await chrome.storage.local.get(['useFakeApi']);

  if (useFakeApi !== false) {
    return new FakeMatchaApiClient();
  }

  const { apiBaseUrl = 'https://matcha.money' } =
    await chrome.storage.local.get(['apiBaseUrl']);

  return new MatchaApiClient({
    baseUrl: apiBaseUrl,
    async getAuthHeaders() {
      const cookie = await getSessionCookie();
      if (!cookie) {
        throw new Error('Not authenticated - log in to matcha.money first');
      }
      return buildAuthHeaders(cookie);
    },
  });
}
