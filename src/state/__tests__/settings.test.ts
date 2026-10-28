import { FALLBACK_BASE_URL, parseBaseUrl, parseStoredSettings, resolveDefaultBaseUrl } from '../settings';

describe('resolveDefaultBaseUrl', () => {
  it('uses EXPO_PUBLIC_API_URL when set and localhost otherwise', () => {
    expect(resolveDefaultBaseUrl(undefined)).toBe(FALLBACK_BASE_URL);
    expect(resolveDefaultBaseUrl('   ')).toBe(FALLBACK_BASE_URL);
    expect(resolveDefaultBaseUrl('https://dispatch.example.test/')).toBe('https://dispatch.example.test');
  });
});

describe('parseBaseUrl', () => {
  it('accepts http(s) URLs and trims trailing slashes', () => {
    expect(parseBaseUrl(' http://192.168.1.20:8000/ ')).toBe('http://192.168.1.20:8000');
    expect(parseBaseUrl('https://dispatch.example.test/api')).toBe('https://dispatch.example.test/api');
  });

  it('rejects anything without an http scheme', () => {
    expect(parseBaseUrl('192.168.1.20:8000')).toBeNull();
    expect(parseBaseUrl('ftp://host')).toBeNull();
    expect(parseBaseUrl('')).toBeNull();
  });
});

describe('parseStoredSettings', () => {
  it('accepts well-formed settings with or without a courier', () => {
    expect(parseStoredSettings({ baseUrl: 'http://h:1', courier: null })).toEqual({ baseUrl: 'http://h:1', courier: null });
    expect(parseStoredSettings({ baseUrl: 'http://h:1', courier: { id: 'cur_1', name: 'A' } })).toEqual({
      baseUrl: 'http://h:1',
      courier: { id: 'cur_1', name: 'A' },
    });
  });

  it('treats malformed values as nothing saved', () => {
    expect(parseStoredSettings(null)).toBeNull();
    expect(parseStoredSettings('text')).toBeNull();
    expect(parseStoredSettings({ courier: null })).toBeNull();
    expect(parseStoredSettings({ baseUrl: 'http://h:1', courier: { id: '' } })).toBeNull();
    expect(parseStoredSettings({ baseUrl: 'http://h:1', courier: 'cur_1' })).toBeNull();
  });
});
