import { render, type RenderResult } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import type { FetchLike } from '../api/client';
import { ApiProvider } from '../state/ApiContext';
import type { Settings } from '../state/settings';
import { SettingsProvider } from '../state/SettingsContext';
import { createMemorySettingsStorage } from '../storage/settingsStorage';

export const TEST_BASE_URL = 'http://api.test:8000';

export const TEST_SETTINGS: Settings = {
  baseUrl: TEST_BASE_URL,
  courier: { id: 'cur_0000000000000001', name: 'Test Courier' },
};

interface ProviderOptions {
  settings?: Settings;
  fetchImpl?: FetchLike;
}

/** The real providers with in-memory storage and an injected fetch. */
export function createWrapper({ settings = TEST_SETTINGS, fetchImpl }: ProviderOptions = {}) {
  const storage = createMemorySettingsStorage(settings);
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SettingsProvider initialSettings={settings} storage={storage}>
        <ApiProvider fetchImpl={fetchImpl}>{children}</ApiProvider>
      </SettingsProvider>
    );
  }
  return { Wrapper, storage };
}

export function renderWithProviders(ui: ReactElement, options: ProviderOptions = {}): RenderResult & {
  storage: ReturnType<typeof createMemorySettingsStorage>;
} {
  const { Wrapper, storage } = createWrapper(options);
  return { ...render(ui, { wrapper: Wrapper }), storage };
}
