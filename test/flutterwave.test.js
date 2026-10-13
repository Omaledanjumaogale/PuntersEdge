import test from 'node:test';
import assert from 'node:assert/strict';
import { bankTransferDetails, flutterwaveCompleted, validateV4Charge } from '../convex/lib/flutterwave.ts';
const account = { id: 'van_mock', reference: 'pe_checkout', customer_id: 'cus_member', amount: 10000, currency: 'NGN', account_type: 'dynamic', status: 'active', account_number: '1234567890', account_bank_name: 'Mock bank', narration: 'PuntersEdge monthly membership', account_expiration_datetime: '2030-01-01T00:00:00Z' };
test('v4 instructions bind customer reference amount and currency to temporary account', () => {
  const result = bankTransferDetails(account, 'pe_checkout', 'cus_member', 10000);
  assert.equal(result.kind, 'bankTransfer'); assert.equal(result.accountNumber, '1234567890');
  for (const patch of [{ customer_id: 'cus_other' }, { reference: 'pe_other' }, { amount: 1 }, { amount: 10200 }, { currency: 'USD' }, { account_type: 'static' }, { status: 'disabled' }, { account_number: 'invalid' }, { account_expiration_datetime: 'invalid' }, { account_expiration_datetime: '2020-01-01T00:00:00Z' }]) assert.throws(() => bankTransferDetails({ ...account, ...patch }, 'pe_checkout', 'cus_member', 10000));
});
test('v4 callback requires type/succeeded; v3 retains event/successful', () => {
  assert.deepEqual(flutterwaveCompleted({ type: 'charge.completed', data: { id: 'chg_mock', reference: 'pe_checkout', status: 'succeeded' } }), { apiVersion: 'v4', reference: 'pe_checkout', transactionId: 'chg_mock' });
  assert.deepEqual(flutterwaveCompleted({ event: 'charge.completed', data: { id: 42, tx_ref: 'pe_checkout', status: 'successful' } }), { apiVersion: 'v3', reference: 'pe_checkout', transactionId: '42' });
  assert.equal(flutterwaveCompleted({ type: 'charge.completed', data: { status: 'pending' } }), null);
  assert.equal(flutterwaveCompleted({ type: 'charge.completed', data: { status: 'successful' } }), null);
  assert.equal(flutterwaveCompleted({ type: 'transfer.completed', data: { status: 'succeeded' } }), null);
  assert.throws(() => flutterwaveCompleted({ type: 'charge.completed', data: { id: 'chg_mock', status: 'succeeded', reference: 'foreign' } }));
});
test('v4 verification checks authoritative charge identity and customer ownership', () => {
  const expected = { reference: 'pe_checkout', providerCustomerId: 'cus_member', amount: 10000, currency: 'NGN' };
  const charge = { id: 'chg_mock', status: 'succeeded', reference: 'pe_checkout', customer_id: 'cus_member', amount: 10000, currency: 'NGN' };
  assert.doesNotThrow(() => validateV4Charge(charge, expected, 'chg_mock'));
  for (const patch of [{ id: 'chg_other' }, { status: 'pending' }, { reference: 'pe_other' }, { customer_id: 'cus_other' }, { amount: 1 }, { currency: 'USD' }]) assert.throws(() => validateV4Charge({ ...charge, ...patch }, expected, 'chg_mock'));
  assert.throws(() => validateV4Charge(charge, { ...expected, providerCustomerId: undefined }, 'chg_mock'));
});
