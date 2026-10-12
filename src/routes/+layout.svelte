<script lang="ts">
	import '@fontsource-variable/bricolage-grotesque/opsz.css';
	import '@fontsource-variable/instrument-sans/index.css';
	import './layout.css';
	import { onNavigate } from '$app/navigation';
	import { app } from '#lib/state.svelte.ts';
	import { pwa } from '#lib/pwa.svelte.ts';
	import { auth } from '#lib/auth.svelte.ts';
	import { theme } from '#lib/theme.svelte.ts';
	import { startSlipSync } from '#lib/sync.svelte.ts';
	import { feed } from '#lib/feed.svelte.ts';
	import MenuDrawer from '#lib/components/MenuDrawer.svelte';
	import MarketPicker from '#lib/components/MarketPicker.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import BottomNav from '#lib/components/BottomNav.svelte';
	import SlipSheet from '#lib/components/SlipSheet.svelte';
	import PwaBanners from '#lib/components/PwaBanners.svelte';

	let { children } = $props();

	pwa.init();
	theme.init();
	auth.init();
	startSlipSync();
	feed.start();

	$effect(() => {
		document.documentElement.dataset.motion = app.settings.motion ? 'on' : 'off';
	});

	// Cross-fade between routes where the View Transitions API exists.
	onNavigate((navigation) => {
		if (!document.startViewTransition || !app.settings.motion) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-chalk focus:px-4 focus:py-2 focus:text-ink">Skip to content</a>

<TopBar />
<main id="main" class="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 md:pb-12">
	{@render children()}
</main>
<BottomNav />
<SlipSheet />
<MenuDrawer />
<MarketPicker />
<PwaBanners />
