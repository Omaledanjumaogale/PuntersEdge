<script lang="ts">
	import { app } from '#lib/state.svelte.ts';
	import { theme } from '#lib/theme.svelte.ts';
	import { pct, kickoff } from '#lib/format.ts';
	import ScoreSurface3D from '#lib/components/ScoreSurface3D.svelte';
	import FixtureCard from '#lib/components/FixtureCard.svelte';
	import PickTicket from '#lib/components/PickTicket.svelte';

	let sport = $state<'all' | 'football' | 'basketball'>('all');
	let innerWidth = $state(1024);

	const f = $derived(app.featured);
	const top = $derived(f.topScorelines[0]);
	const fixtures = $derived(app.all.filter((p) => sport === 'all' || p.sport === sport));
	const picks = $derived(app.valueBets.slice(0, 3));
</script>

<svelte:head><title>QuantEdge — fair prices and value bets</title></svelte:head>
<svelte:window bind:innerWidth />

<!-- Hero: the engine's output for the strongest football edge, in 3D -->
<section class="relative -mx-4 overflow-hidden sm:mx-0 sm:rounded-[var(--radius-sheet)] sm:border sm:border-line" aria-labelledby="hero-title">
	<div class="grid md:grid-cols-[1.1fr_1fr] md:items-center">
		<div class="order-2 px-4 pb-6 sm:px-8 md:order-1 md:py-10">
			<p class="text-sm font-medium text-haze">
				🔥 Top pick, {f.league}, {kickoff(f.kickoffTime, app.now)}
			</p>
			<h1 id="hero-title" class="mt-2 text-[clamp(2.25rem,6vw,3.75rem)] font-bold leading-[0.95]">
				{f.homeTeam}<br /><span class="text-haze">vs</span> {f.awayTeam}
			</h1>
			<p class="mt-4 max-w-md text-[17px] leading-relaxed text-chalk/85">
				The most likely result is <strong class="font-display text-chalk">{top.home}–{top.away}</strong> ({pct(top.prob, 1)}).
				{#if f.bestValue && f.bestValue.edgePercent > 0}
					The market underprices one outcome:
				{:else}
					No price beats fair value here.
				{/if}
			</p>
			{#if f.bestValue}
				<div class="mt-4 max-w-md"><PickTicket pick={f.bestValue} /></div>
			{/if}
			<a href="/match/{f.fixtureId}" class="btn-ghost mt-4 text-sm">📊 See why, plus every market</a>
		</div>
		<div class="order-1 md:order-2">
			{#key `${f.fixtureId}:${theme.resolved}`}
				<ScoreSurface3D matrix={f.matrix} homeTeam={f.homeTeam} awayTeam={f.awayTeam} height={innerWidth < 768 ? 300 : 420} />
			{/key}
		</div>
	</div>
</section>

<!-- How it works: a real three-step flow -->
<section class="mt-8" aria-labelledby="how-title">
	<h2 id="how-title" class="sr-only">How QuantEdge works</h2>
	<ol class="grid gap-3 sm:grid-cols-3">
		{#each [
			{ emoji: '🔍', title: 'Spot the value', text: 'We price every match and flag odds that beat fair value.' },
			{ emoji: '📊', title: 'Check the why', text: 'Tap “Why this pick?” to see the numbers behind each tip.' },
			{ emoji: '🧾', title: 'Build your slip', text: 'Add picks, see your stake and expected profit, copy it out.' }
		] as step, i (step.title)}
			<li class="surface flex items-start gap-3 p-4">
				<span class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-raised text-2xl ring-1 ring-line" aria-hidden="true">{step.emoji}</span>
				<div>
					<p class="font-bold text-chalk"><span class="text-pop">{i + 1}.</span> {step.title}</p>
					<p class="mt-0.5 text-sm text-haze">{step.text}</p>
				</div>
			</li>
		{/each}
	</ol>
</section>

<!-- Strongest edges on the board -->
<section class="mt-10" aria-labelledby="picks-title">
	<div class="flex items-baseline justify-between">
		<h2 id="picks-title" class="text-2xl font-bold text-chalk">🔥 Strongest edges</h2>
		<a href="/value-bets" class="text-sm font-semibold text-pop hover:underline">All {app.valueBets.length} value bets</a>
	</div>
	<div class="scrollbar-none -mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
		{#each picks as pick (pick.id)}
			<div class="w-[85%] shrink-0 snap-start md:w-auto"><PickTicket {pick} showMatch /></div>
		{/each}
	</div>
</section>

<!-- Fixtures -->
<section class="mt-10" aria-labelledby="fixtures-title">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h2 id="fixtures-title" class="text-2xl font-bold text-chalk">📅 Fixtures</h2>
		<div class="flex rounded-full bg-deep p-1 text-sm ring-1 ring-line" role="tablist" aria-label="Filter by sport">
			{#each [['all', '✨ All'], ['football', '⚽ Football'], ['basketball', '🏀 Basketball']] as [value, label]}
				<button
					role="tab"
					aria-selected={sport === value}
					onclick={() => (sport = value as typeof sport)}
					class="rounded-full px-3.5 py-1.5 font-medium transition-colors {sport === value ? 'bg-raised text-chalk ring-1 ring-pop' : 'text-haze hover:text-chalk'}"
				>
					{label}
				</button>
			{/each}
		</div>
	</div>
	<div class="mt-4 grid gap-4 md:grid-cols-2">
		{#each fixtures as p (p.fixtureId)}
			<FixtureCard {p} />
		{/each}
	</div>
	<p class="mt-6 text-sm text-haze">
		🧪 Prices come from a sample feed refreshed on load; every probability, fair price and stake is computed on your device.
		Model weight {Math.round(app.settings.modelWeight * 100)}% vs market, adjustable in <a href="/settings" class="text-chalk underline underline-offset-4">Settings</a>.
	</p>
</section>
