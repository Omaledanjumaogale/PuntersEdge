<script lang="ts">
	import '@fontsource-variable/bricolage-grotesque/opsz.css';
	import '@fontsource-variable/instrument-sans/index.css';
	import './layout.css';
	import { onMount } from 'svelte';
	import VipInvitation from '#lib/components/VipInvitation.svelte';
	import AccessNotice from '#lib/components/AccessNotice.svelte';
	import EcosystemBanner from '#lib/components/EcosystemBanner.svelte';
	import SEO from '#lib/components/SEO.svelte';
	import ToastProvider from '#lib/components/ToastProvider.svelte';
	import { page } from '$app/state';
	import {premiumPath} from '#lib/access-routes.ts';
	import { goto, onNavigate } from '$app/navigation';
	import { app } from '#lib/state.svelte.ts';
	import { pwa } from '#lib/pwa.svelte.ts';
	import { auth } from '#lib/auth.svelte.ts';
	import { theme } from '#lib/theme.svelte.ts';
	import { startSlipSync, startSettingsSync } from '#lib/sync.svelte.ts';
	import { feed } from '#lib/feed.svelte.ts';
	import MenuDrawer from '#lib/components/MenuDrawer.svelte';
	import MarketPicker from '#lib/components/MarketPicker.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import BottomNav from '#lib/components/BottomNav.svelte';
	import SlipSheet from '#lib/components/SlipSheet.svelte';
	import PwaBanners from '#lib/components/PwaBanners.svelte';

	let { children, data } = $props();

	onMount(() => {
		pwa.init();
		theme.init();
		auth.init();
		const stopSync = startSlipSync();
		const stopSettings = startSettingsSync();
		feed.start();
		const clock = setInterval(() => { app.now = Date.now(); }, 60_000);
		return () => { clearInterval(clock); feed.stop(); stopSync(); stopSettings(); auth.destroy(); };
	});

	$effect(()=>{auth.client;auth.viewer?.id;auth.viewer?.activeSubscription;void pwa.reconcileNotifications();});

	$effect(() => {
		document.documentElement.dataset.motion = app.settings.motion ? 'on' : 'off';
	});

	const entitled = $derived(!!(auth.viewer?.activeSubscription || auth.viewer?.superAdmin));
	$effect(()=>{if(auth.status!=='loading'&&!entitled&&premiumPath(page.url.pathname))void goto('/board?upgrade=1',{replaceState:true});});

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

<SEO meta={data.seo} />
<ToastProvider />
<TopBar />
{#if page.url.pathname === '/'}<EcosystemBanner />{/if}
<main id="main" class:admin-main={page.url.pathname.startsWith('/admin')} class="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 md:pb-12">
	{#if ['/bet-machine','/board','/value-bets','/football','/nba','/basketball','/hockey','/baseball','/results'].includes(page.url.pathname)}<AccessNotice />{/if}
	{#if !premiumPath(page.url.pathname)||entitled}{@render children()}{:else}<p class="surface p-8 text-haze" role="status">Checking VIP membership…</p>{/if}
</main>
{#if !page.url.pathname.startsWith('/admin')}<BottomNav />{/if}
<SlipSheet />
<MenuDrawer />
<MarketPicker />
<PwaBanners />

<VipInvitation />
