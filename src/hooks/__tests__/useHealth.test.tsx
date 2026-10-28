import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createFakeFetch, envelope } from '../../test/fakeFetch';
import { createWrapper } from '../../test/render';
import { HEALTH_INTERVAL_MS, useHealth } from '../useHealth';

describe('useHealth', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('checks GET /health immediately and again every 15 seconds', async () => {
    const fetchImpl = createFakeFetch({ 'GET /health': { body: { status: 'ok', database: 'ok' } } });
    const { Wrapper } = createWrapper({ fetchImpl });
    const { result } = renderHook(() => useHealth(), { wrapper: Wrapper });

    expect(result.current.status).toBe('checking');
    await waitFor(() => expect(result.current.status).toBe('ok'));
    expect(fetchImpl.callsTo('GET', '/health')).toHaveLength(1);

    act(() => {
      jest.advanceTimersByTime(HEALTH_INTERVAL_MS);
    });
    await waitFor(() => expect(fetchImpl.callsTo('GET', '/health')).toHaveLength(2));
    expect(HEALTH_INTERVAL_MS).toBe(15_000);
  });

  it('reports the API as down with the server\'s message', async () => {
    const fetchImpl = createFakeFetch({ 'GET /health': { status: 503, body: envelope('service_unavailable', 'database is unreachable') } });
    const { Wrapper } = createWrapper({ fetchImpl });
    const { result } = renderHook(() => useHealth(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.status).toBe('down'));
    expect(result.current.message).toBe('database is unreachable');
    expect(result.current.checkedAt).not.toBeNull();
  });

  it('stops polling after unmount', async () => {
    const fetchImpl = createFakeFetch({ 'GET /health': { body: { status: 'ok', database: 'ok' } } });
    const { Wrapper } = createWrapper({ fetchImpl });
    const { unmount } = renderHook(() => useHealth(), { wrapper: Wrapper });
    await waitFor(() => expect(fetchImpl.calls).toHaveLength(1));
    unmount();
    act(() => {
      jest.advanceTimersByTime(HEALTH_INTERVAL_MS * 3);
    });
    expect(fetchImpl.calls).toHaveLength(1);
  });
});
