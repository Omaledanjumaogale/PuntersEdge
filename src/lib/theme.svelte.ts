/**
 * Resolves the theme preference (system / light / dark) to the attribute the
 * CSS tokens key off, and keeps it in sync with the OS setting.
 */
import { app } from '#lib/state.svelte.ts';

class ThemeState {
	systemDark = $state(true);
	resolved = $derived<'light' | 'dark'>(
		app.settings.theme === 'system' ? (this.systemDark ? 'dark' : 'light') : app.settings.theme
	);

	init() {
		if (typeof window === 'undefined') return;
		const mq = window.matchMedia('(prefers-color-scheme: light)');
		this.systemDark = !mq.matches;
		mq.addEventListener('change', (e) => (this.systemDark = !e.matches));
		$effect.root(() => {
			$effect(() => {
				const t = this.resolved;
				document.documentElement.dataset.theme = t;
				document.querySelector<HTMLMetaElement>('meta[name=theme-color]')?.setAttribute('content', t === 'dark' ? '#050505' : '#f4f5ff');
			});
		});
	}

	/** Quick toggle used by the header button: flips between light and dark. */
	toggle() {
		app.settings.theme = this.resolved === 'dark' ? 'light' : 'dark';
	}
}

export const theme = new ThemeState();
