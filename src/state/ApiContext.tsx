import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { DispatchClient, type FetchLike } from '../api/client';
import { useSettings } from './SettingsContext';

const ApiContext = createContext<DispatchClient | null>(null);

interface ApiProviderProps {
  children: ReactNode;
  /** Injected by tests; production uses the global fetch. */
  fetchImpl?: FetchLike;
}

/** One client per base URL, rebuilt whenever the user changes the URL on the Setup screen. */
export function ApiProvider({ children, fetchImpl }: ApiProviderProps) {
  const { settings } = useSettings();
  const client = useMemo(
    () => new DispatchClient({ baseUrl: settings.baseUrl, fetchImpl }),
    [settings.baseUrl, fetchImpl],
  );
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): DispatchClient {
  const client = useContext(ApiContext);
  if (client === null) {
    throw new Error('useApi must be used inside an ApiProvider');
  }
  return client;
}
