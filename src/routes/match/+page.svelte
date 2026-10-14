<script lang="ts">
	import { page } from '$app/state';
	import { app } from '#lib/state.svelte.ts';
	import { feed } from '#lib/feed.svelte.ts';
	import { theme } from '#lib/theme.svelte.ts';
	import { sportOf } from '#lib/sports.ts';
	import { kickoff, countdown, pct, odds, statusLabel } from '#lib/format.ts';
	import ScoreSurface3D from '#lib/components/ScoreSurface3D.svelte';
	import MarketList from '#lib/components/MarketList.svelte';
	import AgentPanel from '#lib/components/AgentPanel.svelte';
	import AIExplanation from '#lib/components/AIExplanation.svelte';
	import PaceLab from '#lib/components/PaceLab.svelte';
	import ProbBar from '#lib/components/ProbBar.svelte';
	import PickInsight from '#lib/components/PickInsight.svelte';
	import PickTicket from '#lib/components/PickTicket.svelte';
	import StatusPill from '#lib/components/StatusPill.svelte';
	import { ChevronLeft } from 'lucide-svelte';
 import {fixtureOpportunity} from '#lib/engine/opportunities.js';
 import OpportunityIndicator from '#lib/components/OpportunityIndicator.svelte';

	let innerWidth = $state(1024);
	const id = $derived(page.url.searchParams.get('id') ?? '');
	const recorded = $derived(feed.data?.reviewInputs?.[id]);
	const review = $derived(page.url.searchParams.get('review') === '1' || ['live','finished'].includes(app.gameById(id)?.status.state ?? ''));
	const p = $derived(id ? (review ? app.reviewById(id) : app.byId(id)) : undefined);
	const game = $derived(id ? app.gameById(id) : undefined);
	const info = $derived(sportOf(p?.sport ?? game?.sport ?? 'football'));
	const hasMarkets = $derived(Boolean(p && p.markets.some((g) => g.selections.length > 0)));
 const opportunity=$derived(p?fixtureOpportunity(p):undefined);
</script>

<svelte:head><title>{p?.matchTitle ?? (game ? `${game.home} vs ${game.away}` : 'Match')} — PuntersEdge</title></svelte:head>
<svelte:window bind:innerWidth />

<a href={info.href} class="inline-flex items-center gap-1 text-sm text-haze hover:text-chalk">
	<ChevronLeft class="h-4 w-4" /> {info.label}
</a>

