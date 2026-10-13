import test from 'node:test';
import assert from 'node:assert/strict';
import { nextMonthlyExpiry, validatePayment } from '../convex/lib/billing.ts';

test('monthly access clamps month-end and preserves UTC time', () => {
  assert.equal(new Date(nextMonthlyExpiry(Date.parse('2026-01-31T14:30:00Z'))).toISOString(), '2026-02-28T14:30:00.000Z');
  assert.equal(new Date(nextMonthlyExpiry(Date.parse('2028-01-31T14:30:00Z'))).toISOString(), '2028-02-29T14:30:00.000Z');
  assert.equal(new Date(nextMonthlyExpiry(Date.parse('2026-12-31T00:00:00Z'))).toISOString(), '2027-01-31T00:00:00.000Z');
});
test('renewals extend existing access without losing remaining days', () => {
  const now = Date.parse('2026-01-10T00:00:00Z');
  assert.equal(new Date(nextMonthlyExpiry(now, Date.parse('2026-02-20T00:00:00Z'))).toISOString(), '2026-03-20T00:00:00.000Z');
  assert.equal(new Date(nextMonthlyExpiry(now, Date.parse('2025-12-20T00:00:00Z'))).toISOString(), '2026-02-10T00:00:00.000Z');
});
test('provider verification rejects underpayment, wrong currency, reference or gateway', () => {
  const expected = { provider: 'korapay', reference: 'unique-ref', amount: 10000, currency: 'NGN' };
  assert.doesNotThrow(() => validatePayment(expected, expected));
  for (const patch of [{ amount: 9999 }, { amount: 10001 }, { currency: 'USD' }, { reference: 'other' }, { provider: 'flutterwave' }]) assert.throws(() => validatePayment(expected, { ...expected, ...patch }));
});
