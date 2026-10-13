<script lang="ts">
 import { auth } from '#lib/auth.svelte.ts';
 import { toast } from '#lib/toast.svelte.ts';
 import { anyApi } from 'convex/server';
 import { ShieldCheck, Activity, ChartNoAxesCombined, Users, RefreshCw, ArrowUpRight, Database, Target, CircleAlert } from 'lucide-svelte';
 import PerformanceChart from '#lib/components/admin/PerformanceChart.svelte';
 import CalibrationChart from '#lib/components/admin/CalibrationChart.svelte';
 interface Stats {half?:number;binary?:number;quotedN?:number;confidenceLow?:number|null;confidenceHigh?:number|null;marketBrier?:number|null;n:number;won:number;lost:number;push:number;strikeRate:number|null;roi:number|null;brier:number|null;modelMean:number|null;marketMean:number|null}
 interface Performance {verdict?:Stats;summary:Stats;sports:Record<string,Stats>;versions:Record<string,Stats>;grades:Record<string,Stats>;markets:Record<string,Stats>;bands:Record<string,Stats>;days:Record<string,Stats>;coverage:{fixtures:number;projected:number;unavailable:number;pending:number;modelVersion:string};recent:Record<string,unknown>[]}
 interface Usage {window:string;limit:number;cap:number;used:number;today:number;leftToday:number;remote:number|null}
 let health = $state<{locked:boolean;lastTick:number|null;lastError:string|null;usage:Record<string,Usage>|null;lastLog:string[];nextManualRefresh?:number}|null>(null);
 let overview=$state<{payments:{reference:string;provider:string;amount:number;status:string}[];subscriptions:{userId:string;expiresAt:number}[]}|null>(null);
 let performance=$state<Performance|null>(null);
 let allowed=$state(false),checked=$state(false),error=$state(''),busy=$state(false),userId=$state('');
 let tab=$state<'performance'|'operations'|'memberships'>('performance');
 let breakdown=$state<'sports'|'grades'|'markets'|'bands'|'versions'>('sports');
 let filter=$state('');
 let sportFilter=$state('');
 const rows=$derived(Object.entries(performance?.[breakdown]??{}).filter(([label])=>groupName(label).toLowerCase().includes(filter.toLowerCase())));
 const days=$derived(Object.entries(performance?.days??{}).sort(([a],[b])=>a.localeCompare(b)).slice(-30).filter(([,stats])=>stats.roi!==null).map(([label,stats])=>({label,value:stats.roi??0,n:stats.n})));
 const bands=$derived(Object.entries(performance?.bands??{}).map(([label,stats])=>({label,...stats,n:stats.binary??stats.n})));
 const quotas=$derived(Object.entries(health?.usage??{}));
 const money=(amount:number)=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:0}).format(amount);
 const percent=(value:number|null|undefined)=>value===null||value===undefined?'—':`${value.toFixed(1)}%`;
 const decimal=(value:number|null|undefined)=>value===null||value===undefined?'—':value.toFixed(3);
 const groupName=(value:string)=>{try{return decodeURIComponent(value).replaceAll('_',' ');}catch{return value.replaceAll('_',' ');}};
 const score=(value:unknown)=>value && typeof value==='object' && 'home' in value && 'away' in value ? `${String(value.home)}–${String(value.away)}` : String(value??'—');
 const date=(value:number)=>new Date(value).toLocaleString('en-NG',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Lagos'});
 $effect(()=>{
  const client=auth.client;allowed=false;checked=!client;overview=null;performance=null;health=null;
  if(!client)return;
  return client.onUpdate(anyApi.admin.status,{},result=>{allowed=result.isSuperAdmin===true;checked=true;},()=>{error='Could not verify administrator access.';checked=true;});
 });
 $effect(()=>{
  const client=auth.client;if(!allowed||!client)return;
  const subscriptions=[
   client.onUpdate(anyApi.admin.overview,{},value=>overview=value,()=>error='Membership records could not load.'),
   client.onUpdate(anyApi.workflows.health,{},value=>health=value,()=>error='Source health could not load.')
  ];return()=>subscriptions.forEach(stop=>stop());
 });
 $effect(()=>{const client=auth.client;const sport=sportFilter;performance=null;if(!allowed||!client)return;return client.onUpdate(anyApi.admin.performance,sport?{sport}:{},value=>performance=value,()=>error='Performance records could not load.');});
 async function refresh(){if(!auth.client)return;busy=true;try{await auth.client.mutation(anyApi.workflows.refreshData,{});toast.success('Refresh queued. Provider quotas remain enforced.');}catch(e){toast.error(e instanceof Error?e.message:'Refresh could not start.');}finally{busy=false;}}
 async function membership(active:boolean){if(!auth.client)return;busy=true;try{await auth.client.mutation(anyApi.admin.setMembership,{userId:userId.trim(),active});toast.success(active?'One month of access granted.':'Membership revoked.');userId='';}catch(e){toast.error(e instanceof Error?e.message:'Could not change membership.');}finally{busy=false;}}
 async function exportForecast(fixtureId: unknown) {
  if(!auth.client || typeof fixtureId !== 'string')return;
  try {
   const archived=await auth.client.query(anyApi.performance.archive,{fixtureId});
   if(!archived?.url)throw new Error('Archive is not available yet.');
   const response=await fetch(archived.url);if(!response.ok)throw new Error('Archive download failed.');
   const blob=await response.blob();
   const data=await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).blob();
   const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
   const anchor=document.createElement('a');anchor.href=url;anchor.download=`PuntersEdge-${fixtureId}.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(reason){toast.error(reason instanceof Error?reason.message:'Could not export forecast.');}
 }
 const tabs=[{id:'performance',label:'Model performance',icon:ChartNoAxesCombined},{id:'operations',label:'Data operations',icon:Activity},{id:'memberships',label:'Members & payments',icon:Users}] as const;
</script>
<svelte:head><title>Admin console · PuntersEdge</title><meta name="robots" content="noindex,nofollow" /></svelte:head>
<section class="space-y-6">
 <header class="relative overflow-hidden rounded-[var(--radius-card)] bg-deep p-5 ring-1 ring-line sm:p-7">
  <div class="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-pop/10 blur-3xl" aria-hidden="true"></div>
  <div class="relative flex flex-wrap items-start justify-between gap-4">
   <div><p class="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-model"><ShieldCheck class="h-4 w-4"/>Private administration</p><h1 class="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">The control room<span class="text-pop">.</span></h1><p class="mt-2 max-w-xl text-sm text-haze">Measured model performance, live source operations and all-access membership controls.</p></div>
   {#if allowed}<a href="/board" class="btn-ghost text-sm">Open user view <ArrowUpRight class="h-4 w-4"/></a>{/if}
  </div>
 </header>
 {#if error}<p role="alert" class="flex items-center gap-2 rounded-2xl bg-loss/10 p-4 text-sm text-loss ring-1 ring-loss/30"><CircleAlert class="h-4 w-4"/>{error}</p>{/if}
 {#if !checked}<div class="panel p-8 text-center text-haze" role="status">Verifying administrator access…</div>
 {:else if !allowed}<div class="panel p-6"><h2 class="font-display text-xl font-bold">Administrator sign-in required</h2><p class="mt-2 text-sm text-haze">Use the authorized administrator account to access this private console.</p><a href="/login?next=/admin" class="btn-primary mt-4">Sign in</a></div>
 {:else}
  <nav class="flex gap-2 overflow-x-auto rounded-2xl bg-deep p-2 ring-1 ring-line" aria-label="Admin sections">
   {#each tabs as item}<button onclick={()=>tab=item.id} aria-current={tab===item.id?'page':undefined} class="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors {tab===item.id?'bg-raised text-chalk ring-1 ring-pop/40':'text-haze hover:text-chalk'}"><item.icon class="h-4 w-4"/>{item.label}</button>{/each}
  </nav>
  {#if tab==='performance'}
   <div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="font-display text-xl font-bold">Forecast intelligence</h2><p class="mt-1 text-xs text-haze">Evaluate published forecasts against confirmed final scores.</p></div><label class="flex items-center gap-2 text-xs text-haze">Sport<select bind:value={sportFilter} class="min-h-11 rounded-xl bg-raised px-3 py-2 text-sm text-chalk ring-1 ring-line"><option value="">All sports</option><option value="football">Football</option><option value="nba">NBA</option><option value="basketball">Basketball</option><option value="hockey">Ice hockey</option><option value="baseball">Baseball</option></select></label></div>
   <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <div class="metric"><p>Settled forecasts</p><strong>{performance?.summary.n??'—'}</strong><span>{performance?`${performance.summary.won} won · ${performance.summary.lost} lost · ${performance.summary.push} push`:'Loading performance…'}</span></div>
    <div class="metric"><p>Flat-stake return</p><strong class={(performance?.summary.roi??0)>=0?'text-model':'text-loss'}>{percent(performance?.summary.roi)}</strong><span>ROI on directly quoted selections</span></div>
    <div class="metric"><p>Strike rate</p><strong>{percent(performance?.summary.strikeRate)}</strong><span>Wins / binary won-or-lost outcomes</span></div>
    <div class="metric"><p>Probability error</p><strong>{decimal(performance?.summary.brier)}</strong><span>Binary Brier score · lower is better</span></div>
   </div>
   {#if performance && performance.summary.n===0}<div class="flex items-start gap-3 rounded-2xl bg-pop/10 p-4 text-sm ring-1 ring-pop/30"><Target class="mt-0.5 h-5 w-5 shrink-0 text-pop"/><p>Awaiting live settlements. Charts and returns will populate from recorded pre-match forecasts and final results.</p></div>{/if}
   <section class="panel p-5"><div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="font-display text-xl font-bold">Model verdict scorecard</h2><p class="mt-1 text-xs text-haze">The chosen best pick per fixture, measured separately from all market forecasts.</p></div><span class="rounded-full bg-pop/15 px-3 py-1 text-xs font-semibold text-pop">{performance?.verdict?.n??'—'} settled verdicts</span></div><div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4"><div><p class="text-xs text-haze">Verdict strike rate</p><p class="mt-1 font-display text-2xl font-bold">{percent(performance?.verdict?.strikeRate)}</p></div><div><p class="text-xs text-haze">Quoted verdict ROI</p><p class="mt-1 font-display text-2xl font-bold {(performance?.verdict?.roi??0)>=0?'text-model':'text-loss'}">{percent(performance?.verdict?.roi)}</p></div><div><p class="text-xs text-haze">Model Brier</p><p class="mt-1 font-display text-2xl font-bold">{decimal(performance?.verdict?.brier)}</p></div><div><p class="text-xs text-haze">Market Brier</p><p class="mt-1 font-display text-2xl font-bold">{decimal(performance?.verdict?.marketBrier)}</p></div></div>{#if performance?.verdict?.confidenceLow!==null && performance?.verdict?.confidenceLow!==undefined}<p class="mt-3 text-xs text-haze">95% win-rate interval: {percent(performance.verdict.confidenceLow)}–{percent(performance.verdict.confidenceHigh)}. This interval describes historical outcomes, not future guarantees.</p>{/if}</section>
   <div class="grid gap-4 lg:grid-cols-2"><PerformanceChart rows={days} title="Daily return trajectory" description="Daily flat-stake ROI for settled picks. Grouped by the day the final result was received (Africa/Lagos)."/><CalibrationChart rows={bands}/></div>
   <section class="panel p-4 sm:p-5">
    <div class="flex flex-wrap items-end justify-between gap-3"><div><h2 class="font-display text-xl font-bold">Performance breakdown</h2><p class="mt-1 text-xs text-haze">All published market selections, including correlated outcomes within a fixture. ROI includes quoted prices only.</p></div><label class="text-xs text-haze">Filter groups<input class="mt-1 block w-full rounded-xl bg-ink px-3 py-2 text-sm text-chalk ring-1 ring-line" bind:value={filter} placeholder="Search name…"/></label></div>
    <div class="mt-4 flex flex-wrap gap-2" aria-label="Breakdown dimension">{#each ['sports','grades','markets','bands','versions'] as dimension}<button onclick={()=>breakdown=dimension as typeof breakdown} aria-pressed={breakdown===dimension} class="min-h-10 rounded-full px-4 text-sm capitalize {breakdown===dimension?'bg-pop text-ink':'bg-ink text-haze ring-1 ring-line'}">{dimension}</button>{/each}</div>
    <div class="mt-4 overflow-x-auto"><table><caption class="sr-only">Settled model performance by {breakdown}</caption><thead><tr><th>Group</th><th>Picks</th><th>W / L / P</th><th>Strike</th><th>ROI</th><th>Model Brier</th><th>Market Brier</th><th>Model</th><th>Market</th></tr></thead><tbody>{#each rows as [name,stats]}<tr><th class="capitalize">{groupName(name)}</th><td>{stats.n}</td><td>{stats.won} / {stats.lost} / {stats.push}</td><td>{percent(stats.strikeRate)}</td><td class={(stats.roi??0)>=0?'text-model':'text-loss'}>{percent(stats.roi)}</td><td>{decimal(stats.brier)}</td><td>{decimal(stats.marketBrier)}</td><td>{percent(stats.modelMean)}</td><td>{percent(stats.marketMean)}</td></tr>{:else}<tr><td colspan="9" class="py-8 text-center text-haze">{filter?'No matching groups.':'Awaiting settled picks.'}</td></tr>{/each}</tbody></table></div>
   </section>
   <section class="panel p-5"><div class="flex items-center gap-2"><Database class="h-4 w-4 text-pop"/><h2 class="font-semibold">Forecast coverage</h2></div><div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">{#each [['Fixtures',performance?.coverage.fixtures],['Projected',performance?.coverage.projected],['Unavailable',performance?.coverage.unavailable],['Pending picks',performance?.coverage.pending]] as [label,value]}<div><p class="text-xs text-haze">{label}</p><p class="mt-1 font-display text-2xl font-bold">{value??'—'}</p></div>{/each}</div><p class="mt-4 text-xs text-haze">Model version: {performance?.coverage.modelVersion??'Awaiting forecast metadata'}. Calibration uses binary won/lost outcomes; pushes and half outcomes are excluded. ROI uses directly quoted prices. Correlated markets are not independent observations.</p></section>
   <section class="panel p-5"><h2 class="font-display text-xl font-bold">Latest settled forecasts</h2><div class="mt-3 overflow-x-auto"><table><thead><tr><th>Match</th><th>Sport</th><th>Pick</th><th>Grade</th><th>Result</th><th>Score</th><th>Model / market</th><th>Designation</th></tr></thead><tbody>{#each performance?.recent??[] as row}<tr><td><button class="text-left font-semibold text-pop underline-offset-4 hover:underline" title="Download the full recorded inputs, markets and probabilities" onclick={()=>exportForecast(row.fixtureId)}>{String(row.match??row.matchTitle??'Recorded fixture')}</button></td><td class="capitalize">{String(row.sport??'—')}</td><td>{String(row.selection??row.market??'—')}</td><td>{String(row.grade??'—')}</td><td>{String(row.result??'—')}</td><td>{score(row.score)}</td><td>{typeof row.modelProb==='number'?percent(row.modelProb*100):'—'} / {typeof row.marketProb==='number'?percent(row.marketProb*100):'—'}</td><td><span class="rounded-full bg-raised px-2 py-1 text-xs">{row.verdict?'Model verdict':'Market forecast'}</span></td></tr>{:else}<tr><td colspan="8" class="py-8 text-center text-haze">No final verdicts recorded yet.</td></tr>{/each}</tbody></table></div></section>
  {:else if tab==='operations'}
   <section class="panel p-5"><div class="flex flex-wrap items-start justify-between gap-4"><div><h2 class="font-display text-xl font-bold">Live data pipeline</h2><p class="mt-2 text-sm text-haze">Last completed: {health?.lastTick?date(health.lastTick):'Awaiting first refresh'}.</p></div><span class="rounded-full px-3 py-1.5 text-xs font-semibold {health?.locked?'bg-pop/15 text-pop':'bg-model/15 text-model'}">{health?.locked?'Refresh running':'Pipeline idle'}</span></div>{#if health?.lastError}<p role="status" class="mt-4 rounded-xl bg-loss/10 p-3 text-sm text-loss">{health.lastError}</p>{/if}<button onclick={refresh} disabled={busy||health?.locked} class="btn-primary mt-4"><RefreshCw class="h-4 w-4"/>{busy?'Queueing…':'Refresh live data'}</button><p class="mt-2 text-xs text-haze">Manual refreshes respect daily and monthly provider budgets and the five-minute cooldown.</p></section>
   <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{#each quotas as [name,usage]}<section class="panel p-5"><div class="flex items-center justify-between gap-2"><h2 class="font-semibold">{groupName(name)}</h2><span class="text-xs text-haze">{usage.window==='day'?'Daily':'Monthly'}</span></div><div class="mt-4 flex items-end gap-2"><span class="font-display text-3xl font-bold">{usage.used}</span><span class="pb-1 text-sm text-haze">/ {usage.cap} safe budget</span></div><progress max={usage.cap||1} value={Math.min(usage.used,usage.cap)} aria-label={`${name} request budget used`} class="mt-3 h-2 w-full overflow-hidden rounded-full"></progress><div class="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p class="text-xs text-haze">Used today</p><p class="mt-1 font-semibold">{usage.today}</p></div><div><p class="text-xs text-haze">Available today</p><p class="mt-1 font-semibold">{usage.leftToday}</p></div></div><p class="mt-3 text-xs text-haze">Provider limit: {usage.limit}. {usage.remote===null?'Remote balance unavailable.':`Provider reports ${usage.remote} remaining.`}</p></section>{:else}<p class="panel p-5 text-sm text-haze">Provider budgets appear after the first ingest run.</p>{/each}</div>
   <section class="panel p-5"><h2 class="font-display text-xl font-bold">Source activity log</h2><ul class="mt-4 grid gap-2">{#each health?.lastLog??[] as entry}<li class="break-words rounded-xl bg-ink px-3 py-2 font-mono text-xs text-haze">{entry}</li>{:else}<li class="text-sm text-haze">No source activity recorded.</li>{/each}</ul></section>
  {:else}
   <div class="grid gap-4 lg:grid-cols-[1fr_1.3fr]"><section class="panel p-5"><h2 class="font-display text-xl font-bold">Membership controls</h2><p class="mt-2 text-sm text-haze">All-access membership costs {money(10000)} per calendar month. Manual changes create an audit record.</p><label class="mt-5 block text-sm font-medium">Account user ID<input bind:value={userId} placeholder="Select a member below or enter their ID" class="mt-2 block w-full rounded-xl bg-ink px-3 py-3 text-sm ring-1 ring-line"/></label><div class="mt-4 flex flex-wrap gap-2"><button disabled={busy||!userId.trim()} onclick={()=>membership(true)} class="btn-primary">Grant one month</button><button disabled={busy||!userId.trim()} onclick={()=>membership(false)} class="btn-ghost text-loss">Revoke access</button></div></section><section class="panel p-5"><h2 class="font-display text-xl font-bold">Recent memberships</h2><ul class="mt-4 grid gap-2">{#each overview?.subscriptions??[] as sub}<li><button onclick={()=>userId=sub.userId} class="flex min-h-12 w-full flex-wrap items-center justify-between gap-2 rounded-xl bg-ink p-3 text-left ring-1 ring-line hover:ring-pop"><span class="max-w-full truncate font-mono text-xs">{sub.userId}</span><span class="text-xs text-haze">Expires {date(sub.expiresAt)}</span></button></li>{:else}<li class="text-sm text-haze">No memberships recorded.</li>{/each}</ul></section></div>
   <section class="panel p-5"><h2 class="font-display text-xl font-bold">Recent payments</h2><p class="mt-1 text-xs text-haze">Server-verified checkout records across Flutterwave and Korapay.</p><div class="mt-4 overflow-x-auto"><table><thead><tr><th>Reference</th><th>Provider</th><th>Amount</th><th>Status</th></tr></thead><tbody>{#each overview?.payments??[] as payment}<tr><td class="font-mono text-xs">{payment.reference}</td><td class="capitalize">{payment.provider}</td><td>{money(payment.amount)}</td><td><span class="rounded-full bg-raised px-2 py-1 text-xs">{payment.status}</span></td></tr>{:else}<tr><td colspan="4" class="py-8 text-center text-haze">No payment records yet.</td></tr>{/each}</tbody></table></div></section>
  {/if}
 {/if}
</section>
<style>
 .panel{min-width:0}.panel,.metric{border-radius:var(--radius-card);background:var(--color-deep);box-shadow:0 0 0 1px var(--color-line)}
 .metric{padding:1.25rem}.metric p{font-size:.75rem;color:var(--color-haze);font-weight:600}.metric strong{display:block;margin-top:.5rem;font-family:var(--font-display);font-size:2rem;line-height:1.2}.metric span{display:block;margin-top:.5rem;font-size:.7rem;color:var(--color-haze)}
 table{width:100%;border-collapse:collapse;text-align:left;font-size:.8rem}th,td{padding:.85rem .7rem;white-space:nowrap;border-bottom:1px solid var(--color-line)}thead th{font-size:.7rem;color:var(--color-haze);font-weight:600}tbody th{font-weight:600}tbody tr:last-child>*{border-bottom:0}
 progress{accent-color:var(--color-model)}progress::-webkit-progress-bar{background:var(--color-raised);border-radius:999px}progress::-webkit-progress-value{background:var(--color-model);border-radius:999px}
</style>
