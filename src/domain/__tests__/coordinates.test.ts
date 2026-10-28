import { formatCoordinate, parseCoordinate, parseLocation } from '../coordinates';

describe('parseCoordinate', () => {
  it('accepts numbers inside the valid range', () => {
    expect(parseCoordinate('40.4406', 'lat')).toBe(40.4406);
    expect(parseCoordinate(' -79.9959 ', 'lng')).toBe(-79.9959);
    expect(parseCoordinate('90', 'lat')).toBe(90);
    expect(parseCoordinate('-180', 'lng')).toBe(-180);
  });

  it('rejects blanks, text and out-of-range values', () => {
    expect(parseCoordinate('', 'lat')).toBeNull();
    expect(parseCoordinate('north', 'lat')).toBeNull();
    expect(parseCoordinate('90.1', 'lat')).toBeNull();
    expect(parseCoordinate('181', 'lng')).toBeNull();
    expect(parseCoordinate('1e3', 'lng')).toBeNull();
  });
});

describe('parseLocation', () => {
  it('returns a location or the first field-specific message', () => {
    expect(parseLocation('1', '2')).toEqual({ ok: true, location: { lat: 1, lng: 2 } });
    expect(parseLocation('x', '2')).toEqual({ ok: false, message: 'Latitude must be a number between -90 and 90.' });
    expect(parseLocation('1', '')).toEqual({ ok: false, message: 'Longitude must be a number between -180 and 180.' });
  });
});

describe('formatCoordinate', () => {
  it('uses five decimals', () => {
    expect(formatCoordinate(40.4406)).toBe('40.44060');
  });
});
