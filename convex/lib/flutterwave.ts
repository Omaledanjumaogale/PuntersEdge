export type CheckoutResult = { kind: 'redirect'; url: string } | {
  kind: 'bankTransfer'; reference: string; amount: number; currency: 'NGN';
  accountNumber: string; bankName: string; accountName: string; expiresAt: string;
};
export function bankTransferDetails(data: Record<string, unknown>, reference: string, customerId: string, amount: number): CheckoutResult {
  if (data.reference !== reference || data.customer_id !== customerId || data.currency !== 'NGN' || Number(data.amount) !== amount || data.account_type !== 'dynamic' || data.status !== 'active') throw new Error('Bank transfer instructions do not match your checkout.');
  if (typeof data.account_number !== 'string' || !/^\d{10}$/.test(data.account_number) || typeof data.account_bank_name !== 'string' || !data.account_bank_name || typeof data.account_expiration_datetime !== 'string' || !Number.isFinite(Date.parse(data.account_expiration_datetime)) || Date.parse(String(data.account_expiration_datetime)) <= Date.now()) throw new Error('Invalid bank transfer instructions.');
  return { kind: 'bankTransfer', reference, amount, currency: 'NGN', accountNumber: data.account_number, bankName: data.account_bank_name, accountName: String(data.narration ?? 'PuntersEdge membership'), expiresAt: data.account_expiration_datetime };
}
export function flutterwaveCompleted(event: { event?: string; type?: string; data?: { status?: string; reference?: string; tx_ref?: string; id?: string | number } }) {
  const d = event.data;
  const apiVersion = event.type === 'charge.completed' ? 'v4' : event.event === 'charge.completed' ? 'v3' : null;
  if (!apiVersion || !d || d.status !== (apiVersion === 'v4' ? 'succeeded' : 'successful')) return null;
  const reference = apiVersion === 'v4' ? d.reference : d.tx_ref;
  if (typeof reference !== 'string' || !reference.startsWith('pe_') || !d.id || !['string', 'number'].includes(typeof d.id)) throw new Error('Invalid payment callback.');
  return { apiVersion, reference, transactionId: String(d.id) };
}
export function validateV4Charge(data: Record<string, unknown>, expected: { reference: string; providerCustomerId?: string; amount: number; currency: string }, transactionId: string) {
  if (!expected.providerCustomerId || data.status !== 'succeeded' || data.id !== transactionId || data.reference !== expected.reference || data.customer_id !== expected.providerCustomerId || Number(data.amount) !== expected.amount || data.currency !== expected.currency) throw new Error('Verified charge does not match your subscription.');
}
