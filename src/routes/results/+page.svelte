<script lang="ts">
	import { app } from '#lib/state.svelte.ts';
	import { feed } from '#lib/feed.svelte.ts';
	import { SPORTS, SPORT_ORDER } from '#lib/sports.ts';
	import { sportEmoji, odds, signed, kickoff, gradeTone } from '#lib/format.ts';
	import GameRow from '#lib/components/GameRow.svelte';
	import DataBadge from '#lib/components/DataBadge.svelte';

 import Accordion from '#lib/components/Accordion.svelte';
 import { matchesFixture } from '#lib/fixture-filters.js';
 let search = $state(''), sport = $state('all'), competition = $state('all'), status = $state('all');
 let from = $state(''), to = $state(''), coverage = $state('all'), sort = $state('latest');
 let visible = $state(40);
 const record = $derived(feed.data?.record);
 const all = $derived(record?.summary.all);
 const projections = $derived(feed.data?.projections ?? []);
 const projectedIds = $derived(new Set(projections.map((p) => p.fixtureId)));
 const competitions = $derived([...new Set(app.games.filter((g) => sport === 'all' || g.sport === sport).map((g) => g.league))].sort());
 const filters = $derived({search, sport, competition, status, from, to, coverage, projectedIds});
 const invalidDates = $derived(!!from && !!to && from > to);
 const filtered = $derived(invalidDates ? [] : app.games.filter((g) => matchesFixture(g, filters)));
 const ordered = $derived([...filtered].sort((a,b) => sort === 'competition' ? a.league.localeCompare(b.league) || a.kickoff.localeCompare(b.kickoff) : sort === 'earliest' ? a.kickoff.localeCompare(b.kickoff) : b.kickoff.localeCompare(a.kickoff)));
 const finished = $derived(ordered.filter((g) => g.status.state === 'finished'));
 const live = $derived(ordered.filter((g) => g.status.state === 'live'));
 const upcoming = $derived(ordered.filter((g) => g.status.state === 'scheduled'));
 const filteredProjections = $derived(invalidDates ? [] : projections.filter((p) => matchesFixture({...p, priced: app.games.find((g) => g.id === p.fixtureId)?.priced}, filters)));
 const pendingProjections = $derived(filteredProjections.filter((p) => p.state !== 'finished'));
 const viewableFinished = $derived(filteredProjections.filter((p) => p.state === 'finished'));
 $effect(() => {search; sport; competition; status; from; to; coverage; sort; visible = 40;});
 function reset() {search = ''; sport = 'all'; competition = 'all'; status = 'all'; from = ''; to = ''; coverage = 'all'; sort = 'latest';}
	const resultTone: Record<string, string> = { won: 'text-model', 'half-won': 'text-model', lost: 'text-loss', 'half-lost': 'text-loss', push: 'text-haze' };
</script>

<svelte:head><title>Results — PuntersEdge</title></svelte:head>

<header class="max-w-2xl">
	<div class="flex flex-wrap items-center gap-3">
		<h1 class="text-4xl font-extrabold text-chalk">Results &amp; record</h1>
		<DataBadge />
	</div>
	<p class="mt-2 text-haze">Review predictions published before kickoff, their settled outcomes and recent scores. The record reflects retained published predictions; it is not a promise of future returns.</p>
</header>

