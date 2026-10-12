/**
 * Live feed loader.
 *
 * The Convex backend publishes one small gzipped file of engine inputs every
 * time its data changes. The app asks for the file's address (a tiny query),
 * downloads it only when the version changed, decompresses it on the device
 * and keeps the last copy in localStorage so it opens instantly and works
 * offline. Without a backend, or before the first live feed exists, the app
 * runs on the built-in sample feed and says so.
 */
import { ConvexHttpClient } from 'convex/browser';
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
	v: 1;
	generatedAt: string;
	inputs: Record<SportKey, any[]>;
	games: FeedGame[];
	record: { summary: { all: RecordLine; grades: Record<string, RecordLine>; sports: Record<string, RecordLine> }; recent: SettledPick[]; pending: number };
	usage: Record<string, UsageLine> | null;
	sources: Record<string, { at: number; ok: boolean; msg: string }>;
}

const CACHE_KEY = 'pe:feed:v1';
const POLL_MS = 10 * 60_000;
const browser = typeof window !== 'undefined';

async function gunzipJson(buf: ArrayBuffer): Promise<unknown> {
	const bytes = new Uint8Array(buf);
	// Some hosts decompress on the way; accept plain JSON too.
	if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return JSON.parse(new TextDecoder().decode(bytes));
	const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
	return JSON.parse(await new Response(stream).text());
}

class FeedState {
	/** 'sample' until a live feed has been loaded at least once. */
	mode = $state<'sample' | 'live'>('sample');
	status = $state<'idle' | 'checking' | 'downloading' | 'ready' | 'offline' | 'error'>('idle');
	data = $state.raw<LiveFeed | null>(null);
	version = $state<string | null>(null);
	usage = $state.raw<Record<string, UsageLine> | null>(null);
	checkedAt = $state<string | null>(null);
	error = $state<string | null>(null);
	#client: ConvexHttpClient | null = null;
	#timer: ReturnType<typeof setInterval> | undefined;

	/** Hours since the feed was built (Infinity in sample mode). */
	get ageHours() {
		return this.data ? (Date.now() - Date.parse(this.data.generatedAt)) / 3_600_000 : Infinity;
	}

	start() {
		if (!browser) return;
		try {
			const raw = localStorage.getItem(CACHE_KEY);
			if (raw) {
				const cached = JSON.parse(raw) as { version: string; data: LiveFeed };
				if (cached?.data?.v === 1) {
					this.data = cached.data;
					this.version = cached.version;
					this.usage = cached.data.usage;
					this.mode = 'live';
				}
			}
		} catch {
			/* corrupt cache: ignore */
		}
		if (!convexUrl) return;
		this.#client = new ConvexHttpClient(convexUrl);
		void this.refresh();
		this.#timer = setInterval(() => {
			if (document.visibilityState === 'visible') void this.refresh();
		}, POLL_MS);
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible' && Date.now() - Date.parse(this.checkedAt ?? '0') > 60_000) void this.refresh();
		});
	}

	async refresh() {
		if (!this.#client || this.status === 'checking' || this.status === 'downloading') return;
		if (!navigator.onLine) {
			this.status = 'offline';
			return;
		}
		this.status = 'checking';
		try {
			const meta = await this.#client.query(api.feed.meta, {});
			this.checkedAt = new Date().toISOString();
			if (!meta || !meta.url) {
				this.status = 'ready';
				return;
			}
			this.usage = meta.usage;
			if (meta.version !== this.version) {
				this.status = 'downloading';
				const res = await fetch(meta.url);
				if (!res.ok) throw new Error(`Feed download failed (${res.status})`);
				const data = (await gunzipJson(await res.arrayBuffer())) as LiveFeed;
				if (data?.v !== 1) throw new Error('Unexpected feed format');
				data.usage = meta.usage;
				this.data = data;
				this.version = meta.version;
				this.mode = 'live';
				try {
					localStorage.setItem(CACHE_KEY, JSON.stringify({ version: meta.version, data }));
				} catch {
					/* storage full: keep it in memory */
				}
			}
			this.error = null;
			this.status = 'ready';
		} catch (err) {
			this.error = err instanceof Error ? err.message : String(err);
			this.status = navigator.onLine ? 'error' : 'offline';
		}
	}

	stop() {
		clearInterval(this.#timer);
	}
}

export const feed = new FeedState();
