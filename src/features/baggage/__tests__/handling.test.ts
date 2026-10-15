import { describe, expect, it } from '@jest/globals';

import { nextAction, planHandling } from '../handling';

describe('nextAction', () => {
  it('allows exactly one next action per status', () => {
    expect(nextAction('Registered')).toBe('Loading');
    expect(nextAction('Loading')).toBe('Offloading');
    expect(nextAction('Offloaded')).toBeNull();
    expect(nextAction('Lost')).toBeNull();
    expect(nextAction(undefined)).toBeNull();
  });
});

describe('planHandling', () => {
  it('moves a bag one step forward', () => {
    expect(planHandling('Registered', 'Loading')).toEqual({ ok: true, newStatus: 'Loading' });
    expect(planHandling('Loading', 'Offloading')).toEqual({ ok: true, newStatus: 'Offloaded' });
  });

  it('refuses to load a bag twice (TC-10)', () => {
    expect(planHandling('Loading', 'Loading')).toMatchObject({ ok: false, code: 'already-loaded' });
  });

  it('refuses to skip loading (TC-11)', () => {
    expect(planHandling('Registered', 'Offloading')).toMatchObject({ ok: false, code: 'not-loaded' });
  });

  it('refuses any action after offloading', () => {
    expect(planHandling('Offloaded', 'Loading')).toMatchObject({ ok: false, code: 'already-offloaded' });
    expect(planHandling('Offloaded', 'Offloading')).toMatchObject({ ok: false, code: 'already-offloaded' });
  });

  it('refuses unknown statuses', () => {
    expect(planHandling('REGISTERED', 'Loading')).toMatchObject({ ok: false, code: 'unknown-status' });
    expect(planHandling(undefined, 'Loading')).toMatchObject({ ok: false, code: 'unknown-status' });
  });
});
