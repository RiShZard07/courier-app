/**
 * Persistence of Settings. AsyncStorage is plain, unencrypted key-value storage, which is fine
 * for an API URL and a synthetic courier id; a real credential would go in expo-secure-store.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseStoredSettings, type Settings } from '../state/settings';

export const SETTINGS_KEY = 'courier-app.settings.v1';

export interface SettingsStorage {
  load(): Promise<Settings | null>;
  save(settings: Settings): Promise<void>;
}

export const asyncStorageSettings: SettingsStorage = {
  async load() {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw === null) {
      return null;
    }
    try {
      return parseStoredSettings(JSON.parse(raw));
    } catch {
      return null;
    }
  },
  async save(settings) {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },
};

/** In-memory implementation for tests. */
export function createMemorySettingsStorage(initial: Settings | null = null): SettingsStorage & {
  current: Settings | null;
} {
  const storage = {
    current: initial,
    async load() {
      return storage.current;
    },
    async save(settings: Settings) {
      storage.current = settings;
    },
  };
  return storage;
}
