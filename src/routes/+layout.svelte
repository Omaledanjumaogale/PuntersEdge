<script lang="ts">
	import '@fontsource-variable/instrument-sans/index.css';
	import './layout.css';
	import { onMount } from 'svelte';
 import {anyApi} from 'convex/server';
 import {pendingActivity,acknowledgeActivity} from '#lib/activity.ts';
 $effect(()=>{const client=auth.client;if(!client)return;const ping=()=>{if(document.visibilityState==='visible'){const events=pendingActivity();void client.mutation(anyApi.testers.presence,{route:window.location.pathname,events}).then(accepted=>{if(accepted)acknowledgeActivity(events);}).catch(()=>{});}};ping();const timer=setInterval(ping,300000);return ()=>clearInterval(timer);});
	import VipInvitation from '#lib/components/VipInvitation.svelte';
	import RenewalNotice from '#lib/components/RenewalNotice.svelte';
	import AccessNotice from '#lib/components/AccessNotice.svelte';
	import EcosystemBanner from '#lib/components/EcosystemBanner.svelte';
	import SEO from '#lib/components/SEO.svelte';
	import ToastProvider from '#lib/components/ToastProvider.svelte';
	import { page,navigating } from '$app/state';
	import {premiumPath} from '#lib/access-routes.ts';
	import { goto } from '$app/navigation';
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
	import PageSpotlight from '#lib/components/PageSpotlight.svelte';

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

</script>

<a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-chalk focus:px-4 focus:py-2 focus:text-ink">Skip to content</a>

<SEO meta={data.seo} />
<ToastProvider />
<TopBar />
{#if navigating.to}<div class="fixed inset-x-0 top-0 z-[100] h-1 bg-model" role="status" aria-label="Opening page"><span class="sr-only">Opening page…</span></div>{/if}
{#if page.url.pathname === '/'}<EcosystemBanner />{/if}
<main id="main" class:admin-main={page.url.pathname.startsWith('/admin')} class="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 md:pb-12">
	{#if !['/login','/signup','/reset-password','/auth','/subscribe'].includes(page.url.pathname)}<PageSpotlight/>{/if}
	{#if ['/bet-machine','/board','/value-bets','/football','/nba','/basketball','/hockey','/baseball','/results'].includes(page.url.pathname)}<AccessNotice />{/if}
	{#if !['/login','/signup','/subscribe'].includes(page.url.pathname)}<RenewalNotice/>{/if}
	{#if !premiumPath(page.url.pathname)||entitled}{@render children()}{:else}<p class="surface p-8 text-haze" role="status">Checking VIP membership…</p>{/if}
</main>
{#if !page.url.pathname.startsWith('/admin')}<BottomNav />{/if}
<SlipSheet />
<MenuDrawer />
<MarketPicker />
<PwaBanners />

<VipInvitation />
