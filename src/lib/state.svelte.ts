import {enrichFixtureMetadata} from '#lib/fixture-metadata.js';
import {recordActivity} from '#lib/activity.ts';
/**
 * Application state (Svelte 5 runes).
 *
 * Settings and the betslip persist to localStorage. Predictions are derived on
 * the device: engine inputs come from the live feed when one has loaded (see
 * feed.svelte.ts) and remain empty until that feed is available, and every
 * prediction recomputes when a pricing setting (model weight, Kelly) changes.
 */

import { buildFootballPrediction, buildBasketballPrediction, type ValueBet } from '#lib/engine/prediction_pipeline.js';
import { buildScoreSportPrediction } from '#lib/engine/score_sports.js';
import { evaluateAccumulator } from '#lib/engine/bookmaker_engine.js';
import { feed, type FeedGame } from '#lib/feed.svelte.ts';
import { withModelOnlyMarkets } from '#lib/engine/model-only.js';
import {applyEvidence} from '#lib/engine/evidence.js';
import { SPORT_ORDER, type SportKey } from '#lib/sports.ts';
import {hasQuotedOdds,slipPricing} from '#lib/slip-pricing.js';
import type {TennisFixture,TennisOption} from '#lib/tennis-types.ts';

export type FootballPrediction = ReturnType<typeof buildFootballPrediction>;
export type BasketballPrediction = ReturnType<typeof buildBasketballPrediction>;
export type ScorePrediction = ReturnType<typeof buildScoreSportPrediction>;
export type Prediction = (FootballPrediction | BasketballPrediction | ScorePrediction) & {analysisEvidence?:{approved:boolean;modelVersion:string};confidenceStatus?:string};
export type { ValueBet, SportKey };

export interface Settings {
	bankroll: number;
	kellyFraction: number;
	modelWeight: number;
	motion: boolean;
	theme: 'system' | 'light' | 'dark';
}

export interface SlipItem {
 settledMarkets?:Record<string,'won'|'lost'>;periodScores?:Record<string,{home:number;away:number}>;evidence?:any;kickoff?:number|string;fixtureStatus?:string;family?:string;score?:{home:number;away:number;regHome?:number;regAway?:number};
 league?:string;tournament?:string;country?:string;
	pushProb?: number;
	marketKey?: string;
	id: string;
	fixtureId: string;
	sport: SportKey | 'tennis';
	matchTitle: string;
	market: string;
	selection: string;
	bookmaker: string;
	odds: number;
	modelProb: number;
	edgePercent: number;
}

