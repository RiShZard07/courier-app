import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { asyncStorageSettings, type SettingsStorage } from '../storage/settingsStorage';
import { defaultSettings, type CourierIdentity, type Settings } from './settings';

export interface SettingsContextValue {
  settings: Settings;
  /** False until the saved settings have been read from storage on launch. */
  hydrated: boolean;
  setBaseUrl(baseUrl: string): Promise<void>;
  setCourier(courier: CourierIdentity | null): Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

interface SettingsProviderProps {
  children: ReactNode;
  storage?: SettingsStorage;
  /** Skips loading from storage; used by tests to start from a known state. */
  initialSettings?: Settings;
}

export function SettingsProvider({ children, storage = asyncStorageSettings, initialSettings }: SettingsProviderProps) {
  const [settings, setSettings] = useState<Settings>(() => initialSettings ?? defaultSettings());
  const [hydrated, setHydrated] = useState(initialSettings !== undefined);
  // Mirror of the latest settings so two quick updates do not overwrite each other.
  const latest = useRef(settings);

  useEffect(() => {
    if (initialSettings !== undefined) {
      return;
    }
    let cancelled = false;
    storage
      .load()
      .then((saved) => {
        if (!cancelled && saved !== null) {
          latest.current = saved;
          setSettings(saved);
        }
      })
      .catch((error: unknown) => {
        console.warn('could not read saved settings', error);
      })
      .finally(() => {
        if (!cancelled) {
          setHydrated(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initialSettings, storage]);

  const update = useCallback(
    async (patch: Partial<Settings>) => {
      const next = { ...latest.current, ...patch };
      latest.current = next;
      setSettings(next);
      try {
        await storage.save(next);
      } catch (error) {
        console.warn('could not save settings', error);
      }
    },
    [storage],
  );

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      hydrated,
      setBaseUrl: (baseUrl) => update({ baseUrl }),
      setCourier: (courier) => update({ courier }),
    }),
    [settings, hydrated, update],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (value === null) {
    throw new Error('useSettings must be used inside a SettingsProvider');
  }
  return value;
}
