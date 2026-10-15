/**
 * Baggage handling rules, using the status names stored in Firestore:
 *   Registered → (Loading action) → Loading → (Offloading action) → Offloaded
 * A bag only ever moves one step forward. Pure functions, unit-tested.
 */
export type BaggageStatus = 'Registered' | 'Loading' | 'Offloaded';
export type HandlingAction = 'Loading' | 'Offloading';

/** Status a bag ends up in after each action. */
export const STATUS_AFTER: Record<HandlingAction, BaggageStatus> = {
  Loading: 'Loading',
  Offloading: 'Offloaded',
};

/** The single action allowed next, or null if none (finished or unknown status). */
export function nextAction(status: unknown): HandlingAction | null {
  if (status === 'Registered') return 'Loading';
  if (status === 'Loading') return 'Offloading';
  return null;
}

export type HandlingPlan =
  | { ok: true; newStatus: BaggageStatus }
  | {
      ok: false;
      code: 'already-loaded' | 'already-offloaded' | 'not-loaded' | 'unknown-status';
      message: string;
    };

/** Decides whether `action` may be recorded for a bag whose stored status is `current`. */
export function planHandling(current: unknown, action: HandlingAction): HandlingPlan {
  if (nextAction(current) === action) {
    return { ok: true, newStatus: STATUS_AFTER[action] };
  }
  if (current === 'Offloaded') {
    return {
      ok: false,
      code: 'already-offloaded',
      message: 'This bag has already been offloaded. No change was made.',
    };
  }
  if (current === 'Loading' && action === 'Loading') {
    return {
      ok: false,
      code: 'already-loaded',
      message: 'This bag has already been loaded. No change was made.',
    };
  }
  if (current === 'Registered' && action === 'Offloading') {
    return {
      ok: false,
      code: 'not-loaded',
      message: 'This bag has not been loaded yet. Record loading first.',
    };
  }
  return {
    ok: false,
    code: 'unknown-status',
    message: `This bag has an unrecognised status (“${String(current)}”). No change was made.`,
  };
}
