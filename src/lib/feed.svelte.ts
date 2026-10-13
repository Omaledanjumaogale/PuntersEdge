/**
 * Live feed loader.
 *
 * The Convex backend publishes one small gzipped file of engine inputs every
 * time its data changes. The app asks for the file's address (a tiny query),
 * downloads it only when the version changed, decompresses it on the device
 * and keeps the last copy in localStorage so it opens instantly and works
 * offline. Without a backend, or before the first live feed exists, the app
 * shows an empty board; it never invents replacement fixtures.
 */
import type { ConvexClient } from 'convex/browser';
import { auth } from '#lib/auth.svelte.ts';
import { convexUrl } from '#lib/convex.ts';
import { api } from '../../convex/_generated/api.js';
import type { SportKey } from '#lib/sports.ts';

export interface FeedGame {
	id: string;
	sport: SportKey;
	league: string;
	home: string;
	away: string;
	kickoff: string;
	status: { state: 'scheduled' | 'live' | 'finished' | 'postponed'; home?: number; away?: number; detail?: string };
	books: number;
	priced: boolean;
	projected?: boolean;
	availabilityReason?: string;
}

export interface RecordLine {
	picks: number;
	won: number;
	lost: number;
	push: number;
	profit: number;
	roi: number;
}

export interface SettledPick {
	uid: string;
	sport: SportKey;
	match: string;
	league: string;
	market: string;
	selection: string;
	bookmaker: string;
	odds: number;
	edge: number;
	grade: string;
	kickoff: number;
	result: string;
	profit: number;
	score: string;
}

export interface UsageLine {
	window: 'day' | 'month';
	limit: number;
	cap: number;
	used: number;
	today: number;
	leftToday: number;
	remote: number | null;
}

export interface LiveFeed {
 access?: 'preview';
 previewFixtures?:{id:string;sport:SportKey;league:string;home:string;away:string;kickoff:string;headline:{selection:string;odds:number;modelProb:number}|null}[];
 gradeHistory?: Record<string,{key:string;at:number;from:string;to:string;modelProb:number;odds:number}[]>;
 projections?: {fixtureId:string;sport:SportKey;match:string;league:string;kickoff:string;publishedAt:number;state:string;score?:string}[];
 reviewInputs?: Record<string,{sport:SportKey;input:any;frozenVerdictKey?:string|null;frozenGrades?:Record<string,string>;publishedAt:number;modelVersion:string}>;
	v: 1;
	generatedAt: string;
	inputs: Record<SportKey, any[]>;
	games: FeedGame[];
	record: { summary: { all: RecordLine; grades: Record<string, RecordLine>; sports: Record<string, RecordLine> }; recent: SettledPick[]; pending: number };
	usage: Record<string, UsageLine> | null;
	sources: Record<string, { at: number; ok: boolean; msg: string }>;
}

const CACHE_KEY = 'pe:feed:v1';

const browser = typeof window !== 'undefined';

async function gunzipJson(buf: ArrayBuffer): Promise<unknown> {
	const bytes = new Uint8Array(buf);
	// Some hosts decompress on the way; accept plain JSON too.
	if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return JSON.parse(new TextDecoder().decode(bytes));
	const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
	return JSON.parse(await new Response(stream).text());
}

class FeedState {
	/** 'unavailable' until a live feed has been loaded at least once. */
	mode = $state<'unavailable' | 'live'>('unavailable');
	status = $state<'idle' | 'checking' | 'downloading' | 'ready' | 'offline' | 'error'>('idle');
	data = $state.raw<LiveFeed | null>(null);
	version = $state<string | null>(null);
	usage = $state.raw<Record<string, UsageLine> | null>(null);
	checkedAt = $state<string | null>(null);
	error = $state<string | null>(null);
	#client: ConvexClient | null = null;
	#dispose: (() => void) | undefined;
	#unsubscribe: (() => void) | undefined;
	#started = false;
	#previewTimer:ReturnType<typeof setInterval>|undefined;
	#generation = 0;
	#requestId = 0;


