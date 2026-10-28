/** The two things the app remembers between launches: where the API is and who the courier is. */

export const FALLBACK_BASE_URL = 'http://localhost:8000';

export interface CourierIdentity {
  id: string;
  name: string;
}

export interface Settings {
  baseUrl: string;
  courier: CourierIdentity | null;
}

/** The base URL to start with: EXPO_PUBLIC_API_URL when it was set at build time, else localhost. */
export function resolveDefaultBaseUrl(envValue: string | undefined): string {
  const trimmed = envValue?.trim() ?? '';
  return trimmed === '' ? FALLBACK_BASE_URL : trimmed.replace(/\/+$/, '');
}

export function defaultSettings(): Settings {
  // Expo inlines EXPO_PUBLIC_* variables at build time, so the reference must be written out in full.
  return { baseUrl: resolveDefaultBaseUrl(process.env.EXPO_PUBLIC_API_URL), courier: null };
}

/** Validate a value read back from storage; anything malformed is treated as "nothing saved". */
export function parseStoredSettings(raw: unknown): Settings | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.baseUrl !== 'string' || record.baseUrl.trim() === '') {
    return null;
  }
  const courier = record.courier;
  if (courier === null || courier === undefined) {
    return { baseUrl: record.baseUrl, courier: null };
  }
  if (typeof courier !== 'object') {
    return null;
  }
  const { id, name } = courier as Record<string, unknown>;
  if (typeof id !== 'string' || id === '' || typeof name !== 'string') {
    return null;
  }
  return { baseUrl: record.baseUrl, courier: { id, name } };
}

/** Accept http(s) origins, with or without a path, and strip trailing slashes; null when unusable. */
export function parseBaseUrl(text: string): string | null {
  const trimmed = text.trim().replace(/\/+$/, '');
  return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed : null;
}
