/**
 * Application state (Svelte 5 runes).
 *
 * Settings and the betslip persist to localStorage; predictions are derived
 * from the sample feed through the engine and recompute whenever a setting
 * that affects pricing (model weight, Kelly fraction) changes.
 */

import { FOOTBALL_INPUTS, BASKETBALL_INPUTS } from '#lib/data/fixtures.js';
import { buildFootballPrediction, buildBasketballPrediction, type ValueBet } from '#lib/engine/prediction_pipeline.js';
import { evaluateAccumulator } from '#lib/engine/bookmaker_engine.js';

export type FootballPrediction = ReturnType<typeof buildFootballPrediction>;
export type BasketballPrediction = ReturnType<typeof buildBasketballPrediction>;
export type Prediction = FootballPrediction | BasketballPrediction;
export type { ValueBet };

export interface Settings {
	bankroll: number;
	kellyFraction: number;
	modelWeight: number;
	motion: boolean;
	theme: 'system' | 'light' | 'dark';
}

export interface SlipItem {
	id: string;
	fixtureId: string;
	sport: 'football' | 'basketball';
	matchTitle: string;
	market: string;
	selection: string;
	bookmaker: string;
	odds: number;
	modelProb: number;
	edgePercent: number;
}

const DEFAULT_SETTINGS: Settings = { bankroll: 50000, kellyFraction: 0.25, modelWeight: 0.6, motion: true, theme: 'system' };
const SETTINGS_KEY = 'qe:settings:v2';
const SLIP_KEY = 'qe:slip:v2';
const browser = typeof window !== 'undefined';

function load<T>(key: string, fallback: T): T {
	if (!browser) return fallback;
	try {
		const raw = localStorage.getItem(key);
		return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
	} catch {
		return fallback;
	}
}

function loadArray<T>(key: string): T[] {
	if (!browser) return [];
	try {
		const parsed = JSON.parse(localStorage.getItem(key) ?? '[]');
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function save(key: string, value: unknown) {
	if (!browser) return;
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		/* storage full or blocked — state still works in memory */
	}
}

class AppState {
	settings = $state<Settings>(load(SETTINGS_KEY, DEFAULT_SETTINGS));
	slip = $state<SlipItem[]>(loadArray<SlipItem>(SLIP_KEY));
	slipOpen = $state(false);
	menuOpen = $state(false);
	/** Fixture whose full market list is open in the picker sheet. */
	pickerFixture = $state<string | null>(null);
	/** Selection just added, so the picker can confirm it. */
	lastAdded = $state<string | null>(null);
	/** Snapshot of "now" so kickoff times are stable within a session. */
	readonly now = Date.now();

	football = $derived(
		FOOTBALL_INPUTS.map((i) =>
			buildFootballPrediction(i, { modelWeight: this.settings.modelWeight, kellyFraction: this.settings.kellyFraction, now: this.now })
		)
	);

	basketball = $derived(
		BASKETBALL_INPUTS.map((i) =>
			buildBasketballPrediction(i, { modelWeight: this.settings.modelWeight, kellyFraction: this.settings.kellyFraction, now: this.now })
		)
	);

	all = $derived<Prediction[]>(
		[...this.football, ...this.basketball].sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime))
	);

	/** Every positive-edge selection across the board, best first. */
	valueBets = $derived<ValueBet[]>(
		this.all
			.flatMap((p) => p.valueBets)
			.filter((v) => v.edgePercent > 0 && v.grade !== 'PASS')
			.sort((a, b) => b.edgePercent - a.edgePercent)
	);

	/** Featured football match for the 3D hero: the strongest football edge. */
	featured = $derived<FootballPrediction>(
		[...this.football].sort((a, b) => (b.bestValue?.edgePercent ?? -99) - (a.bestValue?.edgePercent ?? -99))[0]
	);

	slipEconomics = $derived(evaluateAccumulator(this.slip.map((s) => ({ odds: s.odds, modelProb: s.modelProb }))));

	constructor() {
		if (browser) {
			$effect.root(() => {
				$effect(() => save(SETTINGS_KEY, $state.snapshot(this.settings)));
				$effect(() => save(SLIP_KEY, $state.snapshot(this.slip)));
			});
		}
	}

	byId(id: string): Prediction | undefined {
		return this.all.find((p) => p.fixtureId === id);
	}

	inSlip(id: string) {
		return this.slip.some((s) => s.id === id);
	}

	/** Add or remove a selection. Several markets from one match are allowed. */
	toggle(v: ValueBet) {
		if (this.inSlip(v.id)) {
			this.slip = this.slip.filter((s) => s.id !== v.id);
			return false;
		}
		const item: SlipItem = {
			id: v.id,
			fixtureId: v.fixtureId,
			sport: v.sport,
			matchTitle: v.matchTitle,
			market: v.market,
			selection: v.selection,
			bookmaker: v.bookmaker,
			odds: v.bestOdds,
			modelProb: v.modelProb,
			edgePercent: v.edgePercent
		};
		this.slip = [...this.slip, item];
		return true;
	}

	/** Add a pick and show the rest of that fixture's markets. */
	addAndExplore(v: ValueBet) {
		const added = this.toggle(v);
		if (added) {
			this.lastAdded = v.selection;
			this.pickerFixture = v.fixtureId;
		}
	}

	/** Fixtures with more than one leg in the slip (correlated if combined). */
	sameGameFixtures = $derived(
		new Set(
			this.slip
				.map((s) => s.fixtureId)
				.filter((id, i, arr) => arr.indexOf(id) !== i)
		)
	);

	remove(id: string) {
		this.slip = this.slip.filter((s) => s.id !== id);
	}

	clearSlip() {
		this.slip = [];
	}

	resetSettings() {
		this.settings = { ...DEFAULT_SETTINGS };
	}

	/** Stake in naira for a selection's recommended bankroll percentage. */
	stakeFor(pct: number) {
		return Math.round((this.settings.bankroll * pct) / 100 / 50) * 50;
	}
}

export const app = new AppState();
