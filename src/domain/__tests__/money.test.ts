import { formatCents } from '../money';

describe('formatCents', () => {
  it.each([
    [0, '$0.00'],
    [5, '$0.05'],
    [1234, '$12.34'],
    [3700, '$37.00'],
    [123456789, '$1,234,567.89'],
    [-250, '-$2.50'],
  ])('formats %i cents as %s', (cents, expected) => {
    expect(formatCents(cents)).toBe(expected);
  });
});
