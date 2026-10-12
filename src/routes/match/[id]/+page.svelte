<script lang="ts">
	import { app } from '#lib/state.svelte.ts';
	import { kickoff, countdown, pct, odds } from '#lib/format.ts';
	import ScoreSurface3D from '#lib/components/ScoreSurface3D.svelte';
	import MarketTable from '#lib/components/MarketTable.svelte';
	import AgentPanel from '#lib/components/AgentPanel.svelte';
	import PaceLab from '#lib/components/PaceLab.svelte';
	import ProbBar from '#lib/components/ProbBar.svelte';
	import { ChevronLeft } from 'lucide-svelte';

	let { data } = $props();
	let innerWidth = $state(1024);
	const p = $derived(app.byId(data.id)!);
</script>

<svelte:head><title>{p.matchTitle} — QuantEdge</title></svelte:head>
<svelte:window bind:innerWidth />

<a href={p.sport === 'football' ? '/football' : '/basketball'} class="inline-flex items-center gap-1 text-sm text-haze hover:text-chalk">
	<ChevronLeft class="h-4 w-4" /> {p.sport === 'football' ? 'Football' : 'Basketball'}
</a>

<header class="mt-3">
	<p class="text-sm text-haze">{p.league}, {kickoff(p.kickoffTime, app.now)} ({countdown(p.kickoffTime, app.now)})</p>
	<h1 class="mt-1 text-[clamp(2rem,6vw,3.5rem)] font-bold leading-[0.95]">
		{p.homeTeam} <span class="text-haze">vs</span>
		{p.awayTeam}
	</h1>
</header>

{#if p.sport === 'football'}
	<section class="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]" aria-label="Score distribution">
		<div class="surface overflow-hidden">
			{#key p.fixtureId}
				<ScoreSurface3D matrix={p.matrix} homeTeam={p.homeTeam} awayTeam={p.awayTeam} height={innerWidth < 768 ? 320 : 400} autoRotate={false} />
			{/key}
		</div>
		<div class="surface p-5">
			<h2 class="text-lg font-semibold">Most likely scores</h2>
			<ol class="mt-3 space-y-2">
				{#each p.topScorelines.slice(0, 6) as s, i (`${s.home}-${s.away}`)}
					<li class="grid grid-cols-[3rem_1fr_3.5rem] items-center gap-3 text-sm">
						<span class="font-display text-base font-semibold">{s.home}–{s.away}</span>
						<span class="h-2 rounded-full bg-ink"><span class="block h-2 rounded-full bg-model" style="width: {(s.prob / p.topScorelines[0].prob) * 100}%; opacity: {1 - i * 0.1}"></span></span>
						<span class="text-right text-haze">{pct(s.prob, 1)}</span>
					</li>
				{/each}
			</ol>
			<dl class="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
				<div><dt class="text-haze">Expected goals</dt><dd class="font-display text-lg font-semibold">{p.expectedGoals.homeLambda.toFixed(2)} – {p.expectedGoals.awayMu.toFixed(2)}</dd></div>
				<div><dt class="text-haze">Before absences</dt><dd class="font-display text-lg font-semibold text-haze">{p.expectedGoals.baseLambda.toFixed(2)} – {p.expectedGoals.baseMu.toFixed(2)}</dd></div>
				<div><dt class="text-haze">Clean sheet</dt><dd>{pct(p.derived.cleanSheet.home)} / {pct(p.derived.cleanSheet.away)}</dd></div>
				<div><dt class="text-haze">Low-score ρ</dt><dd>{p.expectedGoals.rho.toFixed(2)}</dd></div>
			</dl>
		</div>
	</section>

	<section class="mt-6 surface p-5">
		<ProbBar
			segments={[
				{ label: p.homeTeam, value: p.probabilities.homeWin, tone: 'model' },
				{ label: 'Draw', value: p.probabilities.draw, tone: 'neutral' },
				{ label: p.awayTeam, value: p.probabilities.awayWin, tone: 'away' }
			]}
		/>
		<p class="mt-3 text-sm text-haze">{p.lineupAlert}</p>
	</section>
{:else}
	<section class="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
		<div class="surface p-4"><p class="text-sm text-haze">Projected score</p><p class="font-display text-3xl font-semibold">{Math.round(p.projectedScore.home)}–{Math.round(p.projectedScore.away)}</p></div>
		<div class="surface p-4"><p class="text-sm text-haze">Possessions</p><p class="font-display text-3xl font-semibold">{p.paceMetrics.possessionsPer48}</p></div>
		<div class="surface p-4"><p class="text-sm text-haze">Total vs line</p><p class="font-display text-3xl font-semibold">{p.projectedScore.total} <span class="text-lg text-book">{p.marketLines.total}</span></p></div>
		<div class="surface p-4"><p class="text-sm text-haze">{p.homeTeam.split(' ').at(-1)} win</p><p class="font-display text-3xl font-semibold text-model">{pct(p.probabilities.homeWin)}</p></div>
	</section>
	<p class="mt-3 text-sm text-haze">{p.lineupAlert}</p>
	<div class="mt-6">{#key p.fixtureId}<PaceLab {p} />{/key}</div>
{/if}

<section class="mt-10" aria-labelledby="markets-title">
	<h2 id="markets-title" class="text-2xl font-semibold">Markets</h2>
	<p class="mt-1 text-sm text-haze">
		Model is the engine's blended estimate ({Math.round(p.modelWeight * 100)}% model, rest market). Fair is the price that estimate implies. Best price is the highest across {p.bookmakers.join(', ')}.
	</p>
	<div class="mt-4"><MarketTable rows={p.valueBets} /></div>
</section>

{#if p.sport === 'football'}
	<section class="mt-10" aria-labelledby="derived-title">
		<h2 id="derived-title" class="text-2xl font-semibold">More fair prices</h2>
		<div class="mt-4 grid gap-4 md:grid-cols-3">
			<div class="surface p-4">
				<h3 class="text-base font-semibold">Double chance</h3>
				<dl class="mt-2 space-y-1 text-sm">
					{#each Object.entries(p.derived.doubleChance) as [k, v]}
						<div class="flex justify-between"><dt>{k}</dt><dd><span class="text-haze">{pct(v.prob)}</span> <span class="ml-2 text-model">{odds(v.fairOdds)}</span></dd></div>
					{/each}
				</dl>
			</div>
			<div class="surface p-4">
				<h3 class="text-base font-semibold">Asian handicap ({p.homeTeam})</h3>
				<dl class="mt-2 space-y-1 text-sm">
					{#each [-1.5, -1, -0.5, 0, 0.5, 1] as line}
						{@const h = p.derived.asianHandicap[line]}
						<div class="flex justify-between"><dt>{line > 0 ? '+' : ''}{line}</dt><dd><span class="text-haze">{pct(h.win)}{h.push > 0.001 ? `, push ${pct(h.push)}` : ''}</span> <span class="ml-2 text-model">{odds(h.fairOdds)}</span></dd></div>
					{/each}
				</dl>
			</div>
			<div class="surface p-4">
				<h3 class="text-base font-semibold">Total goals</h3>
				<dl class="mt-2 space-y-1 text-sm">
					{#each [0.5, 1.5, 2.5, 3.5, 4.5] as line}
						{@const t = p.derived.overUnder[line]}
						<div class="flex justify-between"><dt>Over {line}</dt><dd><span class="text-haze">{pct(t.over)}</span> <span class="ml-2 text-model">{odds(t.fairOddsOver)}</span></dd></div>
					{/each}
				</dl>
			</div>
		</div>
	</section>
{/if}

<div class="mt-10"><AgentPanel {p} /></div>