	/** Hours since the feed was built (Infinity while unavailable). */
	get ageHours() {
		return this.data ? (Date.now() - Date.parse(this.data.generatedAt)) / 3_600_000 : Infinity;
	}

	start() {
		if (!browser || this.#started || !convexUrl) return;
		this.#started = true;
		// The server checks subscription entitlement before releasing the file URL.
		// Never hydrate another user's premium data from a shared browser cache.
		this.#dispose = $effect.root(() => {
			$effect(() => {
				this.#unsubscribe?.();
				clearInterval(this.#previewTimer);
				this.#unsubscribe = undefined;
				this.#generation++;
				const client = auth.client;
				this.#client = auth.viewer?.activeSubscription ? client : null;
				this.data = null; this.version = null; this.mode = 'unavailable'; this.usage = null;
				try { localStorage.removeItem(CACHE_KEY); } catch { /* blocked storage */ }
				if (!this.#client) { void this.#loadPreview(); this.#previewTimer=setInterval(()=>void this.#loadPreview(),120000); return; }
				this.status = 'checking';
				this.#unsubscribe = client!.onUpdate(api.feed.meta, {}, (meta) => {
					void this.#accept(meta);
				}, () => {
					this.#generation++;
					this.data = null; this.version = null; this.mode = 'unavailable';
					this.error = 'Live feeds require an active subscription and a working backend connection.';
					this.status = 'error';
				});
			});
		});
	}

	async #accept(meta: Awaited<ReturnType<ConvexClient['query']>>) {
		const generation = this.#generation;
		const requestId = ++this.#requestId;
		this.checkedAt = new Date().toISOString();
		if (!meta?.url) { this.status = 'ready'; return; }
		this.usage = meta.usage;
		try {
			if (meta.version !== this.version) {
				this.status = 'downloading';
				const res = await fetch(meta.url, { signal: AbortSignal.timeout(15_000) });
				if (!res.ok) throw new Error(`Feed download failed (${res.status})`);
				const data = (await gunzipJson(await res.arrayBuffer())) as LiveFeed;
				if (data?.v !== 1 || !data.inputs || !Array.isArray(data.games)) throw new Error('Unexpected feed format');
				if (generation !== this.#generation || requestId !== this.#requestId) return;
				data.usage = meta.usage; this.data = data; this.version = meta.version; this.mode = 'live';
			}
			this.error = null; this.status = 'ready';
		} catch (err) {
			if (generation !== this.#generation || requestId !== this.#requestId) return;
			this.error = err instanceof Error ? err.message : 'Feed unavailable';
			this.status = navigator.onLine ? 'error' : 'offline';
		}
	}

 async #loadPreview(){
  const generation=this.#generation;this.status='checking';
  try{const response=await fetch('/api/preview',{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('Board previews are temporarily unavailable.');const data=await gunzipJson(await response.arrayBuffer()) as LiveFeed;if(data.access!=='preview'||!Array.isArray(data.previewFixtures))throw new Error('Unexpected preview format.');if(generation!==this.#generation)return;this.data=data;this.mode='live';this.status='ready';this.version=response.headers.get('X-Preview-Version');this.error=null;}catch(error){if(generation!==this.#generation)return;this.error=(error as Error).message;this.status='error';}
 }

	async refresh() {
		if (!this.#client) {await this.#loadPreview();return;}
		try { await this.#accept(await this.#client.query(api.feed.meta, {})); }
		catch { this.error = 'Live feed access could not be verified.'; this.status = 'error'; }
	}

	stop() {
		this.#generation++;
		clearInterval(this.#previewTimer);
		this.#unsubscribe?.(); this.#dispose?.(); this.#client = null;
		this.#unsubscribe = undefined; this.#dispose = undefined; this.#started = false;
	}
}

export const feed = new FeedState();
