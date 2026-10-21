<script lang="ts">
 import {untrack} from 'svelte';
 import {auth} from '#lib/auth.svelte.ts';
 import {app} from '#lib/state.svelte.ts';
 import SelectionIdentity from '#lib/components/SelectionIdentity.svelte';
 import SportTabs from '#lib/components/SportTabs.svelte';
 import type {TennisSnapshot} from '#lib/tennis-types.ts';
 let snapshot=$state<TennisSnapshot|null>(null),loading=$state(false),error=$state(''),feedback=$state(''),etag='';
 let controller:AbortController|undefined;
 const stale=$derived(!snapshot||app.now-snapshot.at>86400000||snapshot.at>app.now);
 const upcoming=$derived((snapshot?.fixtures??[]).filter(f=>f.kickoff>app.now));
 async function load(){
  controller?.abort();const request=new AbortController();controller=request;loading=true;error='';
  try{
   const response=await fetch('/api/tennis',{headers:etag?{'If-None-Match':etag}:{},signal:request.signal});
   if(response.status===304)return;
   if(!response.ok)throw Error(response.status===403?'An active account is required.':'The tennis snapshot is unavailable. Try again later.');
   const bytes=new Uint8Array(await response.arrayBuffer());
   if(bytes.length>256*1024)throw Error('Tennis response exceeded its size limit.');
   const text=bytes[0]===0x1f&&bytes[1]===0x8b?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text():new TextDecoder().decode(bytes);
   if(text.length>1024*1024)throw Error('Tennis snapshot exceeded its size limit.');
   const parsed=JSON.parse(text) as TennisSnapshot;
   if(parsed.v!==1||parsed.bettingApproved!==false||!Array.isArray(parsed.fixtures)||parsed.fixtures.length>200||!Number.isFinite(parsed.at))throw Error('Tennis snapshot could not be verified.');
   if(request.signal.aborted)return;
   snapshot=parsed;etag=response.headers.get('ETag')??'';app.tennisFixtures=parsed.fixtures;
  }catch(e){if(!request.signal.aborted)error=e instanceof Error?e.message:'Tennis could not load.';}
  finally{if(!request.signal.aborted)loading=false;}
 }
 $effect(()=>{
  const user=auth.signedIn?auth.viewer?.id:null;
  untrack(()=>{controller?.abort();snapshot=null;etag='';app.tennisFixtures=[];if(user)void load();});
  return ()=>controller?.abort();
 });
