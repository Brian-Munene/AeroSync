/**
 * AeroSync baggage QR payload: `AEROSYNC:BAGGAGE:<Firestore document ID>`.
 */
export const QR_PREFIX = 'AEROSYNC:BAGGAGE:';

// Firestore auto-generated document IDs are 20 letters/digits.
const DOC_ID_PATTERN = /^[A-Za-z0-9]{20}$/;

export function buildQrPayload(documentId: string): string {
  return QR_PREFIX + documentId;
}

/** Returns the document ID from an AeroSync QR, or null for anything else. */
export function parseBaggageQr(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value.startsWith(QR_PREFIX)) return null;
  const id = value.slice(QR_PREFIX.length).trim();
  return DOC_ID_PATTERN.test(id) ? id : null;
}
