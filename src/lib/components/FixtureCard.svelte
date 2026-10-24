<script lang="ts">
	import { app, type Prediction } from '#lib/state.svelte.ts';
	import { tilt } from '#lib/actions/tilt.ts';
	import { PuntersEdgeAIAgentHub } from '#lib/engine/ai_agent_orchestrator.js';
	import { kickoff, countdown, sportEmoji, pct } from '#lib/format.ts';
	import ProbBar from './ProbBar.svelte';
	import StatusPill from './StatusPill.svelte';
	import PickTicket from './PickTicket.svelte';
	import PickInsight from './PickInsight.svelte';
 import OpportunityIndicator from './OpportunityIndicator.svelte';
 import {fixtureOpportunity} from '#lib/engine/opportunities.js';
	import { slide } from 'svelte/transition';
	import { ChevronDown } from 'lucide-svelte';

	let { p }: { p: Prediction } = $props();
	let open = $state(false);
	// Pre-match edges aren't bets once a game is under way.
	const pick = $derived(p.status.state === 'scheduled' ? p.bestValue : undefined);
	const insightId = $derived(`insight-${p.fixtureId}`);
	const confidence = $derived(new PuntersEdgeAIAgentHub().analyze(p).consensusConfidence);
	const marketCount = $derived(p.markets.reduce((a, g) => a + g.selections.length, 0));
 const opportunity=$derived(fixtureOpportunity(p));
</script>

<article
	use:tilt={{ max: 3, enabled: app.settings.motion && !open }}
	class="surface group relative flex min-w-0 flex-col gap-4 p-4 sm:p-5 hover:shadow-[0_24px_60px_-28px_color-mix(in_oklab,var(--color-pop)_45%,transparent)]"
>
	<header class="flex min-w-0 items-center justify-between gap-2 text-sm">
		<span class="inline-flex min-w-0 items-center gap-1.5 truncate rounded-full bg-raised px-2.5 py-1 font-medium text-chalk ring-1 ring-line">
			<span aria-hidden="true">{sportEmoji[p.sport]}</span>{p.league}
		</span>
		{#if p.status.state === 'scheduled'}
			<time datetime={p.kickoffTime} class="shrink-0 font-medium text-haze" title={countdown(p.kickoffTime, app.now)}>⏰ {kickoff(p.kickoffTime, app.now)}</time>
		{:else}
			<StatusPill status={p.status} />
		{/if}
	</header>

	<a href="/match?id={p.fixtureId}" class="-m-1 block rounded-xl p-1" aria-label="Open {p.matchTitle}">
		<div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
			<h3 class="fixture-name truncate text-lg font-bold leading-tight sm:text-xl">{p.homeTeam}</h3>
			<span class="projection-score rounded-full bg-ink px-3 py-1 font-display text-base font-bold ring-1 ring-line">
				{p.summary.scoreline}
			</span>
			<h3 class="fixture-name truncate text-right text-lg font-bold leading-tight sm:text-xl">{p.awayTeam}</h3>
		</div>
		<p class="mt-1 text-center text-xs text-haze">
			{p.summary.caption}
		</p>
	</a>

 {#if opportunity}<OpportunityIndicator selection={opportunity} />{/if}
	{#if p.family === 'football'}
		<ProbBar
			segments={[
				{ label: 'home', value: p.probabilities.homeWin, tone: 'model' },
				{ label: 'draw', value: p.probabilities.draw, tone: 'neutral' },
				{ label: 'away', value: p.probabilities.awayWin, tone: 'away' }
			]}
		/>
	{:else}
		<ProbBar
			segments={[
				{ label: 'home', value: p.probabilities.homeWin, tone: 'model' },
				{ label: 'away', value: p.probabilities.awayWin, tone: 'away' }
			]}
		/>
	{/if}


	{#if p.marketSteamAlert || p.absences.length > 0}
		<ul class="flex flex-wrap gap-2 text-xs font-medium">
			{#if p.marketSteamAlert}
				<li class="rounded-full tint-book px-2.5 py-1 text-book ring-1 ring-book/40">📉 Price moving</li>
			{/if}
			{#if p.absences.length > 0}
				<li class="rounded-full bg-raised px-2.5 py-1 text-chalk ring-1 ring-line">🚑 {p.absences.length} out</li>
			{/if}
		</ul>
	{/if}

	{#if !pick}
		<div class="flex justify-end gap-2 text-sm">

			{#if marketCount > 0}
				<button onclick={() => (app.pickerFixture = p.fixtureId)} class="rounded-xl px-3 py-2 font-semibold text-chalk ring-1 ring-line hover:ring-pop" aria-label="All markets for {p.matchTitle}">🎯 {marketCount} markets</button>
			{/if}
		</div>
	{/if}

	{#if pick}
		<PickTicket {pick} />
		<div class="-mt-1 grid grid-cols-[1fr_auto] gap-2">
			<button
				onclick={() => (open = !open)}
				aria-expanded={open}
				aria-controls={insightId}
				class="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-chalk ring-1 ring-line transition-colors hover:ring-pop {open ? 'bg-raised' : ''}"
			>
				<span><span aria-hidden="true">📊</span> Why this pick?</span>
				<ChevronDown class="h-4 w-4 transition-transform {open ? 'rotate-180' : ''}" />
			</button>
			<button
				onclick={() => (app.pickerFixture = p.fixtureId)}
				class="rounded-xl px-3 py-2 text-sm font-semibold text-chalk ring-1 ring-line hover:ring-pop"
				aria-label="All markets for {p.matchTitle}"
			>
				🎯 {marketCount} markets
			</button>
		</div>
		{#if open}
			<div id={insightId} transition:slide={{ duration: 260 }}>
				<PickInsight {p} compact />
				<a href="/match?id={p.fixtureId}" class="mt-3 inline-block text-sm font-semibold text-pop underline-offset-4 hover:underline">Full breakdown and every market</a>
			</div>
		{/if}
	{/if}
<a href="/match?id={p.fixtureId}" class="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-amber-300 px-4 py-2 text-sm font-bold text-slate-950">🔎 Full fixture analysis</a>
</article>
