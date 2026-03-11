import { PostHog } from 'posthog-js/dist/module.no-external';
import 'posthog-js/dist/exception-autocapture';
import type { EventName } from './events';

declare const POSTHOG_API_KEY: string;
declare const POSTHOG_HOST: string;

const STORAGE_KEY_DISTINCT_ID = 'posthog_distinct_id';

let instance: PostHog | null = null;
let initPromise: Promise<PostHog> | null = null;

/** Get or create a shared distinct ID persisted in chrome.storage.local */
async function getSharedDistinctId(): Promise<string> {
  const stored = await chrome.storage.local.get([STORAGE_KEY_DISTINCT_ID]);
  if (stored[STORAGE_KEY_DISTINCT_ID]) {
    return stored[STORAGE_KEY_DISTINCT_ID];
  }
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ [STORAGE_KEY_DISTINCT_ID]: id });
  return id;
}

/** Detect whether we're running in a service worker (no DOM) */
const isServiceWorker = typeof window === 'undefined' || typeof document === 'undefined';

/** Initialize and return the PostHog singleton */
export async function getPostHog(): Promise<PostHog> {
  if (instance) return instance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const distinctId = await getSharedDistinctId();
    const ph = new PostHog();

    if (!POSTHOG_API_KEY) {
      // No API key configured — return inert instance
      instance = ph;
      return ph;
    }

    ph.init(POSTHOG_API_KEY, {
      api_host: POSTHOG_HOST,
      bootstrap: { distinctID: distinctId },
      persistence: isServiceWorker ? 'memory' : 'localStorage',
      disable_external_dependency_loading: true,
      capture_pageview: !isServiceWorker,
      autocapture: !isServiceWorker,
      disable_session_recording: true,
      disable_surveys: true,
      error_tracking: {
        captureExtensionExceptions: true,
      },
    });

    instance = ph;
    return ph;
  })();

  return initPromise;
}

/** Capture an event. Fire-and-forget — never throws.
 *  Respects the analyticsEnabled setting; error events are always sent. */
export async function capture(
  event: EventName,
  properties?: Record<string, unknown>
): Promise<void> {
  try {
    // Error events are always sent regardless of opt-out (legitimate interest)
    if (event !== 'sync_error') {
      const { analyticsEnabled } = await chrome.storage.local.get('analyticsEnabled');
      if (analyticsEnabled === false) return;
    }
    const ph = await getPostHog();
    ph.capture(event, properties);
  } catch (err) {
    console.warn('[matcha] PostHog capture failed:', err);
  }
}

/** Identify a user — links anonymous ID to their real user ID */
export async function identify(
  userId: string,
  userProperties?: Record<string, unknown>
): Promise<void> {
  try {
    const ph = await getPostHog();
    ph.identify(userId, userProperties);
  } catch (err) {
    console.warn('[matcha] PostHog identify failed:', err);
  }
}

/** Reset identity (on logout). Generates a new anonymous ID. */
export async function resetIdentity(): Promise<void> {
  try {
    const ph = await getPostHog();
    ph.reset();
    // Persist the new anonymous ID so it's shared across contexts
    const newId = ph.get_distinct_id();
    await chrome.storage.local.set({ [STORAGE_KEY_DISTINCT_ID]: newId });
  } catch (err) {
    console.warn('[matcha] PostHog reset failed:', err);
  }
}
