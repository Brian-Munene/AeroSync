import { describe, expect, it } from '@jest/globals';

import { buildQrPayload, parseBaggageQr, QR_PREFIX } from '../qr';

const ID = 'AbCdEfGhIj0123456789'; // 20 chars, like a Firestore auto-ID

describe('baggage QR payload', () => {
  it('builds and parses the same ID', () => {
    expect(buildQrPayload(ID)).toBe(`AEROSYNC:BAGGAGE:${ID}`);
    expect(parseBaggageQr(buildQrPayload(ID))).toBe(ID);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseBaggageQr(`  ${QR_PREFIX}${ID}\n`)).toBe(ID);
  });

  it('rejects codes that are not AeroSync baggage tags (TC-07)', () => {
    expect(parseBaggageQr('https://example.com')).toBeNull();
    expect(parseBaggageQr(ID)).toBeNull();
    expect(parseBaggageQr(QR_PREFIX)).toBeNull();
    expect(parseBaggageQr(`${QR_PREFIX}short`)).toBeNull();
    expect(parseBaggageQr(`${QR_PREFIX}../users/${ID}`)).toBeNull();
    expect(parseBaggageQr(`aerosync:baggage:${ID}`)).toBeNull();
    expect(parseBaggageQr(null)).toBeNull();
  });
});
