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
	A: 'bg-model text-ink',
	B: 'tint-model text-model ring-1 ring-model/50',
	C: 'bg-raised text-chalk ring-1 ring-line',
	PASS: 'bg-raised text-haze ring-1 ring-line'
};

/** Emoji that pairs with each value grade. */
export const gradeEmoji: Record<string, string> = { 'A+': '🔥', A: '⚡', B: '👍', C: '🤏', PASS: '✋' };

/** Plain-language meaning of each grade, for tooltips and screen readers. */
export const gradeMeaning: Record<string, string> = {
	'A+': 'Strong value',
	A: 'Good value',
	B: 'Some value',
	C: 'Thin value',
	PASS: 'No value at this price'
};

export const sportEmoji: Record<string, string> = { football: '⚽', basketball: '🏀', nba: '⛹️', hockey: '🏒', baseball: '⚾', tennis: '🎾' };

/** Short status label for a game: "LIVE 2–1 67'", "FT 3–2", "Postponed". */
export function statusLabel(s: { state: string; home?: number; away?: number; detail?: string } | undefined) {
	if (!s || s.state === 'scheduled') return '';
	const score = Number.isFinite(s.home) && Number.isFinite(s.away) ? `${s.home}–${s.away}` : '';
	if (s.state === 'live') return `LIVE ${score}${s.detail ? ` ${s.detail}` : ''}`.trim();
	if (s.state === 'finished') return `FT ${score}`.trim();
	return 'Postponed';
}

/** "12 min ago", "3 h ago". */
export function ago(iso: string | number, now = Date.now()) {
	const ms = now - (typeof iso === 'number' ? iso : Date.parse(iso));
	if (!Number.isFinite(ms)) return '';
	const m = Math.round(ms / 60_000);
	if (m < 1) return 'just now';
	if (m < 60) return `${m} min ago`;
	const h = Math.round(m / 60);
	return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}
