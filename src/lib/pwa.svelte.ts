/**
 * PWA runtime: service-worker registration with update detection, the
 * deferred install prompt (Chromium), iOS add-to-home-screen guidance, and
 * online/offline status.
 */

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
	#deferred: BeforeInstallPromptEvent | null = null;
	#waiting: ServiceWorker | null = null;

	init() {
		if (typeof window === 'undefined') return;

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
				if (reloading) return;
				reloading = true;
				location.reload();
			});

			// Check for a new version whenever the app returns to the foreground.
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible') reg.update().catch(() => {});
			});
		} catch (err) {
			console.warn('[PuntersEdge] service worker registration failed', err);
		}
	}

	async install() {
		if (!this.#deferred) return;
		await this.#deferred.prompt();
		const { outcome } = await this.#deferred.userChoice;
		this.#deferred = null;
		this.canInstall = false;
		if (outcome === 'accepted') this.installed = true;
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
		this.#waiting?.postMessage({ type: 'SKIP_WAITING' });
	}
}

export const pwa = new PwaState();
