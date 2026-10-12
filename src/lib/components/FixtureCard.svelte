<script lang="ts">
	import { app, type Prediction } from '#lib/state.svelte.ts';
	import { tilt } from '#lib/actions/tilt.ts';
	import { kickoff, countdown, sportEmoji } from '#lib/format.ts';
	import ProbBar from './ProbBar.svelte';
	import PickTicket from './PickTicket.svelte';
	import PickInsight from './PickInsight.svelte';
	import { slide } from 'svelte/transition';
	import { ChevronDown } from 'lucide-svelte';

	let { p }: { p: Prediction } = $props();
	let open = $state(false);
	const pick = $derived(p.bestValue);
	const insightId = $derived(`insight-${p.fixtureId}`);
</script>

<article
	use:tilt={{ max: 3, enabled: app.settings.motion && !open }}
	class="surface group relative flex flex-col gap-4 p-4 sm:p-5 hover:shadow-[0_24px_60px_-28px_color-mix(in_oklab,var(--color-pop)_45%,transparent)]"
>
	<header class="flex items-center justify-between gap-3 text-sm">
		<span class="inline-flex items-center gap-1.5 rounded-full bg-raised px-2.5 py-1 font-medium text-chalk ring-1 ring-line">
			<span aria-hidden="true">{sportEmoji[p.sport]}</span>{p.league}
		</span>
		<time datetime={p.kickoffTime} class="font-medium text-haze" title={countdown(p.kickoffTime, app.now)}>⏰ {kickoff(p.kickoffTime, app.now)}</time>
	</header>

	<a href="/match/{p.fixtureId}" class="-m-1 block rounded-xl p-1" aria-label="Open {p.matchTitle}">
		<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
			<h3 class="truncate text-lg font-bold leading-tight text-chalk sm:text-xl">{p.homeTeam}</h3>
			<span class="rounded-full bg-ink px-3 py-1 font-display text-base font-bold text-chalk ring-1 ring-line">
				{#if p.sport === 'football'}{p.topScorelines[0].home}–{p.topScorelines[0].away}{:else}{Math.round(p.projectedScore.home)}–{Math.round(p.projectedScore.away)}{/if}
			</span>
			<h3 class="truncate text-right text-lg font-bold leading-tight text-chalk sm:text-xl">{p.awayTeam}</h3>
		</div>
		<p class="mt-1 text-center text-xs text-haze">
			{#if p.sport === 'football'}Most likely score (xG {p.expectedGoals.homeLambda.toFixed(2)}–{p.expectedGoals.awayMu.toFixed(2)}){:else}Projected over {p.paceMetrics.possessionsPer48} possessions{/if}
		</p>
	</a>

	{#if p.sport === 'football'}
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
				<li class="rounded-full bg-book/15 px-2.5 py-1 text-book ring-1 ring-book/40">📉 Price moving</li>
			{/if}
			{#if p.absences.length > 0}
				<li class="rounded-full bg-raised px-2.5 py-1 text-chalk ring-1 ring-line">🚑 {p.absences.length} out</li>
			{/if}
		</ul>
	{/if}

	{#if pick}
		<PickTicket {pick} />
		<button
			onclick={() => (open = !open)}
			aria-expanded={open}
			aria-controls={insightId}
			class="-mt-1 flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-chalk ring-1 ring-line transition-colors hover:ring-pop {open ? 'bg-raised' : ''}"
		>
			<span><span aria-hidden="true">📊</span> Why this pick?</span>
			<ChevronDown class="h-4 w-4 transition-transform {open ? 'rotate-180' : ''}" />
		</button>
		{#if open}
			<div id={insightId} transition:slide={{ duration: 260 }}>
				<PickInsight {p} compact />
				<a href="/match/{p.fixtureId}" class="mt-3 inline-block text-sm font-semibold text-pop underline-offset-4 hover:underline">Full breakdown and every market</a>
			</div>
		{/if}
	{/if}
</article>
