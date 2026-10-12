/**
 * Keeps the betslip in sync with the signed-in user's Convex record.
 * On sign-in: an empty local slip adopts the saved one; otherwise local wins
 * and is saved. Afterwards, changes are saved (debounced).
 */
import { app } from '#lib/state.svelte.ts';
import { auth } from '#lib/auth.svelte.ts';
import { api } from '../../convex/_generated/api.js';
import type { SportKey } from '#lib/sports.ts';

export function startSlipSync() {
	if (typeof window === 'undefined' || auth.mode !== 'convex') return;
	let adopted = false;
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect.root(() => {
		$effect(() => {
			const client = auth.client;
			const items = $state.snapshot(app.slip);
			if (!client) {
				adopted = false;
				return;
			}
			if (!adopted) {
				adopted = true;
				void client.query(api.betslip.mine, {}).then((saved) => {
					if (saved && app.slip.length === 0 && saved.items.length > 0) {
						app.slip = saved.items.map((i) => ({
							id: `${i.fixtureId}:restored:${i.selection}`,
							fixtureId: i.fixtureId,
							sport: i.sport as SportKey,
							matchTitle: i.matchTitle,
							market: i.market,
							selection: i.selection,
							bookmaker: i.bookmaker,
							odds: i.odds,
							modelProb: i.modelProb ?? 1 / i.odds,
							edgePercent: i.edgePercent
						}));
					}
				});
				return;
			}
			clearTimeout(timer);
			timer = setTimeout(() => {
				void client
					.mutation(api.betslip.save, {
						items: items.map(({ fixtureId, sport, matchTitle, market, selection, bookmaker, odds, modelProb, edgePercent }) => ({
							fixtureId, sport, matchTitle, market, selection, bookmaker, odds, modelProb, edgePercent
						})),
						stake: 1000,
						betType: items.length > 1 ? 'accumulator' : 'single'
					})
					.catch(() => {});
			}, 600);
		});
	});
}