export const DEFAULT_SETTINGS: Settings = { bankroll: 50000, kellyFraction: 0.25, modelWeight: 0.6, motion: true, theme: 'system' };
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
 #predictionCache = new WeakMap<object,{key:string;value:Prediction|null}>();
 #publishedIds = $derived(new Set((feed.data?.projections??[]).map(p=>p.fixtureId)));
	tennisFixtures = $state<TennisFixture[]>([]);
	settings = $state<Settings>(load(SETTINGS_KEY, DEFAULT_SETTINGS));
	slip = $state<SlipItem[]>(loadArray<SlipItem>(SLIP_KEY));
	slipOpen = $state(false);
	menuOpen = $state(false);
	/** Fixture whose full market list is open in the picker sheet. */
	pickerFixture = $state<string | null>(null);
	/** Selection just added, so the picker can confirm it. */
	lastAdded = $state<string | null>(null);
	/** Snapshot of "now" so kickoff times are stable within a session. */
	now = $state(Date.now());

	/** 'live' once a live feed has loaded; 'unavailable' otherwise. */
	source = $derived(feed.mode);

	/** Engine inputs per sport: the live feed when present, an empty board otherwise. */
	#inputs(sport: SportKey): any[] {
		return feed.data?(feed.data.inputs?.[sport]??[]).filter(i=>this.#publishedIds.has(i.fixtureId)):[];
	}

	#build(sport: SportKey, input: any): Prediction | null {
		const opts = { modelWeight: this.settings.modelWeight, kellyFraction: this.settings.kellyFraction, now: this.now };
  const key=`${sport}:${opts.modelWeight}:${opts.kellyFraction}:${opts.now}`;
  const cached=this.#predictionCache.get(input);if(cached?.key===key)return cached.value;
		try {
      const value=withModelOnlyMarkets(sport==='football'?buildFootballPrediction(input,opts):sport==='basketball'||sport==='nba'?buildBasketballPrediction(input,{...opts,sport}):buildScoreSportPrediction(input,sport,{...opts,sport}),input.quoteObservedAt,input,this.now);
      this.#predictionCache.set(input,{key,value});return value;
		} catch (err) {
			// One malformed game must never take the board down.
			console.warn(`Skipped ${input?.fixtureId}:`, err);
			return null;
		}
	}

	football = $derived(this.#inputs('football').map((i) => this.#build('football', i)).filter(Boolean) as FootballPrediction[]);
	basketball = $derived(this.#inputs('basketball').map((i) => this.#build('basketball', i)).filter(Boolean) as BasketballPrediction[]);
	nba = $derived(this.#inputs('nba').map((i) => this.#build('nba', i)).filter(Boolean) as BasketballPrediction[]);
	hockey = $derived(this.#inputs('hockey').map((i) => this.#build('hockey', i)).filter(Boolean) as ScorePrediction[]);
	baseball = $derived(this.#inputs('baseball').map((i) => this.#build('baseball', i)).filter(Boolean) as ScorePrediction[]);

	bySport(sport: SportKey): Prediction[] {
		return this[sport];
	}

	all = $derived<Prediction[]>(
		SPORT_ORDER.flatMap((s) => this.bySport(s)).sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime))
	);

	/** Every positive-edge selection across the board, best first. */
	valueBets = $derived<ValueBet[]>(
		this.all
			.filter((p) => p.status.state === 'scheduled')
			.flatMap((p) => p.valueBets as ValueBet[])
			.filter((v) => v.edgePercent > 0 && v.grade !== 'PASS')
			.sort((a, b) => b.edgePercent - a.edgePercent)
	);

	/** Featured match for the 3D hero: the highest decision score among sports with a score grid. */
	featured = $derived<FootballPrediction | ScorePrediction | undefined>(
		([...this.football, ...this.hockey, ...this.baseball] as Array<FootballPrediction | ScorePrediction>)
			.filter((p) => p.status.state === 'scheduled')
			.sort((a, b) => (b.bestValue?.decisionScore ?? -99) - (a.bestValue?.decisionScore ?? -99))[0]
	);

	/** Schedule and results: every game the feed knows about (empty until the provider feed arrives). */
	games = $derived<FeedGame[]>(
		feed.data
			? feed.data.games.filter(g=>this.#publishedIds.has(g.id))
			: this.all.map((p) => ({
					id: p.fixtureId,
					sport: p.sport as SportKey,
					league: p.league,
					home: p.homeTeam,
					away: p.awayTeam,
					kickoff: p.kickoffTime,
					status: p.status,
					books: p.bookmakers.length,
					priced: true
				}))
	);
 #gameIndex = $derived(new Map(this.games.map(g=>[g.id,g])));

	slipEconomics = $derived.by(()=>{const priced=this.slip.filter(hasQuotedOdds);const summary=slipPricing(this.slip);return {...evaluateAccumulator(priced.map(s=>({odds:s.odds,modelProb:s.modelProb*(1-(s.pushProb??0))}))),...summary,combinedOdds:summary.totalOdds,evPercent:summary.complete?100*(priced.reduce((n,s)=>n*(s.odds*s.modelProb*(1-(s.pushProb??0))+(s.pushProb??0)),1)-1):0};});

	constructor() {
		if (browser) {
			$effect.root(() => {
				$effect(() => save(SETTINGS_KEY, $state.snapshot(this.settings)));
				$effect(() => save(SLIP_KEY, $state.snapshot(this.slip)));
			});
		}
	}

	/** Reproduce the published baseline, independent of personal model settings. */
	reviewById(id: string): Prediction | undefined {
		const archived = feed.data?.reviewInputs?.[id];
		if (!archived) return undefined;
        const opts = {modelWeight:0.6,kellyFraction:0.25,now:archived.publishedAt};
        try {
            const prediction = withModelOnlyMarkets(archived.sport==='football' ? buildFootballPrediction(archived.input,opts) : archived.sport==='basketball'||archived.sport==='nba' ? buildBasketballPrediction(archived.input,{...opts,sport:archived.sport}) : buildScoreSportPrediction(archived.input,archived.sport,{...opts,sport:archived.sport}),archived.input.quoteObservedAt,archived.input,archived.publishedAt);
            if(archived.frozenGrades) for(const group of prediction.markets) for(const selection of group.selections) {
                const grade=archived.frozenGrades[selection.id.slice(id.length+1)];if(grade)selection.grade=grade;
            }
            if(archived.frozenVerdictKey!==undefined)prediction.bestValue=archived.frozenVerdictKey===null?undefined:prediction.markets.flatMap((g:any)=>g.selections).find((s:any)=>s.id===`${id}:${archived.frozenVerdictKey}`);
            else if(prediction.bestValue&&archived.frozenGrades)prediction.bestValue.grade=archived.frozenGrades[prediction.bestValue.id.slice(id.length+1)]??prediction.bestValue.grade;
            // Historical grades are evidence of an old publication, never an
            // executable current stake. Reapply current freshness/provenance gates.
            return applyEvidence(prediction,archived.input,this.now);
        } catch {return undefined;}
	}
	byId(id: string): Prediction | undefined {
  if(!this.#publishedIds.has(id))return undefined;
  for(const sport of SPORT_ORDER){const input=feed.data?.inputs?.[sport]?.find(i=>i.fixtureId===id);if(input)return this.#build(sport,input)??undefined;}
  return undefined;
	}

	gameById(id: string) {
		const game=this.#gameIndex.get(id);if(game)return game;
		const tennis=this.tennisFixtures.find(f=>f.id===id);
		return tennis?{id:tennis.id,sport:'tennis' as const,league:tennis.tour,tournament:tennis.league,country:undefined,home:tennis.playerA,away:tennis.playerB,kickoff:new Date(tennis.kickoff).toISOString(),status:{state:'scheduled' as const,home:undefined,away:undefined},books:0,priced:false,availabilityReason:'Experimental tennis analysis is available in the tennis workspace.'}:undefined;
	}
	/** Experimental tennis stays separate from validated score-sport engines. */
	toggleTennis(fixture:TennisFixture,market:{key:string;title:string},option:TennisOption){
		const id=`${fixture.id}:${market.key}:${option.side}`;
		if(this.inSlip(id)){this.remove(id);return;}
		const now=Date.now();
		if(!this.tennisFixtures.some(f=>f.id===fixture.id)||fixture.kickoff<=now||fixture.publishedAt>now||now-fixture.publishedAt>86400000||!Number.isFinite(option.modelProb)||option.modelProb<=0||option.modelProb>=1)return;
		this.slip=[...this.slip,{id,fixtureId:fixture.id,sport:'tennis',marketKey:`${market.key}:${option.side}`,matchTitle:`${fixture.playerA} vs ${fixture.playerB}`,league:fixture.tour,tournament:fixture.league,market:market.title,selection:option.selection,bookmaker:'Unpriced experimental estimate',odds:0,modelProb:option.modelProb,edgePercent:0,pushProb:0}];recordActivity('slip_added');
	}

	get resolvedSlip():SlipItem[]{return this.slip.map(item=>{const game=this.gameById(item.fixtureId);return {...enrichFixtureMetadata(item,game),...(game?{fixtureStatus:game.status.state,kickoff:game.kickoff,settledMarkets:(game.status as any).settledMarkets??{},...((game.status as any).periodScores?{periodScores:(game.status as any).periodScores}:{}),...(Number.isFinite(game.status.home)&&Number.isFinite(game.status.away)?{score:{home:game.status.home!,away:game.status.away!,...((game.status as any).regHome!==undefined?{regHome:(game.status as any).regHome}:{}),...((game.status as any).regAway!==undefined?{regAway:(game.status as any).regAway}:{})}}:{})}: {})};});}
	inSlip(id: string) {
		return this.slip.some((s) => s.id === id);
	}

	/** Add or remove a selection. Several markets from one match are allowed. */
	toggle(v: ValueBet) {
		if (this.inSlip(v.id)) {
			this.slip = this.slip.filter((s) => s.id !== v.id);recordActivity('slip_removed');
			return false;
		}
		const game = this.gameById(v.fixtureId);
		if(game?.status.state !== 'scheduled' || Date.parse(game.kickoff) <= Date.now()) return false;
		const item: SlipItem = {
			id: v.id,
   evidence:(v as any).evidence,
			marketKey: v.id.slice(v.fixtureId.length + 1),
			fixtureId: v.fixtureId,
			sport: v.sport as SportKey,
			matchTitle: v.matchTitle,
 league:game.league,tournament:game.tournament,country:game.country,
			market: v.market,
			selection: v.selection,
			bookmaker: v.pricing==='quoted'?v.bookmaker:'Unpriced selection',
			odds: v.pricing==='quoted'&&hasQuotedOdds({odds:v.bestOdds})?v.bestOdds:0,
			modelProb: v.modelProb,
			pushProb: (v as any).pushProb ?? 0,
			edgePercent: v.edgePercent
		};
		this.slip = [...this.slip, item];recordActivity('slip_added');
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
		this.slip = this.slip.filter((s) => s.id !== id);recordActivity('slip_removed');
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
