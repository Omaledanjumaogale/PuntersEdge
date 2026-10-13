/** A renewal starts at the existing expiry when it is still in the future. */
export function nextMonthlyExpiry(now: number, existingExpiry = 0) {
  const start = new Date(Math.max(now, existingExpiry));
  const year = start.getUTCFullYear(), month = start.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
  start.setUTCDate(Math.min(start.getUTCDate(), lastDay));
  start.setUTCMonth(month + 1);
  return start.getTime();
}
export function validatePayment(expected: {provider: string; reference: string; amount: number; currency: string}, verified: {provider: string; reference: string; amount: number; currency: string}) {
  if (expected.provider !== verified.provider || expected.reference !== verified.reference || expected.amount !== verified.amount || expected.currency !== verified.currency) throw new Error('Payment does not match the pending subscription.');
}
