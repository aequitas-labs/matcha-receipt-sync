/**
 * Extract Costco auth tokens from localStorage.
 * Only works in a content script running on costco.com.
 *
 * Costco uses MSAL (Azure AD B2C). The localStorage has:
 * - `clientID`: the tenant/app UUID
 * - `idToken`: a convenience copy of the JWT (may be stale)
 * - MSAL cache entries with keys like `...-idtoken-<clientId>----`
 *   containing `{ secret: "<jwt>" }` — these are authoritative
 *
 * We prefer the MSAL cache token as it's most likely to be current.
 */
export function extractCostcoTokens(): {
  clientId: string;
  idToken: string;
} | null {
  try {
    const clientId = localStorage.getItem('clientID');
    if (!clientId) return null;

    // Try to find the freshest MSAL id token
    const msalToken = findMsalIdToken();
    const simpleToken = localStorage.getItem('idToken');
    const idToken = msalToken ?? simpleToken;

    if (!idToken) return null;
    return { clientId, idToken };
  } catch {
    return null;
  }
}

/** Search localStorage for MSAL id token cache entries and return the freshest */
function findMsalIdToken(): string | null {
  let bestToken: string | null = null;
  let bestExp = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.includes('-idtoken-')) continue;

    try {
      const entry = JSON.parse(localStorage.getItem(key) ?? '');
      if (entry.credentialType === 'IdToken' && entry.secret) {
        // Decode JWT payload to check expiry
        const payload = JSON.parse(atob(entry.secret.split('.')[1]));
        if (payload.exp > bestExp) {
          bestExp = payload.exp;
          bestToken = entry.secret;
        }
      }
    } catch {
      // skip malformed entries
    }
  }

  return bestToken;
}
