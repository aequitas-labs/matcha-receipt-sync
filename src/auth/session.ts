import { log } from '../utils/log';

const MATCHA_URL = 'https://matcha.money';
const COOKIE_NAME = 'better-auth.session_token'; // used for building auth headers

// Chrome auto-applies __Secure- prefix to cookies with Secure attribute over HTTPS
const COOKIE_NAMES = [
  '__Secure-better-auth.session_token',
  'better-auth.session_token',
  '__Host-better-auth.session_token',
];

export interface SessionStatus {
  connected: boolean;
  cookieValue: string | null;
}

/** Read the BetterAuth session cookie from matcha.money */
export async function getSessionCookie(): Promise<string | null> {
  for (const name of COOKIE_NAMES) {
    try {
      const cookie = await chrome.cookies.get({ url: MATCHA_URL, name });
      if (!cookie) continue;
      if (cookie.expirationDate && cookie.expirationDate < Date.now() / 1000)
        continue;
      log(`[matcha] session cookie matched: ${name}`);
      return cookie.value;
    } catch {
      /* continue */
    }
  }
  return null;
}

/** Check if user is logged in to matcha.money */
export async function checkSession(): Promise<SessionStatus> {
  const cookieValue = await getSessionCookie();
  return {
    connected: cookieValue !== null,
    cookieValue,
  };
}

/** Build headers with session cookie for Matcha API requests */
export function buildAuthHeaders(cookieValue: string): Record<string, string> {
  return {
    Cookie: `${COOKIE_NAME}=${cookieValue}`,
    'Content-Type': 'application/json',
  };
}