</script>
<svelte:head><title>Tennis forecast workspace — PuntersEdge</title></svelte:head>
<SportTabs/>
<header class="mt-6 min-w-0"><p class="text-xs font-semibold uppercase tracking-widest text-book">🎾 Experimental tennis</p><h1 class="mt-2 text-3xl font-extrabold sm:text-4xl">Tennis forecast workspace</h1><p class="mt-3 max-w-3xl text-sm leading-relaxed text-haze">Compare estimated match and first-set outcomes from historical player results. These estimates are calibrated against a retrospective holdout; they have not demonstrated a profitable betting edge. No automatic stake or verified-value grade is assigned.</p></header>
<div class="surface mt-5 flex min-w-0 flex-wrap items-center justify-between gap-3 p-4"><div class="min-w-0 text-xs text-haze"><strong class="block text-sm text-chalk">Daily snapshot · no automatic polling</strong>{#if snapshot}<span>Published {new Date(snapshot.at).toLocaleString('en-NG',{timeZone:'Africa/Lagos'})} WAT · {upcoming.length} upcoming forecasts</span>{:else}<span>Only real provider events with unambiguous player history are published.</span>{/if}</div><button class="btn-ghost min-h-11" disabled={loading||!auth.signedIn} onclick={load}>{loading?'Loading…':'Refresh snapshot'}</button></div>
{#if !auth.signedIn}<div class="surface mt-4 p-5"><p>Sign in with an active account to open the private tennis forecast snapshot.</p><a class="btn-primary mt-4 inline-flex" href="/login?next=/tennis">Sign in</a></div>{/if}
{#if error}<p role="alert" class="mt-4 rounded-xl border border-loss p-4 text-sm text-loss">{error}</p>{/if}
{#if snapshot&&stale}<p class="mt-4 rounded-xl border border-book p-4 text-sm text-book">This snapshot is older than 24 hours or its time is invalid. Estimates remain visible for review; adding selections is paused until the next fresh snapshot.</p>{/if}
{#if loading&&!snapshot}<p role="status" class="surface mt-4 p-5 text-sm text-haze">Loading current tennis coverage…</p>{:else if snapshot&&!upcoming.length}<div class="surface mt-4 p-5"><h2 class="font-bold">No eligible upcoming tennis forecasts</h2><p class="mt-2 text-sm text-haze">The current provider snapshot has no future singles matches with sufficient, unambiguous historical ratings. No replacement fixtures or probabilities are invented.</p>{#each Object.entries(snapshot.withheld??{}) as [reason,count]}<p class="mt-2 text-xs text-haze">{reason}: {count}</p>{/each}</div>{/if}
<div class="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">{#each upcoming as fixture(fixture.id)}<article id={fixture.id} class="surface min-w-0 overflow-hidden p-4"><p class="break-words text-xs text-haze">{fixture.tour} · {fixture.league}</p><h2 class="fixture-name mt-2 break-words text-lg font-bold"><span class="side-home">{fixture.playerA}</span> <span class="text-haze">vs</span> <span class="side-away">{fixture.playerB}</span></h2><p class="mt-1 text-xs text-haze">{new Date(fixture.kickoff).toLocaleString('en-NG',{timeZone:'Africa/Lagos',dateStyle:'medium',timeStyle:'short'})} WAT</p>
 <details class="mt-4 rounded-xl border border-book/50"><summary class="min-h-11 cursor-pointer rounded-xl bg-book/15 px-3 py-3 text-sm font-semibold text-book">Full analysis & limitations</summary><div class="space-y-2 p-3 text-xs leading-relaxed text-haze"><p>{snapshot?.model}. {fixture.surface}.</p>{#if fixture.trainedThroughAssumed}<p>Latest fitted result availability (assumed): {new Date(fixture.trainedThroughAssumed).toLocaleDateString('en-NG')}.</p>{/if}<p>Each market is independently estimated from its own historical match or first-set labels. Opposite player probabilities sum to 100%. A high percentage does not establish value without a current executable bookmaker price.</p><p>Surface, injuries, withdrawals and event-format effects are not verified. Historical result availability uses a seven-day assumption. Confirm event and bookmaker retirement rules yourself. Automatic tennis settlement is unavailable; saved selections remain pending until supported results are integrated.</p></div></details>
 {#each fixture.markets as market(market.key)}<details class="mt-3 min-w-0 rounded-xl border border-line"><summary class="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold">{market.title} <span class="text-xs font-normal text-haze">· model % high to low</span></summary><div class="grid min-w-0 gap-2 px-2 pb-2">{#each [...market.options].sort((a,b)=>b.modelProb-a.modelProb) as option(option.side)}{@const id=`${fixture.id}:${market.key}:${option.side}`}<div class="option-card grid min-w-0 grid-cols-[minmax(0,1fr)_62px_44px] items-center gap-2 p-3"><div class="min-w-0"><strong class="block break-words text-sm"><SelectionIdentity selection={{selection:option.selection}} home={fixture.playerA} away={fixture.playerB} neutral/></strong><span class="mt-1 block text-[11px] text-haze">Experimental · Unpriced</span></div><span class="text-right text-lg font-bold text-model">{(option.modelProb*100).toFixed(1)}%<small class="block text-[10px] font-normal text-haze">Model</small></span><button class="grid min-h-11 min-w-11 place-items-center rounded-lg border border-model/50 bg-model/15 text-2xl font-bold text-model disabled:opacity-40" disabled={stale&&!app.inSlip(id)} aria-label={`${app.inSlip(id)?'Remove':'Add'} ${option.selection} ${market.title} ${app.inSlip(id)?'from':'to'} betslip`} aria-pressed={app.inSlip(id)} onclick={()=>{app.toggleTennis(fixture,market,option);feedback=app.inSlip(id)?`${option.selection} added to betslip.`:`${option.selection} removed from betslip.`;}}>{app.inSlip(id)?'✓':'+'}</button></div>{/each}</div></details>{/each}
 </article>{/each}</div>
<details class="surface mt-6 min-w-0 p-4"><summary class="min-h-11 cursor-pointer text-sm font-bold">Model evaluation and source attribution</summary><p class="mt-3 text-xs leading-relaxed text-haze">2021–2023 initial history; frozen 2024 calibration; 2025 onward sequential evaluation. These figures measure a historical test, not your chance of a winning ticket. The results export lacks verified historical publication times.</p><div class="mt-3 grid gap-2 sm:grid-cols-2">{#each snapshot?.evaluation?.segments??[] as segment}<div class="min-w-0 rounded-xl bg-ink p-3 text-xs"><strong>{segment.tour} · {segment.market.replaceAll('_',' ')}</strong><p class="mt-2">Test matches: {segment.raw.n.toLocaleString()} · Calibration: {segment.calibrationRows.toLocaleString()}</p><p class="mt-1">Calibrated Brier: {segment.calibrated?.brier.toFixed(4)??'Unavailable'} · Winner accuracy: {segment.calibrated?((segment.calibrated.accuracy*100).toFixed(1)+'%'):'Unavailable'}</p></div>{/each}</div><p class="mt-4 text-xs text-haze">Historical source: <a class="underline" href="https://www.valuebetennis.com/donnees.htm" target="_blank" rel="noreferrer">Valuebetennis</a>, <a class="underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Names are normalized and global player ratings fitted by PuntersEdge. Fixtures: The Odds API. No source endorsement is implied.</p></details>
<p role="status" aria-live="polite" class="sr-only">{feedback}</p>

<p class="mt-6 text-xs text-haze">Historical results: <a class="underline" href="https://www.valuebetennis.com/donnees.htm" target="_blank" rel="noopener noreferrer">Valuebetennis, Résultats et cotes de tennis depuis 2021</a>, CC BY 4.0. PuntersEdge transforms these results into independent ratings and calibration estimates.</p>
