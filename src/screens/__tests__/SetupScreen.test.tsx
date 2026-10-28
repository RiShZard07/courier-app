import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { createFakeFetch, envelope } from '../../test/fakeFetch';
import { makeCourier } from '../../test/fixtures';
import { TEST_BASE_URL, renderWithProviders } from '../../test/render';
import { SetupScreen } from '../SetupScreen';

const NO_COURIER = { baseUrl: TEST_BASE_URL, courier: null };

describe('SetupScreen', () => {
  it('registers a new courier off shift and persists it', async () => {
    const fetchImpl = createFakeFetch({
      'POST /couriers': (call) => ({ status: 201, body: makeCourier({ id: 'cur_new', name: (call.body as { name: string }).name }) }),
    });
    const { storage } = renderWithProviders(<SetupScreen />, { fetchImpl, settings: NO_COURIER });

    fireEvent.changeText(screen.getByTestId('courier-name-input'), 'Evening Courier');
    fireEvent.press(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByText('Registered Evening Courier as cur_new.')).toBeOnTheScreen();
    expect(fetchImpl.calls[0]?.body).toEqual({ name: 'Evening Courier', lat: 0, lng: 0, available: false });
    const card = within(screen.getByTestId('courier-card'));
    expect(card.getByText('Evening Courier')).toBeOnTheScreen();
    expect(card.getByText('cur_new')).toBeOnTheScreen();
    expect(storage.current?.courier).toEqual({ id: 'cur_new', name: 'Evening Courier' });
  });

  it('adopts an existing courier id after checking it with the API', async () => {
    const fetchImpl = createFakeFetch({ 'GET /couriers/cur_existing': { body: makeCourier({ id: 'cur_existing', name: 'Existing' }) } });
    const { storage } = renderWithProviders(<SetupScreen />, { fetchImpl, settings: NO_COURIER });

    fireEvent.changeText(screen.getByTestId('courier-id-input'), ' cur_existing ');
    fireEvent.press(screen.getByRole('button', { name: 'Use this courier' }));

    expect(await screen.findByText('Now acting as Existing (cur_existing).')).toBeOnTheScreen();
    expect(storage.current?.courier).toEqual({ id: 'cur_existing', name: 'Existing' });
  });

  it('shows the API error message when the courier id is unknown', async () => {
    const fetchImpl = createFakeFetch({ 'GET /couriers/cur_nope': { status: 404, body: envelope('not_found', "courier 'cur_nope' not found") } });
    const { storage } = renderWithProviders(<SetupScreen />, { fetchImpl, settings: NO_COURIER });
    fireEvent.changeText(screen.getByTestId('courier-id-input'), 'cur_nope');
    fireEvent.press(screen.getByRole('button', { name: 'Use this courier' }));
    expect(await screen.findByText("courier 'cur_nope' not found")).toBeOnTheScreen();
    expect(storage.current?.courier).toBeNull();
  });

  it('saves a valid base URL and rejects an invalid one', async () => {
    const fetchImpl = createFakeFetch();
    const { storage } = renderWithProviders(<SetupScreen />, { fetchImpl, settings: NO_COURIER });

    fireEvent.changeText(screen.getByTestId('base-url-input'), '192.168.1.20:8000');
    fireEvent.press(screen.getByRole('button', { name: 'Save URL' }));
    expect(await screen.findByText(/Enter a URL starting with http/)).toBeOnTheScreen();
    expect(storage.current?.baseUrl).toBe(TEST_BASE_URL);

    fireEvent.changeText(screen.getByTestId('base-url-input'), 'http://192.168.1.20:8000/');
    fireEvent.press(screen.getByRole('button', { name: 'Save URL' }));
    expect(await screen.findByText('API URL saved: http://192.168.1.20:8000')).toBeOnTheScreen();
    expect(screen.getByText('Requests currently go to http://192.168.1.20:8000')).toBeOnTheScreen();
    await waitFor(() => expect(storage.current?.baseUrl).toBe('http://192.168.1.20:8000'));
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it('forgets the courier on this device only', async () => {
    const fetchImpl = createFakeFetch();
    const { storage } = renderWithProviders(<SetupScreen />, { fetchImpl });
    expect(within(screen.getByTestId('courier-card')).getByText('Test Courier')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Forget courier' }));
    expect(await screen.findByText(/Courier cleared on this device/)).toBeOnTheScreen();
    expect(screen.queryByTestId('courier-card')).toBeNull();
    expect(storage.current?.courier).toBeNull();
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it('requires a name before registering', async () => {
    const fetchImpl = createFakeFetch();
    renderWithProviders(<SetupScreen />, { fetchImpl, settings: NO_COURIER });
    fireEvent.press(screen.getByRole('button', { name: 'Register' }));
    expect(await screen.findByText('Enter a name for the new courier.')).toBeOnTheScreen();
    expect(fetchImpl.calls).toHaveLength(0);
  });
});