<section class="surface mt-6 p-4 sm:p-5" aria-label="Search and filter fixtures">
 <div class="flex flex-wrap items-center justify-between gap-3"><h2 class="font-bold text-chalk">Find fixtures &amp; scores</h2><button onclick={reset} class="rounded-lg px-3 py-2 text-sm font-semibold text-pop ring-1 ring-line">Reset filters</button></div>
 <label class="mt-4 block text-sm font-medium text-haze">Search teams, leagues or tournaments<input type="search" bind:value={search} placeholder="Team or competition name…" class="mt-2 w-full rounded-xl border border-line bg-deep p-3 text-chalk" /></label>
 <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
  <label class="text-sm text-haze">Sport<select bind:value={sport} onchange={() => competition = 'all'} class="mt-1 w-full rounded-xl border border-line bg-deep p-3 text-chalk"><option value="all">All sports</option>{#each SPORT_ORDER as key}<option value={key}>{SPORTS[key].label}</option>{/each}</select></label>
  <label class="text-sm text-haze">Competition<select bind:value={competition} class="mt-1 w-full rounded-xl border border-line bg-deep p-3 text-chalk"><option value="all">All competitions</option>{#each competitions as league}<option value={league}>{league}</option>{/each}</select></label>
  <label class="text-sm text-haze">Fixture status<select bind:value={status} class="mt-1 w-full rounded-xl border border-line bg-deep p-3 text-chalk"><option value="all">All statuses</option><option value="live">Live now</option><option value="scheduled">Upcoming</option><option value="finished">Finished</option></select></label>
  <label class="text-sm text-haze">Coverage<select bind:value={coverage} class="mt-1 w-full rounded-xl border border-line bg-deep p-3 text-chalk"><option value="all">All provider fixtures</option><option value="projected">Published projections</option><option value="priced">With bookmaker prices</option></select></label>
  <label class="text-sm text-haze">From date · WAT<input type="date" bind:value={from} class="mt-1 w-full min-w-0 rounded-xl border border-line bg-deep p-3 text-chalk" /></label>
  <label class="text-sm text-haze">To date · WAT<input type="date" bind:value={to} min={from || undefined} class="mt-1 w-full min-w-0 rounded-xl border border-line bg-deep p-3 text-chalk" /></label>
  <label class="text-sm text-haze">Sort<select bind:value={sort} class="mt-1 w-full rounded-xl border border-line bg-deep p-3 text-chalk"><option value="latest">Latest first</option><option value="earliest">Earliest first</option><option value="competition">Competition</option></select></label>
 </div>
 <p class="mt-4 text-sm text-haze" aria-live="polite">{filtered.length} matching fixtures · {live.length} live · {upcoming.length} upcoming · {finished.length} finished</p>
 {#if invalidDates}<p role="alert" class="mt-2 text-sm text-loss">The end date must be on or after the start date.</p>{/if}
 <p class="mt-2 text-xs text-haze">Filters apply to fixtures and published projections. Scheduled and live fixtures are not counted as settled outcomes.</p>
</section>

<Accordion title="Published pre-match predictions" count={filteredProjections.length}>
 <div class="flex flex-wrap items-baseline justify-between gap-2"><h2 id="published-title" class="text-2xl font-bold text-chalk">Which predictions were published before kickoff?</h2><span class="text-sm text-haze">{pendingProjections.length} awaiting results</span></div>
 <p class="mt-2 max-w-3xl text-sm text-haze">Open a published match to review its recorded projection. Finished-match projections remain available for 12 hours after completion; the settled track record keeps the outcome after that viewing window closes.</p>
 {#if filteredProjections.length}
  <ul class="mt-4 grid gap-3 md:grid-cols-2">
   {#each [...pendingProjections, ...viewableFinished].slice(0, visible) as projection (projection.fixtureId)}
    <li><a href={`/match?id=${encodeURIComponent(projection.fixtureId)}&review=1`} class="surface block p-4 transition hover:ring-1 hover:ring-pop focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pop">
     <div class="flex items-center justify-between gap-3 text-xs text-haze"><span>{sportEmoji[projection.sport]} {SPORTS[projection.sport].label}</span><span class={projection.state === 'live' ? 'text-loss' : 'text-model'}>{projection.state === 'finished' ? 'Finished' : projection.state === 'live' ? 'Live' : 'Published'}</span></div>
     <h3 class="fixture-name mt-2 font-semibold">{projection.match}</h3>
     <p class="mt-1 text-sm text-haze">{projection.league} · {kickoff(projection.kickoff, app.now)}</p>
     <div class="mt-3 flex flex-wrap justify-between gap-2 text-xs"><span class="text-haze">Published <time datetime={new Date(projection.publishedAt).toISOString()}>{new Date(projection.publishedAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short' })} WAT</time></span><span class="font-semibold text-model">View recorded projection →</span></div>
     {#if projection.score}<p class="mt-2 text-sm text-chalk">Final score: {projection.score}</p>{/if}
    </a></li>
   {/each}
  </ul>
 {:else}
  <p class="surface mt-4 p-5 text-haze">{feed.mode === 'live' ? 'No published predictions are currently available to view. Predictions appear here when the backend records them before kickoff.' : 'Published predictions appear here once the live feed is available. '}</p>
 {/if}
</Accordion>

<Accordion title="Live fixtures" count={live.length}>
 {#if live.length}<div class="grid gap-2 md:grid-cols-2">{#each live.slice(0, visible) as g (g.id)}<GameRow {g} showSport />{/each}</div>{:else}<p class="text-sm text-haze">No live fixtures match your filters.</p>{/if}
</Accordion>
<Accordion title="Upcoming fixtures" count={upcoming.length}>
 {#if upcoming.length}<div class="grid gap-2 md:grid-cols-2">{#each upcoming.slice(0, visible) as g (g.id)}<GameRow {g} showSport />{/each}</div>{:else}<p class="text-sm text-haze">No upcoming fixtures match your filters.</p>{/if}
</Accordion>
<Accordion title="Finished fixtures & latest scores" count={finished.length}>
 {#if finished.length}<div class="grid gap-2 md:grid-cols-2">{#each finished.slice(0, visible) as g (g.id)}<GameRow {g} showSport />{/each}</div>{:else}<p class="text-sm text-haze">No finished fixtures match your filters.</p>{/if}
</Accordion>
{#if Math.max(live.length, upcoming.length, finished.length, filteredProjections.length) > visible}
 <button onclick={() => visible += 40} class="mt-5 min-h-11 rounded-xl bg-pop px-5 py-3 font-semibold text-deep">Show 40 more per section</button>
{/if}
