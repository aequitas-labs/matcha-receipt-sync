import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Check, AlertCircle, RefreshCw, ChevronLeft } from './ui/Icons';
import { RETAILERS } from '../constants';
import { checkSession } from '../../auth/session';

export type OnboardingStep =
  | 'welcome'
  | 'retailers'
  | 'login-check'
  | 'matcha-check'
  | 'sync-date'
  | 'ready';

const STEPS: OnboardingStep[] = [
  'welcome',
  'retailers',
  'login-check',
  'matcha-check',
  'sync-date',
  'ready',
];

const RETAILER_LOGIN_URLS: Record<string, string> = {
  amazon: 'https://www.amazon.com/ap/signin',
  costco: 'https://www.costco.com/LogonForm',
  walmart: 'https://www.walmart.com/account/login',
  target: 'https://www.target.com/login',
};

// Cookie names to check for each retailer (presence = likely logged in)
const RETAILER_AUTH_COOKIES: Record<string, { url: string; names: string[] }> =
  {
    amazon: {
      url: 'https://www.amazon.com',
      names: ['session-id', 'x-main', 'at-main'],
    },
    costco: {
      url: 'https://www.costco.com',
      names: ['C_LOC', 'cos_hash'],
    },
    walmart: {
      url: 'https://www.walmart.com',
      names: ['_m', 'auth'],
    },
    target: {
      url: 'https://www.target.com',
      names: ['accessToken', 'idToken'],
    },
  };

