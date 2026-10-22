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

const sportHrefs = [...SPORT_ORDER.map((s) => SPORTS[s].href),'/tennis'];

export const NAV: NavItem[] = [
	{ href: '/', label: 'Home', emoji: '🏠', hint: 'Start here', group: 'main' },
	{ href: '/board', label: 'Board', emoji: '📊', hint: "Today's top picks", group: 'main' },
	{ href: '/sports', label: 'Sports', emoji: '🏟️', hint: 'Sports and experimental tennis', group: 'main', also: sportHrefs },
	...SPORT_ORDER.map((s) => ({
		href: SPORTS[s].href,
		label: SPORTS[s].label,
		emoji: SPORTS[s].emoji,
		hint: SPORTS[s].markets.split(',')[0],
		group: 'sport' as const
	})),
	{href:'/tennis',label:'Tennis',emoji:'🎾',hint:'Experimental results-based estimates',group:'sport'},
	{ href: '/value-bets', label: 'Market choices', emoji: '💎', hint: 'Projections and observed prices', group: 'main' },
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

/** Shared admin workspace links. The drawer and desktop rail render these same records. */
export const ADMIN_NAV = [
 {href:'/admin/payments',label:'Payment operations',emoji:'💳',hint:'Reconciliation and disputes',section:'payments'},
 {href:'/admin/privacy',label:'Privacy operations',emoji:'🛡️',hint:'Requests and retention',section:'privacy'},
 {href:'/admin/members',label:'User management',emoji:'👥',hint:'Profiles and tester access',section:'users'},
 {href:'/admin',label:'Overview',emoji:'💎',hint:'Performance and coverage',section:'performance'},
 {href:'/admin?workspace=operations',label:'Data operations',emoji:'📡',hint:'Sources, budgets and refreshes',section:'operations'},
 {href:'/admin/evidence/history',label:'Evidence history',emoji:'📜',hint:'Recorded shortlist selections and final outcomes',section:'evidence-history'},
 {href:'/admin/evidence',label:'Evidence shortlist',emoji:'🌡️',hint:'Upcoming picks with comparable outcomes',section:'evidence'},
 {href:'/admin/models',label:'Model registry',emoji:'🧮',hint:'Candidates and evaluation',section:'models'},
 {href:'/admin?workspace=memberships',label:'Members & payments',emoji:'🔑',hint:'Access and billing records',section:'memberships'}
] as const;
export function adminActive(pathname:string,search:string,section:string){
 return pathname.startsWith('/admin/evidence/history')?section==='evidence-history':pathname.startsWith('/admin/evidence')?section==='evidence':pathname.startsWith('/admin/payments')?section==='payments':pathname.startsWith('/admin/privacy')?section==='privacy':pathname.startsWith('/admin/members')?section==='users':pathname.startsWith('/admin/models')?section==='models':pathname==='/admin'&&(new URLSearchParams(search).get('workspace')??'performance')===section;
}
