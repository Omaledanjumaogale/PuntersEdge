/**
 * PWA runtime: service-worker registration with update detection, the
 * deferred install prompt (Chromium), iOS add-to-home-screen guidance, and
 * online/offline status.
 */

import { auth } from '#lib/auth.svelte.ts';
import { anyApi } from 'convex/server';
import { toast } from '#lib/toast.svelte.ts';

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'qe:install-dismissed';

class PwaState {
	canInstall = $state(false);
	installed = $state(false);
	isIOS = $state(false);
	showIOSHint = $state(false);
	updateReady = $state(false);
	offline = $state(false);
	pushEnabled = $state(false);
	pushBusy = $state(false);
	lastPushDelivery=$state<{at:number;outcome:'accepted'|'failed';statusCode?:number}|null>(null);
	notificationPermission = $state<NotificationPermission | 'unsupported'>('unsupported');
	#started = false;
	#deferred: BeforeInstallPromptEvent | null = null;
	#waiting: ServiceWorker | null = null;
	#applyRequested=false;

	init() {
		if (typeof window === 'undefined' || this.#started) return;
		this.#started = true;
		if ('Notification' in window && window.isSecureContext) this.notificationPermission = Notification.permission;

		const standalone =
			window.matchMedia('(display-mode: standalone)').matches ||
			(navigator as Navigator & { standalone?: boolean }).standalone === true;
		this.installed = standalone;
		this.isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);

		let dismissed = false;
		try {
			dismissed = Number(localStorage.getItem(DISMISS_KEY) ?? 0) > Date.now() - 7 * 86_400_000;
		} catch {
			/* ignore */
		}
		this.showIOSHint = this.isIOS && !standalone && !dismissed;

		window.addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault();
			this.#deferred = e as BeforeInstallPromptEvent;
			this.canInstall = !this.installed;
		});
		window.addEventListener('appinstalled', () => {
			this.installed = true;
			this.canInstall = false;
			this.#deferred = null;
		});

		this.offline = !navigator.onLine;
		window.addEventListener('online', () => (this.offline = false));
		window.addEventListener('offline', () => (this.offline = true));

		this.#registerServiceWorker();
	}

	async #registerServiceWorker() {
		if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
		try {
			const reg = await navigator.serviceWorker.register('/service-worker.js');
			await this.reconcileNotifications();

			const track = (worker: ServiceWorker | null) => {
				if (!worker) return;
				worker.addEventListener('statechange', () => {
					// A new worker installed while an old one controls the page → update ready.
					if (worker.state === 'installed' && navigator.serviceWorker.controller) {
						this.#waiting = worker;
						this.updateReady = true;
					}
				});
			};

			if (reg.waiting && navigator.serviceWorker.controller) {
				this.#waiting = reg.waiting;
				this.updateReady = true;
			}
			track(reg.installing);
			reg.addEventListener('updatefound', () => track(reg.installing));

			let reloading = false;
			navigator.serviceWorker.addEventListener('controllerchange', () => {
				if (!this.#applyRequested) { this.updateReady=true; return; }
				if (reloading) return;
				reloading = true;
				location.reload();
			});

			// Foreground checks are bounded; they never reload the active page.
			let lastCheck=Date.now();
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible'&&Date.now()-lastCheck>=3600000) {lastCheck=Date.now();reg.update().catch(() => {});}
			});
		} catch (err) {
			console.warn('[PuntersEdge] service worker registration failed', err);
		}
	}

	async reconcileNotifications(){
		const client=auth.client,owner=auth.viewer?.id;
		this.pushEnabled=false;this.lastPushDelivery=null;
		if(!client||!auth.viewer?.activeSubscription||typeof navigator==='undefined'||!('serviceWorker' in navigator))return;
		try{const subscription=await (await navigator.serviceWorker.getRegistration())?.pushManager?.getSubscription();if(!subscription)return;const status=await client.query(anyApi.push.deviceStatus,{endpoint:subscription.endpoint});if(auth.client!==client||auth.viewer?.id!==owner)return;this.pushEnabled=status.registered;this.lastPushDelivery=status.lastDelivery;}catch{/* Unverified browser subscriptions must not display as connected. */}
	}

	async testNotifications(){
		if(this.pushBusy||!auth.client)return;this.pushBusy=true;
		try{const subscription=await (await navigator.serviceWorker.getRegistration())?.pushManager?.getSubscription();if(!subscription)throw new Error('Enable notifications on this device first.');await auth.client.action(anyApi.notifications.testDevice,{endpoint:subscription.endpoint});await this.reconcileNotifications();toast.success('Push service accepted the test. Check your device notifications, including with the app closed.');}catch(error){toast.error(error instanceof Error?error.message:'The notification test failed.');await this.reconcileNotifications();}finally{this.pushBusy=false;}
	}

	async enableNotifications() {
		if(this.pushBusy)return;
		if (!auth.client) { toast.error('Sign in with an active subscription to enable push notifications.'); return; }
		if (!('Notification' in window) || !('PushManager' in window) || !window.isSecureContext || !('serviceWorker' in navigator)) {
			toast.error('Push notifications need HTTPS and a supported browser. On iPhone, install the app first.'); return;
		}
		this.pushBusy = true;
		try {
			// Ask permission directly from the user's click, before network awaits.
			this.notificationPermission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
			if (this.notificationPermission !== 'granted') { toast.show('Allow notifications in your browser settings to enable push alerts.'); return; }
			const { publicKey } = await auth.client.query(anyApi.push.publicVapid, {});
			if (!publicKey) throw new Error('Background notification delivery is not configured yet.');
			const registration = await navigator.serviceWorker.getRegistration();
			if (!registration?.active || !registration.pushManager) throw new Error('Install or reload the production app before enabling background notifications.');
			const bytes = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
			const previous = await registration.pushManager.getSubscription();
			const subscription = previous ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
			try {
				const json = subscription.toJSON();
				await auth.client.mutation(anyApi.push.register, { endpoint: subscription.endpoint, p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' });
			} catch (error) { if (!previous) await subscription.unsubscribe(); throw error; }
			this.pushEnabled = true;
			toast.success('Your selected event notifications are enabled on this device.');
		} catch (error) { toast.error(error instanceof Error ? error.message : 'Could not enable background notifications.'); }
		finally { this.pushBusy = false; }
	}

	async disableNotifications() {
		if(this.pushBusy)return;
		this.pushBusy = true;
		try {
			const subscription = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
			if (subscription) {
				try { if (auth.client) await auth.client.mutation(anyApi.push.remove, { endpoint: subscription.endpoint }); }
				finally { await subscription.unsubscribe(); this.pushEnabled = false; }
			}
			this.pushEnabled = false;
			toast.success('Background notifications disabled on this device.');
		} catch { toast.error('Could not disable notifications. Please try again.'); }
		finally { this.pushBusy = false; }
	}

	async notify(title: string, body: string) {
		if (this.notificationPermission !== 'granted') return;
		const registration = await navigator.serviceWorker?.getRegistration();
		if (registration) await registration.showNotification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'puntersedge-alert', data: { url: '/' } });
		else new Notification(title, { body });
	}

	async install() {
		if (!this.#deferred) return;
		try {
			await this.#deferred.prompt();
			const { outcome } = await this.#deferred.userChoice;
			if (outcome === 'accepted') this.installed = true;
		} catch { toast.error('Installation could not start. Use your browser menu to install the app.'); }
		finally { this.#deferred = null; this.canInstall = false; }
	}

	dismissIOSHint() {
		this.showIOSHint = false;
		try {
			localStorage.setItem(DISMISS_KEY, String(Date.now()));
		} catch {
			/* ignore */
		}
	}

	applyUpdate() {
		if(!this.updateReady)return;this.#applyRequested=true;
		if(this.#waiting)this.#waiting.postMessage({ type: 'SKIP_WAITING' });
		else location.reload();
	}
}

export const pwa = new PwaState();
