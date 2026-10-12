/** Primary navigation, shared by the header, the menu drawer and the tab bar. */
export interface NavItem {
	href: string;
	label: string;
	emoji: string;
	hint: string;
}

export const NAV: NavItem[] = [
	{ href: '/', label: 'Home', emoji: '🏠', hint: 'Start here' },
	{ href: '/board', label: 'Board', emoji: '📊', hint: "Today's top picks" },
	{ href: '/football', label: 'Football', emoji: '⚽', hint: 'Every match priced' },
	{ href: '/basketball', label: 'Basketball', emoji: '🏀', hint: 'Pace and totals' },
	{ href: '/value-bets', label: 'Value bets', emoji: '🔥', hint: 'Prices above fair' },
	{ href: '/bookmakers', label: 'Bookmakers', emoji: '🏦', hint: 'Who keeps the most' },
	{ href: '/glossary', label: 'Glossary', emoji: '📖', hint: 'Terms explained' },
	{ href: '/settings', label: 'Settings', emoji: '⚙️', hint: 'Bankroll and theme' }
];

export function isActive(pathname: string, href: string) {
	return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
