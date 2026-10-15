/**
 * Flight numbers: 2-character airline code + 1–4 digits.
 * Input may contain a hyphen or spaces ("KQ-101", "kq 101"); it is stored
 * as "KQ101" so the same flight is never saved two different ways.
 */
const AIRLINE_CODE = '(?:[A-Z]{2}|[A-Z][0-9]|[0-9][A-Z])'; // never two digits
const FLIGHT_PATTERN = new RegExp(`^${AIRLINE_CODE}[0-9]{1,4}$`);

export function normalizeFlightNumber(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]+/g, '');
}

export type FlightCheck = { ok: true; flight: string } | { ok: false; error: string };

export function validateFlightNumber(raw: unknown): FlightCheck {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, error: 'Please enter the flight number, e.g. KQ100.' };
  }
  if ((raw.match(/-/g) ?? []).length > 1) {
    return { ok: false, error: 'Enter the flight number as e.g. KQ100 or KQ-100.' };
  }
  const flight = normalizeFlightNumber(raw);
  if (!FLIGHT_PATTERN.test(flight)) {
    return { ok: false, error: 'Enter the flight number as e.g. KQ100 or KQ-100.' };
  }
  return { ok: true, flight };
}
