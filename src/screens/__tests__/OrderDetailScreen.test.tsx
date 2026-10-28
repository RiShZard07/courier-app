import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { flushEffects } from '../../test/effects';
import { createFakeFetch, envelope } from '../../test/fakeFetch';
import { makeEvent, makeOrder } from '../../test/fixtures';
import { renderWithProviders } from '../../test/render';
import { CONFLICT_MESSAGE, OrderDetailScreen } from '../OrderDetailScreen';

const ORDER_ID = 'ord_0000000000000001';

const EVENTS = [
  makeEvent({ seq: 1, from_state: null, to_state: 'CREATED' }),
  makeEvent({ seq: 2, from_state: 'CREATED', to_state: 'ACCEPTED', actor: 'merchant:tablet' }),
  makeEvent({ seq: 3, from_state: 'ACCEPTED', to_state: 'ASSIGNED', actor: 'dispatcher' }),
];

describe('OrderDetailScreen', () => {
  it('shows items, state, audit trail and the Pick up action for an ASSIGNED order', async () => {
    const fetchImpl = createFakeFetch({
      [`GET /orders/${ORDER_ID}`]: { body: makeOrder({ state: 'ASSIGNED', version: 3 }) },
      [`GET /orders/${ORDER_ID}/events`]: { body: EVENTS },
    });
    renderWithProviders(<OrderDetailScreen orderId={ORDER_ID} />, { fetchImpl });

    expect(await screen.findByText(ORDER_ID)).toBeOnTheScreen();
    expect(screen.getByText('coffee-beans-1kg')).toBeOnTheScreen();
    expect(screen.getByText('2 x $18.50')).toBeOnTheScreen();
    expect(screen.getAllByText('$37.00')).toHaveLength(2);
    expect(screen.getByText('Accepted to Assigned')).toBeOnTheScreen();
    expect(screen.getByText(/dispatcher at/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Pick up' })).toBeOnTheScreen();
  });

  it('posts the pickup with If-Match and shows the new state', async () => {
    const fetchImpl = createFakeFetch({
      [`GET /orders/${ORDER_ID}`]: { body: makeOrder({ state: 'ASSIGNED', version: 3 }) },
      [`GET /orders/${ORDER_ID}/events`]: { body: EVENTS },
      [`POST /orders/${ORDER_ID}/pickup`]: { body: makeOrder({ state: 'PICKED_UP', version: 4 }) },
    });
    renderWithProviders(<OrderDetailScreen orderId={ORDER_ID} />, { fetchImpl });

    await screen.findByRole('button', { name: 'Pick up' });
    await flushEffects();
    fireEvent.press(screen.getByRole('button', { name: 'Pick up' }));

    expect(await screen.findByText('Order is now picked up.')).toBeOnTheScreen();
    const pickup = fetchImpl.callsTo('POST', `/orders/${ORDER_ID}/pickup`);
    expect(pickup).toHaveLength(1);
    expect(pickup[0]?.headers['if-match']).toBe('3');
    expect(screen.getByRole('button', { name: 'Deliver' })).toBeOnTheScreen();
    // The audit trail is re-read after a successful transition.
    expect(fetchImpl.callsTo('GET', `/orders/${ORDER_ID}/events`)).toHaveLength(2);
  });

  it('posts deliver for a PICKED_UP order', async () => {
    const fetchImpl = createFakeFetch({
      [`GET /orders/${ORDER_ID}`]: { body: makeOrder({ state: 'PICKED_UP', version: 4 }) },
      [`GET /orders/${ORDER_ID}/events`]: { body: EVENTS },
      [`POST /orders/${ORDER_ID}/deliver`]: { body: makeOrder({ state: 'DELIVERED', version: 5 }) },
    });
    renderWithProviders(<OrderDetailScreen orderId={ORDER_ID} />, { fetchImpl });
    await screen.findByRole('button', { name: 'Deliver' });
    await flushEffects();
    fireEvent.press(screen.getByRole('button', { name: 'Deliver' }));
    expect(await screen.findByText('No further action: this order is closed.')).toBeOnTheScreen();
    expect(fetchImpl.callsTo('POST', `/orders/${ORDER_ID}/deliver`)[0]?.headers['if-match']).toBe('4');
  });

  it('refetches and explains when the server answers 409 version_conflict', async () => {
    const fetchImpl = createFakeFetch({
      [`GET /orders/${ORDER_ID}`]: { body: makeOrder({ state: 'ASSIGNED', version: 3 }) },
      [`GET /orders/${ORDER_ID}/events`]: { body: EVENTS },
      [`POST /orders/${ORDER_ID}/pickup`]: {
        status: 409,
        body: envelope('version_conflict', `order ${ORDER_ID} is at version 4, not 3`),
      },
    });
    renderWithProviders(<OrderDetailScreen orderId={ORDER_ID} />, { fetchImpl });
    await screen.findByRole('button', { name: 'Pick up' });
    await flushEffects();

    // Someone else moved the order on; the refetch sees the newer version.
    fetchImpl.routes[`GET /orders/${ORDER_ID}`] = { body: makeOrder({ state: 'PICKED_UP', version: 4 }) };
    fireEvent.press(screen.getByRole('button', { name: 'Pick up' }));

    expect(await screen.findByText(CONFLICT_MESSAGE)).toBeOnTheScreen();
    expect(fetchImpl.callsTo('GET', `/orders/${ORDER_ID}`)).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Deliver' })).toBeOnTheScreen();
    expect(screen.getByText('4')).toBeOnTheScreen();
  });

  it('shows the API error message on any other failure', async () => {
    const fetchImpl = createFakeFetch({
      [`GET /orders/${ORDER_ID}`]: { body: makeOrder({ state: 'ASSIGNED', version: 3 }) },
      [`GET /orders/${ORDER_ID}/events`]: { body: EVENTS },
      [`POST /orders/${ORDER_ID}/pickup`]: {
        status: 409,
        body: envelope('invalid_transition', 'cannot move an order from ASSIGNED to DELIVERED'),
      },
    });
    renderWithProviders(<OrderDetailScreen orderId={ORDER_ID} />, { fetchImpl });
    await screen.findByRole('button', { name: 'Pick up' });
    await flushEffects();
    fireEvent.press(screen.getByRole('button', { name: 'Pick up' }));
    expect(await screen.findByText('cannot move an order from ASSIGNED to DELIVERED')).toBeOnTheScreen();
    // Not a version conflict, so no refetch.
    await waitFor(() => expect(fetchImpl.callsTo('GET', `/orders/${ORDER_ID}`)).toHaveLength(1));
  });

  it('offers no action for an order that is not the courier\'s to move', async () => {
    const fetchImpl = createFakeFetch({
      [`GET /orders/${ORDER_ID}`]: { body: makeOrder({ state: 'ACCEPTED', courier_id: null, version: 2 }) },
      [`GET /orders/${ORDER_ID}/events`]: { body: EVENTS.slice(0, 2) },
    });
    renderWithProviders(<OrderDetailScreen orderId={ORDER_ID} />, { fetchImpl });
    expect(await screen.findByText('Waiting for dispatch to assign this order.')).toBeOnTheScreen();
    expect(screen.queryByTestId('order-action')).toBeNull();
    expect(screen.getByText('not assigned')).toBeOnTheScreen();
  });

  it('shows the load error when the order cannot be read', async () => {
    const fetchImpl = createFakeFetch({
      [`GET /orders/${ORDER_ID}`]: { status: 404, body: envelope('not_found', `order '${ORDER_ID}' not found`) },
      [`GET /orders/${ORDER_ID}/events`]: { status: 404, body: envelope('not_found', `order '${ORDER_ID}' not found`) },
    });
    renderWithProviders(<OrderDetailScreen orderId={ORDER_ID} />, { fetchImpl });
    expect(await screen.findByText(`order '${ORDER_ID}' not found`)).toBeOnTheScreen();
  });
});
