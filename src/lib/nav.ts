/** Primary navigation, shared by the header, the menu drawer and the tab bar. */
import { SPORTS, SPORT_ORDER } from '#lib/sports.ts';

export interface NavItem {
	href: string;
	label: string;
	emoji: string;
	hint: string;
	group: 'main' | 'sport' | 'more';
	/** Other paths that count as this item being active. */
	also?: string[];
}

const sportHrefs = SPORT_ORDER.map((s) => SPORTS[s].href);

export const NAV: NavItem[] = [
	{ href: '/', label: 'Home', emoji: '🏠', hint: 'Start here', group: 'main' },
	{ href: '/board', label: 'Board', emoji: '📊', hint: "Today's top picks", group: 'main' },
	{ href: '/sports', label: 'Sports', emoji: '🏟️', hint: 'Five sports, one place', group: 'main', also: sportHrefs },
	...SPORT_ORDER.map((s) => ({
		href: SPORTS[s].href,
		label: SPORTS[s].label,
		emoji: SPORTS[s].emoji,
		hint: SPORTS[s].markets.split(',')[0],
		group: 'sport' as const
	})),
	{ href: '/value-bets', label: 'Value bets', emoji: '🔥', hint: 'Prices above fair', group: 'main' },
	{ href: '/bet-machine', label: 'Bet machine', emoji: '🎟️', hint: 'Build a model-ranked accumulator', group: 'more' },
	{ href: '/results', label: 'Results', emoji: '📈', hint: 'Scores and our record', group: 'main' },
	{ href: '/betslips', label: 'Slip history', emoji: '🧾', hint: 'Saved slips, PDF and sharing', group: 'more' },
	{ href: '/bookmakers', label: 'Bookmakers', emoji: '🏦', hint: 'Who keeps the most', group: 'more' },
	{ href: '/glossary', label: 'Glossary', emoji: '📖', hint: 'Terms explained', group: 'more' },
	{ href: '/subscribe', label: 'All-access', emoji: '🔓', hint: '₦10,000 monthly membership', group: 'more' },
	{ href: '/settings', label: 'Settings', emoji: '⚙️', hint: 'Bankroll and theme', group: 'more' }
];

export function isActive(pathname: string, href: string, also: string[] = []) {
	const hit = (h: string) => (h === '/' ? pathname === '/' : pathname === h || pathname.startsWith(`${h}/`));
	return hit(href) || also.some(hit);
}
