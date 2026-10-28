import AsyncStorage from '@react-native-async-storage/async-storage';

import { SETTINGS_KEY, asyncStorageSettings, createMemorySettingsStorage } from '../settingsStorage';

describe('asyncStorageSettings', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns null before anything was saved', async () => {
    expect(await asyncStorageSettings.load()).toBeNull();
  });

  it('round-trips settings through AsyncStorage', async () => {
    const settings = { baseUrl: 'http://192.168.1.20:8000', courier: { id: 'cur_1', name: 'A' } };
    await asyncStorageSettings.save(settings);
    expect(await asyncStorageSettings.load()).toEqual(settings);
    expect(await AsyncStorage.getItem(SETTINGS_KEY)).toBe(JSON.stringify(settings));
  });

  it('ignores corrupted or malformed stored values', async () => {
    await AsyncStorage.setItem(SETTINGS_KEY, '{not json');
    expect(await asyncStorageSettings.load()).toBeNull();
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ courier: null }));
    expect(await asyncStorageSettings.load()).toBeNull();
  });
});

describe('createMemorySettingsStorage', () => {
  it('keeps the last saved value', async () => {
    const storage = createMemorySettingsStorage();
    expect(await storage.load()).toBeNull();
    await storage.save({ baseUrl: 'http://h:1', courier: null });
    expect(storage.current).toEqual({ baseUrl: 'http://h:1', courier: null });
  });
});
