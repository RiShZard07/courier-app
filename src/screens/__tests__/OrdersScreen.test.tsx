import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createFakeFetch, envelope } from '../../test/fakeFetch';
import { makeOrder } from '../../test/fixtures';
import { TEST_BASE_URL, renderWithProviders } from '../../test/render';
import { OrdersScreen } from '../OrdersScreen';

function pageOf(items: ReturnType<typeof makeOrder>[]) {
  return { body: { items, limit: 100, offset: 0, next_offset: null } };
}

describe('OrdersScreen', () => {
  it('fetches the courier\'s orders and renders them grouped by state', async () => {
    const fetchImpl = createFakeFetch({
      'GET /orders': pageOf([
        makeOrder({ id: 'ord_carrying', state: 'PICKED_UP', merchant_id: 'mer_bakery', subtotal_cents: 1234 }),
        makeOrder({ id: 'ord_waiting', state: 'ASSIGNED', merchant_id: 'mer_grocer', subtotal_cents: 99900 }),
      ]),
    });
    renderWithProviders(<OrdersScreen onOpenOrder={jest.fn()} />, { fetchImpl });

    expect(await screen.findByText('ord_carrying')).toBeOnTheScreen();
    expect(screen.getByText('ord_waiting')).toBeOnTheScreen();
    expect(screen.getByText('mer_bakery')).toBeOnTheScreen();
    expect(screen.getByText('$12.34')).toBeOnTheScreen();
    expect(screen.getByText('$999.00')).toBeOnTheScreen();
    expect(screen.getByText('Assigned (1)')).toBeOnTheScreen();
    expect(screen.getByText('Picked up (1)')).toBeOnTheScreen();

    const call = fetchImpl.calls[0];
    expect(call?.url.startsWith(`${TEST_BASE_URL}/orders?`)).toBe(true);
    expect(call?.query.courier_id).toBe('cur_0000000000000001');
  });

  it('opens an order when its row is pressed', async () => {
    const fetchImpl = createFakeFetch({ 'GET /orders': pageOf([makeOrder({ id: 'ord_tap' })]) });
    const onOpenOrder = jest.fn();
    renderWithProviders(<OrdersScreen onOpenOrder={onOpenOrder} />, { fetchImpl });
    fireEvent.press(await screen.findByTestId('order-row-ord_tap'));
    expect(onOpenOrder).toHaveBeenCalledWith('ord_tap');
  });

  it('refetches on pull to refresh', async () => {
    const fetchImpl = createFakeFetch({ 'GET /orders': pageOf([]) });
    renderWithProviders(<OrdersScreen onOpenOrder={jest.fn()} />, { fetchImpl });
    expect(await screen.findByText('No orders yet')).toBeOnTheScreen();
    expect(fetchImpl.calls).toHaveLength(1);

    fetchImpl.routes['GET /orders'] = pageOf([makeOrder({ id: 'ord_fresh' })]);
    fireEvent(screen.getByTestId('orders-list'), 'refresh');
    expect(await screen.findByText('ord_fresh')).toBeOnTheScreen();
    expect(fetchImpl.calls).toHaveLength(2);
  });

  it('shows the API error message', async () => {
    const fetchImpl = createFakeFetch({ 'GET /orders': { status: 503, body: envelope('service_unavailable', 'database is unreachable') } });
    renderWithProviders(<OrdersScreen onOpenOrder={jest.fn()} />, { fetchImpl });
    expect(await screen.findByText('database is unreachable')).toBeOnTheScreen();
  });

  it('asks for setup instead of calling the API when no courier is chosen', async () => {
    const fetchImpl = createFakeFetch();
    renderWithProviders(<OrdersScreen onOpenOrder={jest.fn()} />, {
      fetchImpl,
      settings: { baseUrl: TEST_BASE_URL, courier: null },
    });
    expect(screen.getByText('No courier yet')).toBeOnTheScreen();
    await waitFor(() => expect(fetchImpl.calls).toHaveLength(0));
  });
});
