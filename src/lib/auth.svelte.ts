/**
 * Accounts: sign up, log in, log out.
 *
 * Convex mode (PUBLIC_CONVEX_URL set) speaks the same protocol as the
 * official @convex-dev/auth React client: `auth:signIn` returns a short-lived
 * JWT plus a rotating refresh token; the realtime client asks for a fresh JWT
 * whenever the server needs one, and refreshes are serialised across tabs
 * with the Web Locks API. `auth:signOut` revokes the session server-side.
 *
 * Demo mode (no Convex deployment) keeps accounts on this device only, with
 * PBKDF2-hashed passwords, so every flow can be tried in a preview. The UI
 * labels it clearly.
 */
import { convexUrl } from '#lib/convex.ts';
import type { ConvexClient } from 'convex/browser';
import { api } from '../../convex/_generated/api.js';

export interface Viewer {
	name: string | null;
	email: string | null;
	joined: number;
}

type Tokens = { token: string; refreshToken: string };

const JWT_KEY = 'qe:auth:jwt';
const REFRESH_KEY = 'qe:auth:refresh';
const DEMO_USERS_KEY = 'qe:demo:users';
const DEMO_SESSION_KEY = 'qe:demo:session';
const browser = typeof window !== 'undefined';

export const PASSWORD_RULE = 'At least 8 characters, including a letter and a number.';

export function passwordIssues(pw: string): string | null {
	if (pw.length < 8) return 'Use at least 8 characters.';
	if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return 'Mix in at least one letter and one number.';
	return null;
}

export function passwordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
	let s = 0;
	if (pw.length >= 8) s++;
	if (pw.length >= 12) s++;
	if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
	if (/\d/.test(pw) && /[^a-zA-Z0-9]/.test(pw)) s++;
	return Math.min(4, s) as 0 | 1 | 2 | 3 | 4;
}

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

const store = {
	get(key: string) {
		try {
			return localStorage.getItem(key);
		} catch {
			return null;
		}
	},
	set(key: string, value: string) {
		try {
			localStorage.setItem(key, value);
		} catch {
			/* blocked storage: session lasts for this tab */
		}
	},
	remove(key: string) {
		try {
			localStorage.removeItem(key);
		} catch {
			/* ignore */
		}
	}
};

/** Turn backend failures into messages a person can act on. */
function friendly(err: unknown, flow: 'signIn' | 'signUp'): string {
	const raw = String((err as { data?: unknown })?.data ?? (err as Error)?.message ?? err);
	if (/Enter a valid email|Use at least 8|letter and a number/.test(raw)) return raw.replace(/^.*?(Enter|Use)/, '$1').split('\n')[0];
	if (/fetch|network|Failed to fetch|NetworkError/i.test(raw)) return "Can't reach the server. Check your connection and try again.";
	return flow === 'signUp'
		? 'An account with this email already exists. Log in instead, or use another email.'
		: "That email and password don't match. Check them and try again.";
}

class AuthState {
	status = $state<'loading' | 'signedOut' | 'signedIn'>('loading');
	viewer = $state<Viewer | null>(null);
	readonly mode: 'convex' | 'demo' = convexUrl ? 'convex' : 'demo';

	#client: ConvexClient | null = null;
	#token: string | null = null;
	#unsubscribe: (() => void) | null = null;
	#started = false;

	get signedIn() {
		return this.status === 'signedIn';
	}

	get displayName() {
		return this.viewer?.name || this.viewer?.email?.split('@')[0] || 'Player';
	}

	get initial() {
		return this.displayName.slice(0, 1).toUpperCase();
	}

	init() {
		if (!browser || this.#started) return;
		this.#started = true;
		if (this.mode === 'demo') {
			this.#demoRestore();
			return;
		}
		this.#token = store.get(JWT_KEY);
		void this.#connect();
		// Another tab signed in or out.
		window.addEventListener('storage', (e) => {
			if (e.key !== JWT_KEY) return;
			this.#token = e.newValue;
			if (!e.newValue) this.#setSignedOut();
			else void this.#connect();
		});
	}

	// ── Convex mode ────────────────────────────────────────────────────────

	async #http() {
		const { ConvexHttpClient } = await import('convex/browser');
		return new ConvexHttpClient(convexUrl!);
	}

