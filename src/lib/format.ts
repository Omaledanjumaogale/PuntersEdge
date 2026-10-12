/** Display formatting helpers. */

export const pct = (p: number, digits = 0) => `${(p * 100).toFixed(digits)}%`;

export const odds = (o: number) => (Number.isFinite(o) ? o.toFixed(2) : '—');

export const signed = (n: number, digits = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(digits)}`;

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
export const ngn = (n: number) => naira.format(n);

const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** "Today 19:45", "Tomorrow 20:00", "Thu 15 Oct 17:30". */
export function kickoff(iso: string, now = Date.now()) {
	const d = new Date(iso);
	const startOfDay = (t: number) => new Date(new Date(t).toDateString()).getTime();
	const days = Math.round((startOfDay(d.getTime()) - startOfDay(now)) / 86_400_000);
	const label = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : weekday.format(d);
	return `${label} ${time.format(d)}`;
}

/** "in 4h 15m" / "in 2d". */
export function countdown(iso: string, now = Date.now()) {
	const ms = new Date(iso).getTime() - now;
	if (ms <= 0) return 'started';
	const h = Math.floor(ms / 3_600_000);
	if (h >= 48) return `in ${Math.round(h / 24)}d`;
	const m = Math.floor((ms % 3_600_000) / 60_000);
	return h > 0 ? `in ${h}h ${m}m` : `in ${m}m`;
}

export const gradeTone: Record<string, string> = {
	'A+': 'bg-model text-ink',
	A: 'bg-model/80 text-ink',
	B: 'bg-model/25 text-model',
	C: 'bg-line text-chalk',
	PASS: 'bg-transparent text-haze ring-1 ring-line'
};
