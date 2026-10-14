<script lang="ts">
 import {SPORTS,SPORT_ORDER,type SportKey} from '#lib/sports.ts';
 import {app} from '#lib/state.svelte.ts';
 import FixtureCard from '#lib/components/FixtureCard.svelte';
 import {fixtureOpportunity} from '#lib/engine/opportunities.js';
 let sport=$state<'all'|SportKey>('all'),mode=$state<'analysis'|'quoted'|'validated'>('analysis');
 const list=$derived(app.all.filter(p=>p.status.state==='scheduled'&&Date.parse(p.kickoffTime)>app.now&&(sport==='all'||p.sport===sport)).filter(p=>mode==='analysis'||(mode==='quoted'?p.markets.some(g=>g.selections.some(s=>s.pricing==='quoted')):!!p.bestValue)).sort((a,b)=>Number(!!b.bestValue)-Number(!!a.bestValue)||(fixtureOpportunity(b)?.modelProb??0)-(fixtureOpportunity(a)?.modelProb??0)));
</script>
<svelte:head><title>Market choices — PuntersEdge</title></svelte:head>
<header class="min-w-0"><h1 class="text-3xl font-extrabold sm:text-4xl">Market choices</h1><p class="mt-2 text-haze">Compare projections, green model leans and available bookmaker prices. A projection grade describes estimated likelihood; quoted value and validated stakes are separate.</p></header>
<div class="mt-5 flex min-w-0 flex-wrap gap-3">
 <label class="flex w-full min-w-0 flex-col gap-1 text-sm sm:w-auto">Sport<select bind:value={sport} class="max-w-full rounded-xl bg-deep p-2 ring-1 ring-line"><option value="all">All sports</option>{#each SPORT_ORDER as s}<option value={s}>{SPORTS[s].label}</option>{/each}</select></label>
 <label class="flex w-full min-w-0 flex-col gap-1 text-sm sm:w-auto">Show<select bind:value={mode} class="max-w-full rounded-xl bg-deep p-2 ring-1 ring-line"><option value="analysis">All published projections</option><option value="quoted">With observed bookmaker prices</option><option value="validated">Validated stake recommendations</option></select></label>
</div>
<p class="mt-3 text-sm text-haze">{list.length} analysed fixtures. Open markets for team totals, handicaps and supported period projections.</p>
<div class="mt-5 grid min-w-0 gap-4 md:grid-cols-2">{#each list as p(p.fixtureId)}<FixtureCard {p}/>{:else}<div class="surface p-5 text-haze">{mode==='validated'?'No validated stakes currently. Switch to published projections to compare model leans and available prices.':'No published pre-match analysis is available for this selection yet. The feed refreshes automatically within provider coverage and quota limits.'}</div>{/each}</div>
