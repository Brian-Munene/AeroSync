import { FirebaseError } from 'firebase/app';
import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';

import { db } from '@/lib/firebase';

import { BaggageStatus, HandlingAction, planHandling } from './handling';

const SAVE_TIMEOUT_MS = 10_000;

export class HandlingError extends Error {}

/**
 * Records a handling event and updates the bag's status in ONE transaction.
 *
 * The bag is re-read on the server first, so:
 *  - an action is only saved if it is the next valid step (no double loading,
 *    no offloading before loading), even if another handler scanned it first;
 *  - the event and the status change are saved together or not at all.
 * Transactions need a live connection, so this fails rather than reporting a
 * false success when the device is offline.
 *
 * Writes the same fields as before: handlingEvents {action, baggageId,
 * flightId, handlerUid, timestamp} and BaggageRecords {status,
 * lastHandlingAction, lastHandledBy, lastHandledAt}.
 */
export async function recordHandlingEvent(
  documentId: string,
  action: HandlingAction,
  handlerUid: string
): Promise<BaggageStatus> {
  const baggageRef = doc(db, 'BaggageRecords', documentId);
  const eventRef = doc(collection(baggageRef, 'handlingEvents'));

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new HandlingError(
            'The server did not confirm this action. Check your connection, then scan ' +
              'the bag again to see whether its status changed.'
          )
        ),
      SAVE_TIMEOUT_MS
    );
  });

  try {
    return await Promise.race([
      runTransaction(db, async (tx) => {
        const snapshot = await tx.get(baggageRef);
        if (!snapshot.exists()) {
          throw new HandlingError('This baggage record no longer exists.');
        }
        const data = snapshot.data();
        const plan = planHandling(data.status, action);
        if (!plan.ok) throw new HandlingError(plan.message);

        tx.set(eventRef, {
          action,
          baggageId: data.baggageId || documentId,
          flightId: data.flightId || '',
          handlerUid,
          timestamp: serverTimestamp(),
        });
        tx.update(baggageRef, {
          status: plan.newStatus,
          lastHandlingAction: action,
          lastHandledBy: handlerUid,
          lastHandledAt: serverTimestamp(),
        });
        return plan.newStatus;
      }),
      timeout,
    ]);
  } catch (error) {
    if (error instanceof HandlingError) throw error;
    if (error instanceof FirebaseError && error.code === 'unavailable') {
      throw new HandlingError('You appear to be offline. Nothing was saved. Reconnect and try again.');
    }
    if (error instanceof FirebaseError && error.code === 'permission-denied') {
      throw new HandlingError('Your account is not allowed to record this action.');
    }
    console.error('Recording handling event failed:', error);
    throw new HandlingError('Could not save this action. Please try again.');
  } finally {
    clearTimeout(timer);
  }
}
