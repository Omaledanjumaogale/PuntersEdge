/** The five sports the app covers: labels, routes and how each is modelled. */

export type SportKey = 'football' | 'basketball' | 'nba' | 'hockey' | 'baseball';
export type Family = 'football' | 'basketball' | 'hockey' | 'baseball';

export interface SportInfo {
	key: SportKey;
	family: Family;
	label: string;
	short: string;
	emoji: string;
	href: string;
	/** One line on the engine, for dashboards and the home page. */
	engine: string;
	/** Markets each game is priced for. */
	markets: string;
	unit: string;
	accent: string;
}

export const SPORTS: Record<SportKey, SportInfo> = {
	football: {
		key: 'football',
		family: 'football',
		label: 'Football',
		short: 'Football',
		emoji: '⚽',
		href: '/football',
		engine: 'Dixon–Coles goal model, adjusted for absences and blended with the de-vigged market.',
		markets: '1X2, double chance, draw no bet, Asian handicaps, goal lines, BTTS, team goals, clean sheets',
		unit: 'goals',
		accent: 'var(--color-model)'
	},
	nba: {
		key: 'nba',
		family: 'basketball',
		label: 'NBA',
		short: 'NBA',
		emoji: '⛹️',
		href: '/nba',
		engine: 'Pace × efficiency projection over 48 minutes, priced analytically for any spread or total.',
		markets: 'moneyline, point spread ladder, total points ladder',
		unit: 'points',
		accent: 'var(--color-pop)'
	},
	basketball: {
		key: 'basketball',
		family: 'basketball',
		label: 'Basketball',
		short: 'Hoops',
		emoji: '🏀',
		href: '/basketball',
		engine: 'The same tempo-free model on FIBA rules: 40 minutes and slower European pace.',
		markets: 'moneyline, point spread ladder, total points ladder',
		unit: 'points',
		accent: 'var(--color-book)'
	},
	hockey: {
		key: 'hockey',
		family: 'hockey',
		label: 'Ice hockey',
		short: 'Hockey',
		emoji: '🏒',
		href: '/hockey',
		engine: 'Poisson goal model on the 60-minute score; ties resolved by overtime and shootout like the books settle.',
		markets: 'moneyline, regulation 1X2, puck line ±1.5, total goals ladder, team goals',
		unit: 'goals',
		accent: 'var(--color-glow)'
	},
	baseball: {
		key: 'baseball',
		family: 'baseball',
		label: 'Baseball',
		short: 'Baseball',
		emoji: '⚾',
		href: '/baseball',
		engine: 'Negative-binomial run model (runs come in bunches), extra innings included.',
		markets: 'moneyline, run line ±1.5, total runs ladder, team runs',
		unit: 'runs',
		accent: 'var(--color-loss)'
	}
};

/** Display order. */
export const SPORT_ORDER: SportKey[] = ['football', 'nba', 'basketball', 'hockey', 'baseball'];

export const sportOf = (key: string): SportInfo => SPORTS[(key as SportKey) in SPORTS ? (key as SportKey) : 'football'];
