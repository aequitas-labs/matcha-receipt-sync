const COOKIE_NAME = 'better-auth.session_token';
const MATCHA_URL = 'https://matcha.money';

export interface SessionStatus {
  connected: boolean;
  cookieValue: string | null;
}

/** Read the BetterAuth session cookie from matcha.money */
export async function getSessionCookie(): Promise<string | null> {
  try {
    const cookie = await chrome.cookies.get({
      url: MATCHA_URL,
      name: COOKIE_NAME,
    });
    if (!cookie) return null;

    // Check if cookie is expired
    if (cookie.expirationDate && cookie.expirationDate < Date.now() / 1000) {
      return null;
    }

    return cookie.value;
  } catch {
    return null;
  }
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