	async #connect() {
		if (!this.#client) {
			const { ConvexClient } = await import('convex/browser');
			this.#client = new ConvexClient(convexUrl!);
		}
		const client = this.#client;
		if (!this.#token && !store.get(REFRESH_KEY)) {
			this.#setSignedOut();
			return;
		}
		client.setAuth(
			({ forceRefreshToken }) => this.#fetchToken(forceRefreshToken),
			(isAuthenticated) => {
				if (!isAuthenticated) this.#setSignedOut();
			}
		);
		this.#unsubscribe?.();
		this.#unsubscribe = client.onUpdate(api.users.viewer, {}, (v) => {
			if (v) {
				this.viewer = { name: v.name, email: v.email, joined: v.joined };
				this.status = 'signedIn';
			} else if (this.status !== 'loading') {
				this.#setSignedOut();
			}
		});
	}

	async #fetchToken(force: boolean): Promise<string | null> {
		if (!force) return this.#token;
		const refresh = async () => {
			const refreshToken = store.get(REFRESH_KEY);
			if (!refreshToken) return null;
			try {
				const http = await this.#http();
				const { tokens } = (await http.action(api.auth.signIn, { refreshToken })) as { tokens: Tokens | null };
				this.#storeTokens(tokens);
				return tokens?.token ?? null;
			} catch {
				return this.#token;
			}
		};
		// Serialise refreshes across tabs: a refresh token can be used once.
		const locks = navigator.locks;
		return locks ? locks.request(REFRESH_KEY, refresh) : refresh();
	}

	#storeTokens(tokens: Tokens | null) {
		this.#token = tokens?.token ?? null;
		if (tokens) {
			store.set(JWT_KEY, tokens.token);
			store.set(REFRESH_KEY, tokens.refreshToken);
		} else {
			store.remove(JWT_KEY);
			store.remove(REFRESH_KEY);
		}
	}

	#setSignedOut() {
		this.viewer = null;
		this.status = 'signedOut';
	}

	async #convexSignIn(flow: 'signIn' | 'signUp', email: string, password: string, name?: string) {
		const http = await this.#http();
		const params: Record<string, string> = { email: email.trim().toLowerCase(), password, flow };
		if (name) params.name = name.trim();
		let result: { tokens?: Tokens | null };
		try {
			result = (await http.action(api.auth.signIn, { provider: 'password', params })) as { tokens?: Tokens | null };
		} catch (err) {
			throw new Error(friendly(err, flow));
		}
		if (!result.tokens) throw new Error(friendly(null, flow));
		this.#storeTokens(result.tokens);
		this.status = 'loading';
		await this.#connect();
		await this.#waitForViewer();
	}

	#waitForViewer() {
		return new Promise<void>((resolve) => {
			const started = Date.now();
			const tick = () => {
				if (this.status !== 'loading' || Date.now() - started > 8000) resolve();
				else setTimeout(tick, 50);
			};
			tick();
		});
	}

	// ── Demo mode ──────────────────────────────────────────────────────────

	#demoUsers(): Record<string, { name: string; salt: string; hash: string; joined: number }> {
		try {
			return JSON.parse(store.get(DEMO_USERS_KEY) ?? '{}');
		} catch {
			return {};
		}
	}

	async #hash(password: string, salt: string) {
		const enc = new TextEncoder();
		const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
		const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 120_000 }, key, 256);
		return btoa(String.fromCharCode(...new Uint8Array(bits)));
	}

	#demoRestore() {
		const email = store.get(DEMO_SESSION_KEY);
		const user = email ? this.#demoUsers()[email] : undefined;
		if (email && user) {
			this.viewer = { name: user.name || null, email, joined: user.joined };
			this.status = 'signedIn';
		} else this.#setSignedOut();
	}

	async #demoSignIn(flow: 'signIn' | 'signUp', emailRaw: string, password: string, name?: string) {
		const email = emailRaw.trim().toLowerCase();
		const users = this.#demoUsers();
		if (flow === 'signUp') {
			if (users[email]) throw new Error(friendly(null, 'signUp'));
			const salt = crypto.randomUUID();
			users[email] = { name: (name ?? '').trim().slice(0, 40), salt, hash: await this.#hash(password, salt), joined: Date.now() };
			store.set(DEMO_USERS_KEY, JSON.stringify(users));
		} else {
			const u = users[email];
			if (!u || (await this.#hash(password, u.salt)) !== u.hash) throw new Error(friendly(null, 'signIn'));
		}
		store.set(DEMO_SESSION_KEY, email);
		this.#demoRestore();
	}

	// ── Public API ─────────────────────────────────────────────────────────

	async signUp(input: { name: string; email: string; password: string }) {
		if (!emailOk(input.email)) throw new Error('Enter a valid email address.');
		const issue = passwordIssues(input.password);
		if (issue) throw new Error(issue);
		if (this.mode === 'demo') return this.#demoSignIn('signUp', input.email, input.password, input.name);
		return this.#convexSignIn('signUp', input.email, input.password, input.name);
	}

	async logIn(input: { email: string; password: string }) {
		if (!emailOk(input.email)) throw new Error('Enter a valid email address.');
		if (!input.password) throw new Error('Enter your password.');
		if (this.mode === 'demo') return this.#demoSignIn('signIn', input.email, input.password);
		return this.#convexSignIn('signIn', input.email, input.password);
	}

	async logOut() {
		if (this.mode === 'demo') {
			store.remove(DEMO_SESSION_KEY);
			this.#setSignedOut();
			return;
		}
		try {
			if (this.#token) {
				const http = await this.#http();
				http.setAuth(this.#token);
				await http.action(api.auth.signOut, {});
			}
		} catch {
			/* session may already be gone; clear locally regardless */
		}
		this.#storeTokens(null);
		this.#unsubscribe?.();
		this.#unsubscribe = null;
		await this.#client?.close();
		this.#client = null;
		this.#setSignedOut();
	}

	async updateName(name: string) {
		const clean = name.trim().slice(0, 40);
		if (this.mode === 'demo') {
			const users = this.#demoUsers();
			const email = store.get(DEMO_SESSION_KEY);
			if (email && users[email]) {
				users[email].name = clean;
				store.set(DEMO_USERS_KEY, JSON.stringify(users));
				this.#demoRestore();
			}
			return;
		}
		await this.#client?.mutation(api.users.updateProfile, { name: clean });
	}

	/** Realtime client for authenticated queries/mutations (Convex mode only). */
	get client() {
		return this.status === 'signedIn' ? this.#client : null;
	}
}

export const auth = new AuthState();
