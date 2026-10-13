<script lang="ts">
 import {app} from '#lib/state.svelte.ts';
 import {feed} from '#lib/feed.svelte.ts';
 import {SPORTS,SPORT_ORDER} from '#lib/sports.ts';
 import {machineCandidates,buildMachineTicket} from '#lib/bet-machine.js';
 import {odds,pct} from '#lib/format.ts';
 import Accordion from '#lib/components/Accordion.svelte';
 import DataBadge from '#lib/components/DataBadge.svelte';
 let sports=$state<string[]>([...SPORT_ORDER]),markets=$state<string[]>([]),direction=$state('all'),window=$state('12');
 let minOdds=$state(1.15),maxOdds=$state(4),minTotal=$state(2),maxTotal=$state(25),minProbability=$state(55),positiveValue=$state(false);
 let dateFrom=$state(''),dateTo=$state('');
 let shortlisted=$state<ReturnType<typeof machineCandidates>>([]),shortlistLimit=$state(30);
 let ticket=$state<ReturnType<typeof buildMachineTicket>>(null),error=$state(''),generatedAt=$state(0);
 const marketOptions=$derived([...new Map(app.all.flatMap(p=>p.markets.map(g=>[g.key,g.title] as const))).entries()]);
 const publishedIds=$derived(new Set((feed.data?.projections??[]).filter(p=>p.state==='scheduled').map(p=>p.fixtureId)));
 function timeRange() {
  const now=Date.now(),lagosDay=new Date(now+3600000).toISOString().slice(0,10);
  if(window==='today'||window==='tomorrow'){const start=Date.parse(`${lagosDay}T00:00:00+01:00`)+(window==='tomorrow'?86400000:0);return {from:Math.max(now,start),to:start+86400000-1};}
  if(window==='custom')return {from:Date.parse(`${dateFrom}:00+01:00`),to:Date.parse(`${dateTo}:00+01:00`)};
  return {from:now,to:now+Number(window)*3600000};
 }
 $effect(()=>{sports;markets;direction;window;minOdds;maxOdds;minTotal;maxTotal;minProbability;positiveValue;dateFrom;dateTo;ticket=null;shortlisted=[];error='';});
 $effect(()=>{if(!feed.data)ticket=null;});
 const candidateCount=$derived(app.all.filter(p=>publishedIds.has(p.fixtureId)&&p.status.state==='scheduled').length);
 function generate(){error='';ticket=null;try{const range=timeRange();if(![minOdds,maxOdds,minTotal,maxTotal,minProbability].every(Number.isFinite)||!Number.isFinite(range.from)||!Number.isFinite(range.to)||range.to<range.from||minOdds<1.01||maxOdds<minOdds||minProbability<1||minProbability>99)throw new Error('Check your date, odds and probability ranges.');const candidates=machineCandidates(app.all,{...range,publishedIds,sports,markets,direction,minOdds,maxOdds,minProbability:minProbability/100,positiveValue,sportStats:feed.data?.record.summary.sports},Date.now());shortlisted=candidates;shortlistLimit=30;ticket=buildMachineTicket(candidates,{minTotal,maxTotal});generatedAt=Date.now();if(!ticket)error=`No ticket meets these filters. Broaden the time, markets or odds range; no missing prices or selections will be invented.`;}catch(e){error=(e as Error).message;}}
 function preview(){if(!ticket)return;const valid=ticket.picks.every(p=>{const current=app.byId(p.fixtureId);return current?.status.state==='scheduled'&&Date.parse(current.kickoffTime)>Date.now()&&current.markets.some(g=>g.selections.some(s=>s.id===p.id&&s.pricing==='quoted'&&Math.abs(s.bestOdds-p.bestOdds)<.001));});if(!valid){error='A fixture started or its quote changed. Generate a fresh ticket before previewing.';return;}app.clearSlip();for(const pick of ticket.picks)app.toggle(pick as any);app.slipOpen=true;}
