<script lang="ts">
	import { app, type Prediction } from '#lib/state.svelte.ts';
	import { tilt } from '#lib/actions/tilt.ts';
	import { kickoff, countdown } from '#lib/format.ts';
	import ProbBar from './ProbBar.svelte';
	import PickTicket from './PickTicket.svelte';
	import { TrendingDown, UserX } from 'lucide-svelte';

	let { p }: { p: Prediction } = $props();
	const pick = $derived(p.bestValue);
</script>

<article
	use:tilt={{ max: 4, enabled: app.settings.motion }}
	class="surface group relative flex flex-col gap-4 p-4 sm:p-5 hover:shadow-[0_24px_60px_-28px_rgb(54_224_194/0.35)]"
>
	<header class="flex items-center justify-between gap-3 text-xs">
		<span class="text-haze">
			<span class="mr-1">{p.sport === 'football' ? '⚽' : '🏀'}</span>{p.league}
		</span>
		<time datetime={p.kickoffTime} class="text-haze" title={countdown(p.kickoffTime, app.now)}>{kickoff(p.kickoffTime, app.now)}</time>
	</header>

	<a href="/match/{p.fixtureId}" class="-m-1 block rounded-lg p-1" aria-label="Open {p.matchTitle}">
		<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
			<h3 class="truncate text-lg font-semibold leading-tight sm:text-xl">{p.homeTeam}</h3>
			{#if p.sport === 'football'}
				<span class="rounded-full bg-ink px-2.5 py-1 font-display text-sm font-semibold ring-1 ring-line">
					{p.topScorelines[0].home}–{p.topScorelines[0].away}
				</span>
			{:else}
				<span class="rounded-full bg-ink px-2.5 py-1 font-display text-sm font-semibold ring-1 ring-line">
					{Math.round(p.projectedScore.home)}–{Math.round(p.projectedScore.away)}
				</span>
			{/if}
			<h3 class="truncate text-right text-lg font-semibold leading-tight sm:text-xl">{p.awayTeam}</h3>
		</div>
		<p class="mt-1 text-center text-xs text-haze">
			{#if p.sport === 'football'}
				Most likely score (xG {p.expectedGoals.homeLambda.toFixed(2)}–{p.expectedGoals.awayMu.toFixed(2)})
			{:else}
				Projected score over {p.paceMetrics.possessionsPer48} possessions
			{/if}
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
		<ul class="flex flex-wrap gap-2 text-xs">
			{#if p.marketSteamAlert}
				<li class="inline-flex items-center gap-1 rounded-full bg-book/10 px-2.5 py-1 text-book">
					<TrendingDown class="h-3.5 w-3.5" /> Price moving
				</li>
			{/if}
			{#if p.absences.length > 0}
				<li class="inline-flex items-center gap-1 rounded-full bg-line/60 px-2.5 py-1 text-chalk">
					<UserX class="h-3.5 w-3.5" />
					{p.absences.length} out
				</li>
			{/if}
		</ul>
	{/if}

	{#if pick}
		<PickTicket {pick} />
	{/if}
</article>