function StepIndicator({
  current,
  total,
  onBack,
}: {
  current: number;
  total: number;
  onBack: (() => void) | null;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <button
        onClick={onBack ?? undefined}
        className={`p-0.5 -ml-1 rounded transition-colors ${
          onBack
            ? 'text-muted-foreground hover:text-foreground cursor-pointer'
            : 'text-transparent pointer-events-none'
        }`}
        aria-label="Go back"
      >
        <ChevronLeft size={14} />
      </button>
      <div className="flex items-center gap-1 flex-1">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= current ? 'bg-primary' : 'bg-border'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Presentational (View) component ─────────────────────────────── */

export interface OnboardingViewPresentationProps {
  step: OnboardingStep;
  selectedRetailers: Set<string>;
  loginStatus: Record<string, 'checking' | 'logged-in' | 'not-logged-in'>;
  matchaConnected: boolean | null;
  syncFromDate: string;
  onStepChange: (step: OnboardingStep) => void;
  onRetailerToggle: (id: string) => void;
  onSyncFromDateChange: (value: string) => void;
  onLoginRecheck: () => void;
  onMatchaRecheck: () => void;
  onOpenUrl: (url: string) => void;
  onComplete: (triggerSync: boolean) => void;
  onSkip: () => void;
}

export function OnboardingViewPresentation({
  step,
  selectedRetailers,
  loginStatus,
  matchaConnected,
  syncFromDate,
  onStepChange,
  onRetailerToggle,
  onSyncFromDateChange,
  onLoginRecheck,
  onMatchaRecheck,
  onOpenUrl,
  onComplete,
  onSkip,
}: OnboardingViewPresentationProps) {
  const stepIndex = STEPS.indexOf(step);
  const canGoBack = stepIndex > 0;
  const handleBack = canGoBack
    ? () => onStepChange(STEPS[stepIndex - 1])
    : null;

  return (
    <div className="p-4 h-[480px] flex flex-col animate-fade-in">
      <StepIndicator
        current={stepIndex}
        total={STEPS.length}
        onBack={handleBack}
      />
      <div key={step} className="flex-1 overflow-y-auto animate-fade-in">
      {step === 'welcome' && (
        <div className="space-y-4">
          <div className="text-center space-y-2">
            <h1 className="font-sans text-lg font-bold text-foreground">
              sync your orders automatically
            </h1>
            <p className="text-xs text-muted-foreground">
              matcha money syncs your receipts from these retailers:
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {RETAILERS.map((r) => (
              <Card key={r.id}>
                <div className="text-center py-1">
                  <span className="text-2xl">{r.icon}</span>
                  <p className="text-xs font-medium text-foreground mt-1">
                    {r.name}
                  </p>
                </div>
              </Card>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            We collect anonymous usage analytics to improve the product. You can
            change this in Settings.
          </p>

          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => onStepChange('retailers')}
            >
              Get started
            </Button>
            <button
              onClick={onSkip}
              className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer text-center"
            >
              Skip setup
            </button>
          </div>
        </div>
      )}

      {step === 'retailers' && (
        <div className="space-y-3">
          <h2 className="font-sans text-sm font-semibold text-foreground">
            Which retailers do you use?
          </h2>
          <p className="text-xs text-muted-foreground">
            Uncheck any you don't want to sync.
          </p>

          <div className="space-y-2">
            {RETAILERS.map((r) => (
              <Card key={r.id} onClick={() => onRetailerToggle(r.id)}>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRetailers.has(r.id)}
                    onChange={() => onRetailerToggle(r.id)}
                    className="rounded border-border accent-primary"
                  />
                  <span className="text-lg">{r.icon}</span>
                  <span className="text-xs font-medium text-foreground">
                    {r.name}
                  </span>
                </label>
              </Card>
            ))}
          </div>

          {selectedRetailers.size === 0 && (
            <p className="text-[10px] text-destructive">
              Select at least one retailer to continue.
            </p>
          )}

          <Button
            variant="primary"
            size="md"
            className="w-full"
            disabled={selectedRetailers.size === 0}
            onClick={() => onStepChange('login-check')}
          >
            Continue
          </Button>
        </div>
      )}

      {step === 'login-check' && (
        <div className="space-y-3">
          <h2 className="font-sans text-sm font-semibold text-foreground">
            Checking retailer logins...
          </h2>
          <p className="text-xs text-muted-foreground">
            Make sure you're logged in so we can access your order history.
          </p>

          <div className="space-y-2">
            {[...selectedRetailers].map((id) => {
              const retailer = RETAILERS.find((r) => r.id === id);
              if (!retailer) return null;
              const status = loginStatus[id];
              return (
                <Card key={id}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{retailer.icon}</span>
                      <span className="text-xs font-medium text-foreground">
                        {retailer.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {status === 'checking' && (
                        <RefreshCw
                          size={12}
                          className="animate-spin text-muted-foreground"
                        />
                      )}
                      {status === 'logged-in' && (
                        <div className="flex items-center gap-1 text-success">
                          <Check size={12} />
                          <span className="text-[10px]">Logged in</span>
                        </div>
                      )}
                      {status === 'not-logged-in' && (
                        <div className="flex items-center gap-1.5">
                          <AlertCircle size={12} className="text-destructive" />
                          <button
                            onClick={() =>
                              onOpenUrl(RETAILER_LOGIN_URLS[id] ?? retailer.url)
                            }
                            className="text-[10px] text-primary hover:underline cursor-pointer"
                          >
                            Log in
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {Object.values(loginStatus).some((s) => s === 'not-logged-in') && (
            <Button variant="secondary" size="sm" onClick={onLoginRecheck}>
              <RefreshCw size={12} />
              Re-check
            </Button>
          )}

          <p className="text-[10px] text-muted-foreground">
            You can continue even if not logged in — sync will retry later.
          </p>

          <Button
            variant="primary"
            size="md"
            className="w-full"
            disabled={Object.values(loginStatus).some((s) => s === 'checking')}
            onClick={() => onStepChange('matcha-check')}
          >
            Continue
          </Button>
        </div>
      )}

      {step === 'matcha-check' && (
        <div className="space-y-3">
          <h2 className="font-sans text-sm font-semibold text-foreground">
            matcha money account
          </h2>

          <Card>
            {matchaConnected === null ? (
              <div className="flex items-center gap-2 py-1">
                <RefreshCw
                  size={14}
                  className="animate-spin text-muted-foreground"
                />
                <span className="text-xs text-muted-foreground">
                  Checking connection...
                </span>
              </div>
            ) : matchaConnected ? (
              <div className="flex items-center gap-1.5 text-success py-1">
                <Check size={14} />
                <span className="text-xs">Connected to matcha.money</span>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Know exactly where your money goes. matcha money builds your
                  budget automatically from real bank and purchase data.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onOpenUrl('https://matcha.money/sign-up')}
                  >
                    Create Account
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onOpenUrl('https://matcha.money/sign-in')}
                  >
                    Log In
                  </Button>
                </div>
                <Button variant="ghost" size="sm" onClick={onMatchaRecheck}>
                  <RefreshCw size={12} />
                  Re-check
                </Button>
              </div>
            )}
          </Card>

          <p className="text-[10px] text-muted-foreground">
            Without a matcha account, receipts are stored locally only.
          </p>

          <Button
            variant="primary"
            size="md"
            className="w-full"
            disabled={matchaConnected === null}
            onClick={() => onStepChange('sync-date')}
          >
            Continue
          </Button>
        </div>
      )}

      {step === 'sync-date' && (
        <div className="space-y-3">
          <h2 className="font-sans text-sm font-semibold text-foreground">
            How far back should we sync?
          </h2>
          <p className="text-xs text-muted-foreground">
            We'll import orders placed after this date.
          </p>

          <Card>
            <input
              type="date"
              value={syncFromDate}
              onChange={(e) => onSyncFromDateChange(e.target.value)}
              className="w-full text-xs bg-muted border border-border rounded-md px-2 py-1.5 text-foreground"
            />
            {syncFromDate && new Date(syncFromDate + 'T00:00:00') > new Date() && (
              <p className="text-[10px] text-warning mt-1.5">
                This date is in the future — no orders will be synced until then.
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Default: 1 year ago. Further back = longer first sync.
            </p>
          </Card>

          <Button
            variant="primary"
            size="md"
            className="w-full"
            onClick={() => onStepChange('ready')}
          >
            Continue
          </Button>
        </div>
      )}

      {step === 'ready' && (
        <div className="space-y-3">
          <h2 className="font-sans text-sm font-semibold text-foreground">
            You're all set!
          </h2>

          <Card>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <Check size={12} className="text-success" />
                <span className="text-foreground">
                  {selectedRetailers.size} retailer
                  {selectedRetailers.size !== 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                {matchaConnected ? (
                  <Check size={12} className="text-success" />
                ) : (
                  <AlertCircle size={12} className="text-muted-foreground" />
                )}
                <span className="text-foreground">
                  {matchaConnected
                    ? 'Connected to matcha.money'
                    : 'matcha account not connected'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {syncFromDate && new Date(syncFromDate + 'T00:00:00') > new Date() ? (
                  <AlertCircle size={12} className="text-warning" />
                ) : (
                  <Check size={12} className="text-success" />
                )}
                <span className="text-foreground">
                  Syncing from {new Date(syncFromDate + 'T00:00:00').toLocaleDateString()}
                  {syncFromDate && new Date(syncFromDate + 'T00:00:00') > new Date()
                    ? ' (future)'
                    : ''}
                </span>
              </div>
            </div>
          </Card>

          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={() => onComplete(true)}
            >
              Sync now
            </Button>
            <Button
              variant="secondary"
              size="md"
              className="w-full"
              onClick={() => onComplete(false)}
            >
              Do it later
            </Button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

/* ── Smart (container) component ─────────────────────────────────── */

interface OnboardingViewProps {
  onComplete: (triggerSync: boolean) => void;
}

export function OnboardingView({ onComplete }: OnboardingViewProps) {
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [selectedRetailers, setSelectedRetailers] = useState<Set<string>>(
    new Set(RETAILERS.map((r) => r.id))
  );
  const [loginStatus, setLoginStatus] = useState<
    Record<string, 'checking' | 'logged-in' | 'not-logged-in'>
  >({});
  const [matchaConnected, setMatchaConnected] = useState<boolean | null>(null);
  const [syncFromDate, setSyncFromDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  });

  const handleRetailerToggle = (id: string) => {
    setSelectedRetailers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const checkRetailerAuth = useCallback(
    async (retailerId: string): Promise<boolean> => {
      const config = RETAILER_AUTH_COOKIES[retailerId];
      if (!config) return false;
      for (const name of config.names) {
        try {
          const cookie = await chrome.cookies.get({ url: config.url, name });
          if (cookie) return true;
        } catch {
          /* continue */
        }
      }
      return false;
    },
    []
  );

  const runLoginChecks = useCallback(async () => {
    const retailers = [...selectedRetailers];
    const initial: Record<string, 'checking'> = {};
    for (const id of retailers) initial[id] = 'checking';
    setLoginStatus(initial);

    const results: Record<string, 'logged-in' | 'not-logged-in'> = {};
    await Promise.all(
      retailers.map(async (id) => {
        const loggedIn = await checkRetailerAuth(id);
        results[id] = loggedIn ? 'logged-in' : 'not-logged-in';
      })
    );
    setLoginStatus(results);
  }, [selectedRetailers, checkRetailerAuth]);

  useEffect(() => {
    if (step === 'login-check') runLoginChecks();
  }, [step, runLoginChecks]);

  useEffect(() => {
    if (step === 'matcha-check') {
      setMatchaConnected(null);
      checkSession().then((s) => setMatchaConnected(s.connected));
    }
  }, [step]);

  const handleComplete = async (triggerSync: boolean) => {
    // Seed syncStatus for logged-in retailers so main view shows green dots
    const { syncStatus = {} } = await chrome.storage.local.get('syncStatus');
    for (const [id, s] of Object.entries(loginStatus)) {
      if (s !== 'logged-in') continue;
      if (syncStatus[id]?.lastSyncedAt) continue; // don't overwrite real sync data
      const retailer = RETAILERS.find((r) => r.id === id);
      syncStatus[id] = {
        retailerId: id,
        retailerName: retailer?.name ?? id,
        lastSyncedAt: new Date().toISOString(),
        transactionCount: 0,
        lastError: null,
      };
    }
    await chrome.storage.local.set({
      enabledRetailers: [...selectedRetailers],
      syncFromDate: syncFromDate || null,
      firstRun: false,
      syncStatus,
    });
    onComplete(triggerSync);
  };

  const handleSkip = () => {
    chrome.storage.local.set({ firstRun: false });
    onComplete(false);
  };

  const handleMatchaRecheck = () => {
    setMatchaConnected(null);
    checkSession().then((s) => setMatchaConnected(s.connected));
  };

  const handleOpenUrl = (url: string) => {
    chrome.tabs.create({ url });
  };

  return (
    <OnboardingViewPresentation
      step={step}
      selectedRetailers={selectedRetailers}
      loginStatus={loginStatus}
      matchaConnected={matchaConnected}
      syncFromDate={syncFromDate}
      onStepChange={setStep}
      onRetailerToggle={handleRetailerToggle}
      onSyncFromDateChange={setSyncFromDate}
      onLoginRecheck={runLoginChecks}
      onMatchaRecheck={handleMatchaRecheck}
      onOpenUrl={handleOpenUrl}
      onComplete={handleComplete}
      onSkip={handleSkip}
    />
  );
}