</script>
<svelte:head><title>Advanced bet machine — PuntersEdge</title><meta name="robots" content="noindex" /></svelte:head>
<header><p class="text-sm font-semibold uppercase tracking-widest text-model">Build with the model</p><div class="mt-2 flex flex-wrap items-center gap-3"><h1 class="text-4xl font-bold">Advanced bet machine</h1><DataBadge /></div><p class="mt-3 max-w-3xl text-haze">Generate a ticket from published pre-match forecasts and actual quoted markets. The probability optimizer compares eligible combinations; it uses the quantitative engines rather than asking an LLM to invent picks.</p></header>
<div class="mt-6 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
<section class="surface p-5"><h2 class="text-xl font-bold">Your ticket rules</h2><p class="mt-1 text-sm text-haze">{candidateCount} published upcoming fixtures available.</p>
<Accordion title="Sports & market choices" open>
 <fieldset><legend class="text-sm font-semibold">Sports</legend><div class="mt-2 flex flex-wrap gap-3">{#each SPORT_ORDER as s}<label class="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" value={s} bind:group={sports} />{SPORTS[s].label}</label>{/each}</div></fieldset>
 <fieldset class="mt-4"><legend class="text-sm font-semibold">Market types · none selected means all</legend><div class="mt-2 grid gap-2 sm:grid-cols-2">{#each marketOptions as [key,title]}<label class="flex items-center gap-2 text-sm"><input type="checkbox" value={key} bind:group={markets} />{title}</label>{/each}</div></fieldset>
 <label class="mt-4 block text-sm">Selection direction<select class="mt-1 w-full rounded-xl bg-ink p-3 ring-1 ring-line" bind:value={direction}><option value="all">Any direction</option><option value="home">Home-favoured fixtures</option><option value="away">Away-favoured fixtures</option><option value="over">Over markets</option><option value="under">Under markets</option><option value="draw">Draw</option></select></label>
</Accordion>
<Accordion title="Time & odds range" open>
 <label class="block text-sm">Kickoff window<select class="mt-1 w-full rounded-xl bg-ink p-3 ring-1 ring-line" bind:value={window}>{#each [1,3,6,12,24,48] as h}<option value={String(h)}>Next {h} hours</option>{/each}<option value="today">Today · Lagos</option><option value="tomorrow">Tomorrow · Lagos</option><option value="custom">Custom date and time · WAT</option></select></label>
 {#if window==='custom'}<div class="mt-3 grid gap-3 sm:grid-cols-2"><label class="text-sm">From<input type="datetime-local" class="mt-1 w-full min-w-0 rounded-xl bg-ink p-3 ring-1 ring-line" bind:value={dateFrom} /></label><label class="text-sm">To<input type="datetime-local" class="mt-1 w-full min-w-0 rounded-xl bg-ink p-3 ring-1 ring-line" bind:value={dateTo} /></label></div>{/if}
 <div class="mt-4 grid grid-cols-2 gap-3">{#each [['Minimum pick odds','minOdds'],['Maximum pick odds','maxOdds'],['Minimum ticket odds','minTotal'],['Maximum ticket odds','maxTotal']] as [label,key]}<label class="text-sm">{label}<input type="number" min="1.01" step="0.05" class="mt-1 w-full rounded-xl bg-ink p-3 ring-1 ring-line" value={key==='minOdds'?minOdds:key==='maxOdds'?maxOdds:key==='minTotal'?minTotal:maxTotal} oninput={e=>{const n=Number(e.currentTarget.value);if(key==='minOdds')minOdds=n;else if(key==='maxOdds')maxOdds=n;else if(key==='minTotal')minTotal=n;else maxTotal=n;}} /></label>{/each}</div>
</Accordion>
<label class="mt-4 block text-sm">Minimum model %<input type="number" min="1" max="99" bind:value={minProbability} class="mt-1 w-full rounded-xl bg-ink p-3 ring-1 ring-line" /></label><p class="mt-2 text-xs text-haze">Ticket size is automatic. The optimizer chooses up to 30 different fixtures to meet your combined odds range while prioritizing the estimated all-win probability.</p>
<p class="mt-4 text-xs text-haze">Probability-first mode can include prices with negative expected value. Enable the value filter to exclude those prices.</p>
<label class="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={positiveValue} />Only positive expected-value prices</label>
<button class="btn-primary mt-5 w-full" onclick={generate}>Generate accumulator</button>{#if error}<p role="alert" class="mt-3 text-sm text-loss">{error}</p>{/if}
</section>
<section class="surface self-start p-5"><h2 class="text-xl font-bold">Ticket preview</h2>{#if ticket}<p class="mt-1 text-sm text-haze">{ticket.picks.length} fixtures selected automatically · odds within {minTotal}–{maxTotal}</p>{/if}{#if ticket}<div class="mt-4 grid grid-cols-2 gap-3"><div class="rounded-xl bg-ink p-4"><p class="text-xs text-haze">Combined odds</p><p class="text-3xl font-bold text-book">{odds(ticket.combinedOdds)}</p></div><div class="rounded-xl bg-ink p-4"><p class="text-xs text-haze">Estimated all-win chance</p><p class="text-3xl font-bold text-model">{pct(ticket.combinedProbability,1)}</p></div></div><ol class="mt-4 divide-y divide-line">{#each ticket.picks as pick,i}<li class="py-4"><p class="text-xs text-haze">{i+1}. {pick.matchTitle}</p><p class="mt-1 font-semibold">{pick.selection} <span class="text-book">@ {odds(pick.bestOdds)}</span></p><p class="mt-1 text-sm text-haze">Model {pct(pick.modelProb,1)} · Value grade {pick.grade} · {pick.bookmaker}</p><Accordion title="Selection evidence & alternatives">
 <p class="text-sm text-haze">Basis: {pick.evidence.basis}. {pick.evidence.verdict?'Matches the model’s final verdict.':'Selected through the probability and odds constraints.'}</p>
 <dl class="mt-3 grid grid-cols-2 gap-2 text-xs"><dt>Model / market</dt><dd>{pct(pick.modelProb,1)} / {pick.evidence.marketProbability===null?'Unavailable':pct(pick.evidence.marketProbability,1)}</dd><dt>Break-even probability</dt><dd>{pct(pick.evidence.breakEvenProbability,1)}</dd><dt>Expected value</dt><dd>{pick.edgePercent.toFixed(1)}%</dd><dt>Quote observed</dt><dd>{pick.evidence.observedAt?new Date(pick.evidence.observedAt).toLocaleString('en-NG',{timeZone:'Africa/Lagos'}):'Timestamp unavailable; confirm the offer'}</dd></dl>
 <p class="mt-3 text-xs text-haze">{pick.evidence.settledSportPicks} retained sport verdicts settled{pick.evidence.sportWinRate===null?'':` · ${(pick.evidence.sportWinRate*100).toFixed(1)}% won (excluding returned stakes)`}. This cohort is not this selection’s measured accuracy.</p>
 <ul class="mt-3 space-y-2 text-xs">{#each pick.evidence.alternatives as other}<li>{other.selection} · model {pct(other.modelProb,1)} · odds {odds(other.odds)}</li>{/each}</ul>
 </Accordion>
 <p class="mt-1 text-xs text-haze">{new Date(pick.kickoffTime).toLocaleString('en-NG',{timeZone:'Africa/Lagos',dateStyle:'medium',timeStyle:'short'})} WAT</p></li>{/each}</ol><button class="btn-primary mt-4 w-full" onclick={preview}>Replace working slip & preview actions</button><p class="mt-3 text-xs text-haze">Generated {new Date(generatedAt).toLocaleTimeString('en-NG',{timeZone:'Africa/Lagos'})} WAT. Searches up to 200 eligible selections with a bounded beam search; global optimality is not guaranteed.</p>{:else}<p class="mt-5 text-haze">Choose your rules and generate a ticket. Each fixture contributes at most one selection.</p>{/if}<p class="mt-5 rounded-xl bg-ink p-4 text-xs leading-relaxed text-haze">Model estimates are not proven strike rates. Combined probability assumes independent matches; cross-match correlations can reduce accuracy. Higher win probability does not necessarily mean a profitable price. PuntersEdge does not place wagers.</p></section>
</div>

<Accordion title="All eligible fixtures & market options" count={shortlisted.length}>
 <p class="text-sm text-haze">Every option below passes your sport, time, market, model percentage and individual odds filters. The final ticket chooses a compatible subset within your combined odds range.</p>
 <div class="mt-4 grid gap-3 md:grid-cols-2">{#each shortlisted.slice(0,shortlistLimit) as pick}<div class="rounded-xl bg-ink p-4"><p class="text-sm font-semibold">{pick.matchTitle}</p><p class="mt-1 text-sm">{pick.selection} · {odds(pick.bestOdds)}</p><p class="mt-1 text-xs text-haze">Model {pct(pick.modelProb,1)} · {pick.bookmaker} · value {pick.grade}</p></div>{/each}</div>
 {#if shortlisted.length>shortlistLimit}<button class="btn-secondary mt-4" onclick={()=>shortlistLimit+=30}>Show more eligible options</button>{:else if !shortlisted.length}<p class="mt-3 text-sm text-haze">Generate a shortlist with your filters to see eligible options.</p>{/if}
</Accordion>
