import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { getDeviceLocation } from '../../location/getDeviceLocation';
import { flushEffects } from '../../test/effects';
import { createFakeFetch, envelope } from '../../test/fakeFetch';
import { makeCourier } from '../../test/fixtures';
import { TEST_BASE_URL, renderWithProviders } from '../../test/render';
import { ShiftScreen } from '../ShiftScreen';

// Keeps expo-location (a native module) out of the test; the wrapper's contract is what matters here.
jest.mock('../../location/getDeviceLocation', () => ({ getDeviceLocation: jest.fn() }));

const mockedGetDeviceLocation = jest.mocked(getDeviceLocation);
const COURIER_ID = 'cur_0000000000000001';
const HEALTH_OK = { body: { status: 'ok', database: 'ok' } };

function courierRoutes() {
  return {
    'GET /health': HEALTH_OK,
    [`GET /couriers/${COURIER_ID}`]: { body: makeCourier({ available: false, lat: 40.4406, lng: -79.9959, version: 7 }) },
  };
}

describe('ShiftScreen', () => {
  beforeEach(() => {
    mockedGetDeviceLocation.mockReset();
  });

  it('loads the courier, shows the health poll and the last position', async () => {
    const fetchImpl = createFakeFetch(courierRoutes());
    renderWithProviders(<ShiftScreen />, { fetchImpl });
    expect(await screen.findByText(/API reachable/)).toBeOnTheScreen();
    expect(await screen.findByText('Off shift')).toBeOnTheScreen();
    expect(screen.getByText('40.44060, -79.99590')).toBeOnTheScreen();
    expect(screen.getByTestId('lat-input').props.value).toBe('40.44060');
    expect(fetchImpl.callsTo('GET', `/couriers/${COURIER_ID}`)).toHaveLength(1);
  });

  it('toggling availability posts to the availability endpoint and reflects the server answer', async () => {
    const fetchImpl = createFakeFetch({
      ...courierRoutes(),
      [`POST /couriers/${COURIER_ID}/availability`]: (call) => ({
        body: makeCourier({ available: (call.body as { available: boolean }).available, version: 8 }),
      }),
    });
    renderWithProviders(<ShiftScreen />, { fetchImpl });
    await screen.findByText('Off shift');
    await flushEffects();

    fireEvent(screen.getByTestId('availability-switch'), 'valueChange', true);

    expect(await screen.findByText('On shift (available)')).toBeOnTheScreen();
    expect(screen.getByText('You are on shift and can be assigned orders.')).toBeOnTheScreen();
    const calls = fetchImpl.callsTo('POST', `/couriers/${COURIER_ID}/availability`);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.body).toEqual({ available: true });
    expect(screen.getByText('8')).toBeOnTheScreen();
  });

  it('keeps the server state and shows the message when the toggle fails', async () => {
    const fetchImpl = createFakeFetch({
      ...courierRoutes(),
      [`POST /couriers/${COURIER_ID}/availability`]: { status: 404, body: envelope('not_found', `courier '${COURIER_ID}' not found`) },
    });
    renderWithProviders(<ShiftScreen />, { fetchImpl });
    await screen.findByText('Off shift');
    await flushEffects();
    fireEvent(screen.getByTestId('availability-switch'), 'valueChange', true);
    expect(await screen.findByText(`courier '${COURIER_ID}' not found`)).toBeOnTheScreen();
    expect(screen.getByText('Off shift')).toBeOnTheScreen();
  });

  it('sends a manually entered position', async () => {
    const fetchImpl = createFakeFetch({
      ...courierRoutes(),
      [`POST /couriers/${COURIER_ID}/location`]: (call) => ({
        body: makeCourier({ ...(call.body as { lat: number; lng: number }), version: 8 }),
      }),
    });
    renderWithProviders(<ShiftScreen />, { fetchImpl });
    await screen.findByText('Off shift');
    await flushEffects();

    fireEvent.changeText(screen.getByTestId('lat-input'), '37.5483');
    fireEvent.changeText(screen.getByTestId('lng-input'), '-121.9886');
    fireEvent.press(screen.getByRole('button', { name: 'Send location' }));

    expect(await screen.findByText('Location sent: 37.54830, -121.98860.')).toBeOnTheScreen();
    expect(fetchImpl.callsTo('POST', `/couriers/${COURIER_ID}/location`)[0]?.body).toEqual({ lat: 37.5483, lng: -121.9886 });
    expect(mockedGetDeviceLocation).not.toHaveBeenCalled();
  });

  it('rejects an invalid manual coordinate without calling the API', async () => {
    const fetchImpl = createFakeFetch(courierRoutes());
    renderWithProviders(<ShiftScreen />, { fetchImpl });
    await screen.findByText('Off shift');
    await flushEffects();
    fireEvent.changeText(screen.getByTestId('lat-input'), '95');
    fireEvent.press(screen.getByRole('button', { name: 'Send location' }));
    expect(await screen.findByText('Latitude must be a number between -90 and 90.')).toBeOnTheScreen();
    expect(fetchImpl.callsTo('POST', `/couriers/${COURIER_ID}/location`)).toHaveLength(0);
  });

  it('sends the device position when permission is granted', async () => {
    mockedGetDeviceLocation.mockResolvedValue({ ok: true, location: { lat: 40.4433, lng: -79.9436 } });
    const fetchImpl = createFakeFetch({
      ...courierRoutes(),
      [`POST /couriers/${COURIER_ID}/location`]: (call) => ({
        body: makeCourier({ ...(call.body as { lat: number; lng: number }), version: 9 }),
      }),
    });
    renderWithProviders(<ShiftScreen />, { fetchImpl });
    await screen.findByText('Off shift');
    await flushEffects();

    fireEvent.press(screen.getByRole('button', { name: 'Use device location' }));

    expect(await screen.findByText('Location sent: 40.44330, -79.94360.')).toBeOnTheScreen();
    expect(fetchImpl.callsTo('POST', `/couriers/${COURIER_ID}/location`)[0]?.body).toEqual({ lat: 40.4433, lng: -79.9436 });
    expect(screen.getByTestId('lng-input').props.value).toBe('-79.94360');
  });

  it('falls back to the manual form when permission is refused', async () => {
    mockedGetDeviceLocation.mockResolvedValue({ ok: false, reason: 'Location permission was not granted. Enter the coordinates by hand.' });
    const fetchImpl = createFakeFetch(courierRoutes());
    renderWithProviders(<ShiftScreen />, { fetchImpl });
    await screen.findByText('Off shift');
    await flushEffects();
    fireEvent.press(screen.getByRole('button', { name: 'Use device location' }));
    expect(await screen.findByText(/Location permission was not granted/)).toBeOnTheScreen();
    await waitFor(() => expect(fetchImpl.callsTo('POST', `/couriers/${COURIER_ID}/location`)).toHaveLength(0));
    expect(screen.getByTestId('lat-input')).toBeOnTheScreen();
  });

  it('shows the health poll and a setup hint when no courier is chosen', async () => {
    const fetchImpl = createFakeFetch({ 'GET /health': HEALTH_OK });
    renderWithProviders(<ShiftScreen />, { fetchImpl, settings: { baseUrl: TEST_BASE_URL, courier: null } });
    expect(await screen.findByText(/API reachable/)).toBeOnTheScreen();
    expect(screen.getByText('No courier yet')).toBeOnTheScreen();
    expect(screen.queryByTestId('availability-switch')).toBeNull();
  });
});
