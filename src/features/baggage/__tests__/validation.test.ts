import { describe, expect, it } from '@jest/globals';

import { normalizeFlightNumber, validateFlightNumber } from '../validation';

describe('flight number validation', () => {
  it.each([
    ['KQ100', 'KQ100'],
    ['KQ-100', 'KQ100'],
    ['kq100', 'KQ100'],
    [' kq 100 ', 'KQ100'],
    ['5Y1', '5Y1'],
    ['QR0012', 'QR0012'],
  ])('accepts %p as %p', (input, flight) => {
    expect(validateFlightNumber(input)).toEqual({ ok: true, flight });
  });

  it.each(['', '   ', undefined])('rejects empty input %p (TC-05)', (input) => {
    expect(validateFlightNumber(input).ok).toBe(false);
  });

  it.each(['KQ', 'KQ12345', '12345', '12-345', 'KQA100', 'KQ--100', 'KQ_100', 'KQ100!'])(
    'rejects malformed %p (TC-05)',
    (input) => {
      expect(validateFlightNumber(input).ok).toBe(false);
    }
  );

  it('stores one flight one way', () => {
    expect(normalizeFlightNumber('kq-100')).toBe(normalizeFlightNumber('KQ 100'));
  });
});
