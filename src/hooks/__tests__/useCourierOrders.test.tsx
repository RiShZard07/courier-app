import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createFakeFetch, envelope } from '../../test/fakeFetch';
import { makeOrder } from '../../test/fixtures';
import { createWrapper } from '../../test/render';
import { useCourierOrders } from '../useCourierOrders';

describe('useCourierOrders', () => {
  it('lists the courier\'s orders with the courier_id filter', async () => {
    const fetchImpl = createFakeFetch({
      'GET /orders': { body: { items: [makeOrder({ id: 'ord_1' })], limit: 100, offset: 0, next_offset: null } },
    });
    const { Wrapper } = createWrapper({ fetchImpl });
    const { result } = renderHook(() => useCourierOrders('cur_1'), { wrapper: Wrapper });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.orders.map((order) => order.id)).toEqual(['ord_1']);
    expect(fetchImpl.calls[0]?.query).toEqual({ courier_id: 'cur_1', limit: '100', offset: '0' });
  });

  it('does not call the API without a courier', async () => {
    const fetchImpl = createFakeFetch();
    const { Wrapper } = createWrapper({ fetchImpl });
    const { result } = renderHook(() => useCourierOrders(null), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchImpl.calls).toHaveLength(0);
    expect(result.current.orders).toEqual([]);
  });

  it('exposes the API error message and recovers on refresh', async () => {
    const fetchImpl = createFakeFetch({ 'GET /orders': { status: 500, body: envelope('internal_error', 'unexpected error') } });
    const { Wrapper } = createWrapper({ fetchImpl });
    const { result } = renderHook(() => useCourierOrders('cur_1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.error).toBe('unexpected error'));

    fetchImpl.routes['GET /orders'] = { body: { items: [makeOrder()], limit: 100, offset: 0, next_offset: null } };
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.orders).toHaveLength(1);
  });

  it('reloads when the refresh token changes', async () => {
    const fetchImpl = createFakeFetch({ 'GET /orders': { body: { items: [], limit: 100, offset: 0, next_offset: null } } });
    const { Wrapper } = createWrapper({ fetchImpl });
    const { result, rerender } = renderHook(({ token }: { token: number }) => useCourierOrders('cur_1', token), {
      wrapper: Wrapper,
      initialProps: { token: 0 },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ token: 1 });
    await waitFor(() => expect(fetchImpl.calls).toHaveLength(2));
  });
});
