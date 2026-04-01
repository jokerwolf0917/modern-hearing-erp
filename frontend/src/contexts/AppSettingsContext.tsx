import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import i18n from '../i18n';

export type AppLanguage = 'zh' | 'en';
export type DefaultStoreId = 'ALL' | string | null;
export type ReceiptLanguage = 'follow' | 'zh' | 'en';

export interface NotificationPreferences {
  appointmentReminder: boolean;
  repairDueReminder: boolean;
  lowStockReminder: boolean;
  orderSound: boolean;
}

export interface PrintPreferences {
  receiptLanguage: ReceiptLanguage;
  showWarrantyInfo: boolean;
  showDisclaimer: boolean;
}

export interface AppSettings {
  language: AppLanguage;
  defaultStoreId: DefaultStoreId;
  notifications: NotificationPreferences;
  print: PrintPreferences;
}

interface AppSettingsContextValue {
  settings: AppSettings;
  updateSettings: (next: Partial<AppSettings>) => void;
  replaceSettings: (next: AppSettings) => void;
  resetSettings: () => void;
}

const STORAGE_KEY = 'hearflow_app_settings';

const defaultSettings: AppSettings = {
  language: 'zh',
  defaultStoreId: 'ALL',
  notifications: {
    appointmentReminder: true,
    repairDueReminder: true,
    lowStockReminder: true,
    orderSound: false,
  },
  print: {
    receiptLanguage: 'follow',
    showWarrantyInfo: true,
    showDisclaimer: true,
  },
};

const AppSettingsContext = createContext<AppSettingsContextValue | undefined>(undefined);

function isValidLanguage(value: unknown): value is AppLanguage {
  return value === 'zh' || value === 'en';
}

function isValidReceiptLanguage(value: unknown): value is ReceiptLanguage {
  return value === 'follow' || value === 'zh' || value === 'en';
}

function normalizeSettings(raw: unknown): AppSettings {
  if (!raw || typeof raw !== 'object') {
    return defaultSettings;
  }

  const candidate = raw as Partial<AppSettings>;
  const notifications = (candidate.notifications ?? {}) as Partial<NotificationPreferences>;
  const print = (candidate.print ?? {}) as Partial<PrintPreferences>;

  return {
    language: isValidLanguage(candidate.language) ? candidate.language : defaultSettings.language,
    defaultStoreId:
      candidate.defaultStoreId === 'ALL' || typeof candidate.defaultStoreId === 'string' || candidate.defaultStoreId === null
        ? candidate.defaultStoreId
        : defaultSettings.defaultStoreId,
    notifications: {
      appointmentReminder:
        typeof notifications.appointmentReminder === 'boolean'
          ? notifications.appointmentReminder
          : defaultSettings.notifications.appointmentReminder,
      repairDueReminder:
        typeof notifications.repairDueReminder === 'boolean'
          ? notifications.repairDueReminder
          : defaultSettings.notifications.repairDueReminder,
      lowStockReminder:
        typeof notifications.lowStockReminder === 'boolean'
          ? notifications.lowStockReminder
          : defaultSettings.notifications.lowStockReminder,
      orderSound:
        typeof notifications.orderSound === 'boolean' ? notifications.orderSound : defaultSettings.notifications.orderSound,
    },
    print: {
      receiptLanguage: isValidReceiptLanguage(print.receiptLanguage)
        ? print.receiptLanguage
        : defaultSettings.print.receiptLanguage,
      showWarrantyInfo:
        typeof print.showWarrantyInfo === 'boolean' ? print.showWarrantyInfo : defaultSettings.print.showWarrantyInfo,
      showDisclaimer:
        typeof print.showDisclaimer === 'boolean' ? print.showDisclaimer : defaultSettings.print.showDisclaimer,
    },
  };
}

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultSettings;
    }
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return defaultSettings;
  }
}

export function AppSettingsProvider({ children }: PropsWithChildren): JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!i18n.language.startsWith(settings.language)) {
      void i18n.changeLanguage(settings.language);
    }
  }, [settings.language]);

  const value = useMemo<AppSettingsContextValue>(
    () => ({
      settings,
      updateSettings: (next) => {
        setSettings((current) =>
          normalizeSettings({
            ...current,
            ...next,
            notifications: {
              ...current.notifications,
              ...(next.notifications ?? {}),
            },
            print: {
              ...current.print,
              ...(next.print ?? {}),
            },
          }),
        );
      },
      replaceSettings: (next) => {
        setSettings(normalizeSettings(next));
      },
      resetSettings: () => {
        setSettings(defaultSettings);
      },
    }),
    [settings],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings(): AppSettingsContextValue {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error('useAppSettings must be used within AppSettingsProvider');
  }
  return context;
}
