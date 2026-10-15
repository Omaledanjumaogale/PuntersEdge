import type { Settings } from '#lib/state.svelte.ts';
import { convexUrl } from '#lib/convex.ts';
import { createAuthClient } from 'better-auth/client';
import { convexClient } from '@convex-dev/better-auth/client/plugins';
import { ConvexClient } from 'convex/browser';
import { api } from '../../convex/_generated/api.js';

export interface Viewer { id: string; name: string | null; email: string | null; image?:string|null; joined: number; emailVerified: boolean; superAdmin: boolean; role?: string; activeSubscription?: boolean; settings: Settings | null; }
export const PASSWORD_RULE = 'At least 8 characters, including a letter and a number.';
export function passwordIssues(pw: string): string | null {
  if (pw.length < 8) return 'Use at least 8 characters.';
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return 'Mix in at least one letter and one number.';
  return null;
}
export function passwordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  return Math.min(4, Number(pw.length >= 8) + Number(pw.length >= 12) + Number(/[a-z]/.test(pw) && /[A-Z]/.test(pw)) + Number(/\d/.test(pw) && /[^a-zA-Z0-9]/.test(pw))) as 0 | 1 | 2 | 3 | 4;
}
const authClient = createAuthClient({ plugins: [convexClient()] });
class AuthState {
  status = $state<'loading' | 'signedOut' | 'signedIn'>('loading');
  viewer = $state<Viewer | null>(null);
  readonly mode = convexUrl ? 'convex' : 'demo';
  #client: ConvexClient | null = null;
  #started = false;
  #unsubscribe: (() => void) | null = null;
  #restoreFlight: Promise<void> | null = null;
  #onFocus = () => { if(this.status!=='signedIn')void this.#restore(); };
  get signedIn() { return this.status === 'signedIn'; }
  get displayName() { return this.viewer?.name || this.viewer?.email?.split('@')[0] || 'Player'; }
  get initial() { return this.displayName.slice(0,1).toUpperCase(); }
  get client() { return this.signedIn ? this.#client : null; }
  init() {
    if (typeof window === 'undefined' || this.#started) return;
    this.#started = true;
    void this.#restore();
    window.addEventListener('focus', this.#onFocus);
  }
  destroy() {
    if (typeof window !== 'undefined') window.removeEventListener('focus', this.#onFocus);
    this.#clear(); void this.#client?.close(); this.#client = null; this.#started = false;
  }
  async #restore() {
    if (this.#restoreFlight) return this.#restoreFlight;
    this.#restoreFlight = this.#restoreSession();
    try { await this.#restoreFlight; } finally { this.#restoreFlight = null; }
  }
  async #restoreSession() {
    if (!convexUrl) { this.status = 'signedOut'; return; }
    try {
      const session = await authClient.getSession();
      if (!session.data?.session) { this.#clear(); return; }
      await this.#connect();
    } catch { if(this.status!=='signedIn')this.status='signedOut'; }
  }
  async #connect() {
    if (!this.#client) this.#client = new ConvexClient(convexUrl!);
    const client = this.#client;
    const token = await authClient.convex.token();
    if (!token.data?.token) throw new Error('Your session has expired. Log in again.');
    client.setAuth(async () => (await authClient.convex.token()).data?.token ?? null);
    // Ensure local ownership profile exists before authenticated subscriptions.
    const { ConvexHttpClient } = await import('convex/browser');
    const http = new ConvexHttpClient(convexUrl!);
    http.setAuth(token.data.token);
    await http.mutation(api.users.syncProfile, {});
    this.#unsubscribe?.();
    this.#unsubscribe = client.onUpdate(api.users.viewer, {}, (viewer) => {
      if (viewer) { this.viewer = viewer; this.status = 'signedIn'; }
      else this.#clear();
    });
  }
  #clear() { this.viewer = null; this.status = 'signedOut'; this.#unsubscribe?.(); this.#unsubscribe = null; this.#client?.setAuth(async () => null); }
  async signUp(input: { name: string; email: string; password: string }) {
    if (!convexUrl) throw new Error('Account services are not configured.');
    const issue = passwordIssues(input.password); if (issue) throw new Error(issue);
    const result = await authClient.signUp.email({ ...input, name: input.name.trim() || input.email.split('@')[0], callbackURL: `${window.location.origin}/account` });
    if (result.error) throw new Error(result.error.message || 'Could not create your account.');
    return { verificationRequired: true };
  }
  async logIn(input: { email: string; password: string }) {
    if (!convexUrl) throw new Error('Account services are not configured.');
    const result = await authClient.signIn.email(input);
    if (result.error) throw new Error(result.error.message || 'Email or password is incorrect.');
    this.status = 'loading'; await this.#connect();
  }
  async logOut() { const { pwa } = await import('#lib/pwa.svelte.ts'); if (pwa.pushEnabled) await pwa.disableNotifications(); await authClient.signOut();try{if(this.viewer?.id)localStorage.removeItem('pe:feed:v1:'+this.viewer.id);}catch{}this.#clear(); }
  async updateName(name: string) {
    const clean = name.trim().slice(0,40);
    const result = await authClient.updateUser({ name: clean });
    if (result.error) throw new Error(result.error.message || 'Could not update your profile.');
    await this.#client?.mutation(api.users.updateProfile, { name: clean });
  }
  async requestPasswordReset(email: string) {
    const result = await authClient.requestPasswordReset({ email, redirectTo: `${window.location.origin}/reset-password` });
    if (result.error) throw new Error(result.error.message || 'Could not request a password reset.');
  }
  async resetPassword(token: string, newPassword: string) {
    const issue = passwordIssues(newPassword); if (issue) throw new Error(issue);
    const result = await authClient.resetPassword({ token, newPassword });
    if (result.error) throw new Error(result.error.message || 'Could not reset your password.');
  }
}
export const auth = new AuthState();
