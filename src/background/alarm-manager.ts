import { log } from '../utils/log';

const ALARM_NAME = 'matcha-receipt-sync';

export class AlarmManager {
  constructor(private onSync: () => Promise<void>) {}

  async initialize(): Promise<void> {
    const { syncIntervalHours = 24 } = await chrome.storage.local.get([
      'syncIntervalHours',
    ]);

    // 0 = manual only, don't create an alarm
    if (syncIntervalHours > 0) {
      const existing = await chrome.alarms.get(ALARM_NAME);
      if (!existing) {
        chrome.alarms.create(ALARM_NAME, {
          periodInMinutes: syncIntervalHours * 60,
          delayInMinutes: 1,
        });
      }
    }

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === ALARM_NAME) {
        log('[matcha] Alarm fired - opening retailer tabs for sync');
        this.onSync().catch(console.error);
      }
    });
  }
}
