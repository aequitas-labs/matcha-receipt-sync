import { getSessionCookie, buildAuthHeaders } from '../auth/session';
import { identify, resetIdentity, getPostHog } from './posthog';

const STORAGE_KEY_IDENTIFIED = 'posthogIdentifiedUser';

/**
 * Attempt to identify the current user via the Matcha session.
 * - If logged in and not yet identified, fetches user info from the API
 * - If logged out but was previously identified, resets to anonymous
 * - Silently no-ops on any failure
 */
export async function tryIdentify(): Promise<void> {
  try {
    const cookie = await getSessionCookie();

    if (!cookie) {
      // Check if we were previously identified and should reset
      const { [STORAGE_KEY_IDENTIFIED]: identified } =
        await chrome.storage.local.get(STORAGE_KEY_IDENTIFIED);
      if (identified) {
        await chrome.storage.local.remove(STORAGE_KEY_IDENTIFIED);
        await resetIdentity();
      }
      return;
    }

    // Already identified this session?
    const { [STORAGE_KEY_IDENTIFIED]: identified } =
      await chrome.storage.local.get(STORAGE_KEY_IDENTIFIED);
    if (identified) return;

    // Fetch user info from Matcha API
    const { apiBaseUrl = 'https://matcha.money' } =
      await chrome.storage.local.get('apiBaseUrl');
    const res = await fetch(`${apiBaseUrl}/api/auth/get-session`, {
      headers: buildAuthHeaders(cookie),
    });
    if (!res.ok) return;

    const data = (await res.json()) as {
      user?: { id?: string; email?: string; name?: string };
    };
    const userId = data.user?.id;
    if (!userId) return;

    await identify(userId, {
      email: data.user?.email,
      name: data.user?.name,
    });
    await chrome.storage.local.set({ [STORAGE_KEY_IDENTIFIED]: true });
  } catch {
    // Silently fail — will retry next time
  }
}