{#if recorded}
 <aside class="surface mt-4 p-4 text-sm text-haze">
  {#if review}<strong class="text-chalk">Published pre-match review</strong> · {new Date(recorded.publishedAt).toLocaleString('en-NG')} · Baseline model 60%, quarter Kelly. Prices and probabilities are frozen from publication, not recalculated from the result.
  {:else}<a class="font-semibold text-pop underline" href={`/match?id=${encodeURIComponent(id)}&review=1`}>View recorded pre-match projection</a> · {new Date(recorded.publishedAt).toLocaleString('en-NG')}{/if}
  {#if game?.status.state === 'finished'}<p class="mt-2 font-display text-2xl font-bold text-chalk">Final score: {statusLabel(game.status)}</p><p class="mt-1">Analysis remains available for 12 hours after the final result is received.</p>{/if}
 </aside>
{/if}
{#if p}
	<header class="mt-3">
		<p class="flex flex-wrap items-center gap-2 text-sm font-medium text-haze">
			<span>{info.emoji} {p.league}, ⏰ {kickoff(p.kickoffTime, app.now)}{#if p.status.state === 'scheduled'} ({countdown(p.kickoffTime, app.now)}){/if}</span>
			<StatusPill status={p.status} />
		</p>
		<h1 class="mt-1 text-[clamp(2rem,6vw,3.5rem)] font-bold leading-[0.95]">
			{p.homeTeam} <span class="text-haze">vs</span>
			{p.awayTeam}
		</h1>
		{#if p.status.state === 'live'}
			<p class="mt-2 text-sm text-haze">In play. Prices below are the last pre-match prices we saw, so treat edges as history, not bets.</p>
		{/if}
	</header>

	{#if p.bestValue}
		<section class="surface mt-6 grid gap-5 p-5 lg:grid-cols-[1fr_1.2fr]" aria-labelledby="why-title">
			<div class="grid content-start gap-3">
				<h2 id="why-title" class="text-2xl font-bold text-chalk">📊 Why this pick</h2>
				<PickTicket pick={p.bestValue} />
			</div>
			<PickInsight {p} />
		</section>
	{:else}
		<section class="surface mt-6 p-5">
			<h2 class="text-xl font-bold text-chalk">{opportunity?'Estimated value · validation pending':'Market review'}</h2>
			<p class="mt-1 text-haze">
				{#if opportunity}The calculation identifies a favourable estimate, but its market evidence is not approved. Stake remains zero. Review the choice note below.{:else if p.bookmakers.length === 0}We have the fixture and the model's numbers, but no bookmaker has posted prices we can read. Fair prices are below; check back closer to kickoff.{:else}No quoted selection meets all final-verdict rules. Review the market probabilities and value grades below.{/if}
			</p>
   {#if opportunity}<OpportunityIndicator selection={opportunity}/>{/if}
		</section>
	{/if}

	{#if p.family === 'basketball'}
		<section class="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
			<div class="surface p-4"><p class="text-sm text-haze">Projected score</p><p class="font-display text-3xl font-semibold">{Math.round(p.projectedScore.home)}–{Math.round(p.projectedScore.away)}</p></div>
			<div class="surface p-4"><p class="text-sm text-haze">Possessions</p><p class="font-display text-3xl font-semibold">{p.paceMetrics.possessionsPer48}</p></div>
			<div class="surface p-4"><p class="text-sm text-haze">Total vs line</p><p class="font-display text-3xl font-semibold">{p.projectedScore.total} <span class="text-lg text-book">{p.marketLines.total}</span></p></div>
			<div class="surface p-4"><p class="text-sm text-haze">{p.homeTeam.split(' ').at(-1)} win</p><p class="font-display text-3xl font-semibold text-model">{pct(p.probabilities.homeWin)}</p></div>
		</section>
		<p class="mt-3 text-sm text-haze">{p.lineupAlert}</p>
		<div class="mt-6">{#key p.fixtureId}<PaceLab {p} />{/key}</div>
	{:else}
		<section class="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]" aria-label="Score distribution">
			<div class="surface overflow-hidden">
				{#key `${p.fixtureId}:${theme.resolved}`}
					<ScoreSurface3D matrix={p.matrix} homeTeam={p.homeTeam} awayTeam={p.awayTeam} height={innerWidth < 768 ? 320 : 400} autoRotate={false} />
				{/key}
			</div>
			<div class="surface p-5">
				<h2 class="text-lg font-bold text-chalk">🎯 Most likely {p.family === 'football' ? 'scores' : 'regulation scores'}</h2>
				<ol class="mt-3 space-y-2">
					{#each p.topScorelines.slice(0, 6) as s, i (`${s.home}-${s.away}`)}
						<li class="grid grid-cols-[3rem_1fr_3.5rem] items-center gap-3 text-sm">
							<span class="font-display text-base font-semibold">{s.home}–{s.away}</span>
							<span class="h-2 rounded-full bg-ink"><span class="block h-2 rounded-full bg-model" style="width: {(s.prob / p.topScorelines[0].prob) * 100}%; opacity: {1 - i * 0.1}"></span></span>
							<span class="text-right text-haze">{pct(s.prob, 1)}</span>
						</li>
					{/each}
				</ol>
				{#if p.family === 'football'}
					<dl class="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
						<div><dt class="text-haze">Expected goals</dt><dd class="font-display text-lg font-semibold">{p.expectedGoals.homeLambda.toFixed(2)} – {p.expectedGoals.awayMu.toFixed(2)}</dd></div>
						<div><dt class="text-haze">Before absences</dt><dd class="font-display text-lg font-semibold text-haze">{p.expectedGoals.baseLambda.toFixed(2)} – {p.expectedGoals.baseMu.toFixed(2)}</dd></div>
						<div><dt class="text-haze">Clean sheet</dt><dd>{pct(p.derived.cleanSheet.home)} / {pct(p.derived.cleanSheet.away)}</dd></div>
						<div><dt class="text-haze">Low-score ρ</dt><dd>{p.expectedGoals.rho.toFixed(2)}</dd></div>
					</dl>
				{:else}
					<dl class="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
						<div><dt class="text-haze">Expected {p.summary.unit}</dt><dd class="font-display text-lg font-semibold">{p.projectedScore.home.toFixed(2)} – {p.projectedScore.away.toFixed(2)}</dd></div>
						<div><dt class="text-haze">Total vs line</dt><dd class="font-display text-lg font-semibold">{p.projectedScore.total.toFixed(1)} <span class="text-base text-book">{p.marketLines.total}</span></dd></div>
						{#if p.family === 'hockey'}
							<div><dt class="text-haze">Tied after 60 min</dt><dd>{pct(p.probabilities.draw)}</dd></div>
						{/if}
						<div><dt class="text-haze">{p.homeTeam.split(' ').at(-1)} −1.5</dt><dd>{pct(p.probabilities.spreadCoverHome)}</dd></div>
					</dl>
				{/if}
			</div>
		</section>

		<section class="mt-6 surface p-5">
			{#if p.family === 'football'}
				<ProbBar
					segments={[
						{ label: p.homeTeam, value: p.probabilities.homeWin, tone: 'model' },
						{ label: 'Draw', value: p.probabilities.draw, tone: 'neutral' },
						{ label: p.awayTeam, value: p.probabilities.awayWin, tone: 'away' }
					]}
				/>
			{:else}
				<ProbBar
					segments={[
						{ label: p.homeTeam, value: p.probabilities.homeWin, tone: 'model' },
						{ label: p.awayTeam, value: p.probabilities.awayWin, tone: 'away' }
					]}
				/>
			{/if}
			<p class="mt-3 text-sm text-haze">{p.lineupAlert}</p>
		</section>
	{/if}

	<section class="mt-10" aria-labelledby="markets-title">
		<h2 id="markets-title" class="text-2xl font-bold text-chalk">🎯 Markets</h2>
		{#if hasMarkets}
			<p class="mt-1 text-sm text-haze">
				Every market we price for this match. Model is our blended estimate ({Math.round(p.modelWeight * 100)}% model, rest market), fair is the price it implies, and the amber price is the best across {p.bookmakers.join(', ')}.
			</p>
			<div class="mt-4"><MarketList groups={p.markets.filter((g) => g.selections.length > 0)} /></div>
		{:else}
			<p class="mt-1 text-haze">Markets appear here as soon as a bookmaker posts prices.</p>
		{/if}
	</section>

	{#if p.family === 'football'}
		<section class="mt-10" aria-labelledby="derived-title">
			<h2 id="derived-title" class="text-2xl font-bold text-chalk">➕ More fair prices</h2>
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
{:else if game}
	<header class="mt-3">
		<p class="flex flex-wrap items-center gap-2 text-sm font-medium text-haze">
			<span>{info.emoji} {game.league}, ⏰ {kickoff(game.kickoff, app.now)}</span>
			<StatusPill status={game.status} />

		</p>
 {#if game.availabilityReason}<p class="mt-4 rounded-xl bg-ink p-4 text-sm text-haze">{game.availabilityReason}</p>{/if}
		<h1 class="mt-1 text-[clamp(2rem,6vw,3.5rem)] font-bold leading-[0.95]">
			{game.home} <span class="text-haze">vs</span>
			{game.away}
		</h1>
	</header>
	<section class="surface mt-6 p-5">
		{#if game.status.state === 'finished'}
			<p class="font-display text-5xl font-bold text-chalk">{statusLabel(game.status)}</p>
			<p class="mt-2 text-haze">Final score. If we had a graded pick on this game, it's settled on the <a href="/results" class="font-semibold text-pop underline-offset-4 hover:underline">Results</a> page.</p>
		{:else if game.status.state === 'live'}
			<p class="font-display text-5xl font-bold text-chalk">{statusLabel(game.status)}</p>
			<p class="mt-2 text-haze">No pre-match projection was published for this fixture. Live scores are available, but this game is excluded from the prediction track record.</p>
		{:else}
			<p class="text-haze">We know about this game but can't price it yet: no bookmaker prices and no league table to rate the teams from. It will appear on the {info.label} dashboard as soon as we can.</p>
		{/if}
	</section>
	<AIExplanation fixtureId={game.id} sport={game.sport} />
{:else}
	<section class="surface mt-6 p-6">
		<h1 class="text-2xl font-bold text-chalk">🤷 That game isn't on the board</h1>
		<p class="mt-2 text-haze">
			{#if feed.status === 'checking' || feed.status === 'downloading'}Loading the latest games…{:else}It may have finished more than a few days ago, or the link is from an older feed.{/if}
		</p>
		<a href="/board" class="btn-primary mt-4 inline-flex">📊 Back to the board</a>
	</section>
{/if}
