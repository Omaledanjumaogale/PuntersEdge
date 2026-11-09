<script lang="ts">
 import {onMount,onDestroy,untrack} from 'svelte';
 import {anyApi} from 'convex/server';
 import {auth} from '#lib/auth.svelte.ts';
 import {feed} from '#lib/feed.svelte.ts';
 import {startEvidenceRefresh} from '#lib/evidence-refresh.js';
 import {evidenceBoard} from '#lib/evidence-board.js';
 import {SPORTS,SPORT_ORDER,type SportKey} from '#lib/sports.ts';
 let allowed=$state(false),checked=$state(false),loading=$state(false),error=$state(''),report=$state<any>(null),checkedAt=$state(0),now=$state(Date.now());
 let etag='',controller:AbortController|undefined,disposed=false,reloadQueued=false;
 let sort=$state('model'),sport=$state('all'),search=$state(''),limit=$state(40);
 const games=$derived(new Map((feed.data?.games??[]).map(g=>[g.id,g])));
 const rows=$derived(evidenceBoard(report,games,now,sort).filter(f=>(sport==='all'||f.sport===sport)&&[f.matchTitle,f.league,f.country,f.tournament].join(' ').toLowerCase().includes(search.trim().toLowerCase())));
 $effect(()=>{sort;sport;search;limit=40;});
 const percent=(n:number)=>Number.isFinite(n)?(n*100).toFixed(1)+'%':'—';
 const time=(n:number)=>new Date(n).toLocaleTimeString('en-NG',{timeZone:'Africa/Lagos',hour:'2-digit',minute:'2-digit',hour12:false});
 const day=(n:number)=>new Date(n).toLocaleDateString('en-NG',{timeZone:'Africa/Lagos',weekday:'short',day:'numeric',month:'short'});
 const date=(v:number)=>new Date(v).toLocaleString('en-NG',{timeZone:'Africa/Lagos',dateStyle:'medium',timeStyle:'short'});
 $effect(()=>{const client=auth.client;allowed=false;checked=!client;if(!client)return;return client.onUpdate(anyApi.admin.status,{},r=>{allowed=r?.isSuperAdmin===true;checked=true;},()=>{error='Administrator access could not be verified.';checked=true;allowed=false;});});
 $effect(()=>{const client=auth.client;if(!allowed||!client){controller?.abort();report=null;etag='';return;}return client.onUpdate(anyApi.evidence.meta,{},meta=>untrack(()=>{if(!meta){void load();return;}if(report&&etag===`"${meta.version}"`){checkedAt=meta.updatedAt;now=Date.now();}else void load();}),()=>{error='Evidence updates disconnected. Automatic retry remains active.';});});
 onMount(()=>startEvidenceRefresh({refresh:load,canRefresh:()=>allowed&&!loading,onTick:()=>now=Date.now()}));onDestroy(()=>{disposed=true;controller?.abort();});
 async function load(){if(!allowed||disposed)return;if(loading){reloadQueued=true;return;}loading=true;error='';const request=controller=new AbortController(),timeout=setTimeout(()=>request.abort(),20000);try{
  const response=await fetch('/api/admin/evidence',{headers:etag?{'If-None-Match':etag}:{},cache:'no-store',signal:controller.signal});
  if(disposed||!allowed||request.signal.aborted)return;now=Date.now();
  if(response.status===304&&report){checkedAt=Number(response.headers.get('X-Evidence-Checked-At'))||checkedAt;return;}
  if(!response.ok)throw Error(`Evidence catalog could not load (HTTP ${response.status}). Retained results are not replaced with estimates.`);
  let bytes=new Uint8Array(await response.arrayBuffer());if(bytes[0]===31&&bytes[1]===139)bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  if(bytes.length>64*1024*1024)throw Error('Evidence catalog exceeds the display budget.');const data=JSON.parse(new TextDecoder().decode(bytes));if(data.schema!==1||!Array.isArray(data.upcoming)||!data.groups)throw Error('Evidence catalog format is not supported.');
  if(disposed||!allowed||request.signal.aborted)return;report=data;etag=response.headers.get('ETag')??'';checkedAt=Number(response.headers.get('X-Evidence-Checked-At'))||data.generatedAt;now=Date.now();
 }catch(reason){if(!disposed&&allowed)error=request.signal.aborted?'Evidence request timed out. Automatic retry is active.':(reason as Error).message;}finally{clearTimeout(timeout);loading=false;if(reloadQueued&&!disposed&&allowed){reloadQueued=false;void load();}}}
</script>
<svelte:head><title>Evidence Board · PuntersEdge admin</title><meta name="robots" content="noindex,nofollow"/></svelte:head>
<header class="surface board-hero p-5 sm:p-7"><p class="text-xs font-bold uppercase tracking-widest text-model">📊 Private research workspace</p><h1 class="mt-2 text-3xl font-bold">Evidence Board</h1><p class="mt-2 text-sm text-haze">Published fixtures at a glance. One leading selection per market and period, ranked by Model %.</p><div class="mt-4 flex flex-wrap gap-2"><button class="btn-primary" disabled={!allowed||loading} onclick={load}>{loading?'Checking…':'↻ Refresh evidence'}</button><a class="btn-secondary" href="/admin/evidence">🌡️ Shortlist</a><a class="btn-secondary" href="/admin/evidence/history">📜 History</a></div></header>
{#if !checked}<p class="workspace-state mt-4">Checking administrator access…</p>{:else if !allowed}<p class="workspace-state mt-4">Administrator access required.</p>{:else}
 <div class="filters surface mt-4 p-4">
 <label>Sort fixtures<select bind:value={sort}><option value="model">Highest Model % first</option><option value="kickoff">Kickoff time first</option></select></label>
 <label>Sport<select bind:value={sport}><option value="all">All published sports</option>{#each SPORT_ORDER as s}<option value={s}>{SPORTS[s].label}</option>{/each}</select></label>
 <label>Find a fixture<input bind:value={search} placeholder="Team, league or country"/></label>
 </div>
 <p class="mt-4 text-xs text-haze" role="status">Showing {Math.min(limit,rows.length)} of {rows.length} fixtures{checkedAt?' · Checked '+date(checkedAt)+' WAT':''}. Confidence is the 95% Wilson lower bound of historical recurrence, not the chance of winning this fixture.</p>
 {#if error}<p class="mt-3 text-sm text-loss" role="alert">{error}</p>{/if}
 <div class="mt-3 grid min-w-0 gap-2">{#each rows.slice(0,limit) as f,i(f.fixtureId)}
 {@const info=SPORTS[f.sport as SportKey]}{@const href='/match?id='+encodeURIComponent(f.fixtureId)}
 <article class="surface board-row">
  <div class="schedule"><span class="rank">#{i+1}</span><time datetime={new Date(f.kickoff).toISOString()}><strong>{time(f.kickoff)} WAT</strong><small>{day(f.kickoff)}{f.state==='live'?' · Live':''}</small></time></div>
  <div class="identity"><p>{info?.emoji??'📊'} {f.country?f.country+' · ':''}{f.league}</p><a href={href}>{f.matchTitle}</a><small>Top Model {percent(f.best)} · {f.options.length} markets</small></div>
  <div class="market-strip" role="group" aria-label={'Market predictions for '+f.matchTitle}>{#each f.options as m,j(m.key)}
   <a class="market-mini" class:market-leader={j===0} href={href} aria-label={m.title+' · '+m.selection+' · Model '+percent(m.modelProb)}>
    <span class="mini-title">{#if j===0}<span aria-hidden="true">★ </span>{/if}{m.scope==='full'?'':m.scope.replaceAll('_',' ')+' · '}{m.title}</span>
    <strong class="mini-pick">{m.selection}</strong>
    <span class="model"><b>{percent(m.modelProb)}</b> Model</span>
    {#if m.cohort}<span class="proof">Confidence <b>{percent(m.cohort.interval?.low)}</b><br/>Recurrence <b>{percent(m.cohort.strikeRate)}</b> · n={m.cohort.binaryN}</span>{:else}<span class="proof">No comparable history</span>{/if}
   </a>
  {/each}</div>
 </article>
 {:else}<p class="workspace-state">{loading?'Loading published evidence…':'No published fixtures match these filters.'}</p>{/each}</div>
 {#if limit<rows.length}<button class="btn-secondary mt-4" onclick={()=>limit+=40}>Show 40 more fixtures</button>{/if}
{/if}
<style>
 .filters{display:flex;flex-wrap:wrap;gap:12px}.filters label{display:grid;gap:4px;flex:1 1 155px;min-width:0;font-size:.75rem;font-weight:700}.filters :is(input,select){min-width:0;max-width:100%;min-height:44px;padding:8px 10px;border:1px solid var(--color-line);border-radius:10px;background:var(--color-ink)}
 .board-row{display:grid;grid-template-columns:92px minmax(150px,1fr) minmax(0,2.7fr);align-items:center;gap:12px;padding:10px;min-width:0}.schedule,.identity{min-width:0;overflow-wrap:anywhere}.schedule strong,.schedule small,.identity small{display:block}.schedule strong{font-size:.78rem}.rank,.schedule small,.identity p,.identity small{font-size:.68rem;color:var(--color-haze)}.identity a{display:block;font-weight:750;font-size:.88rem;line-height:1.35}.identity a:hover{text-decoration:underline}
 .market-strip{display:flex;gap:6px;min-width:0;overflow-x:auto;padding:4px 4px 8px;scrollbar-width:thin}.market-mini{display:grid;gap:3px;align-content:start;flex:0 0 126px;min-width:0;border:1px solid #c7d2cb;border-radius:10px;padding:7px;background:#f6faf7;color:#182c26;overflow-wrap:anywhere}.mini-title{font-size:.63rem;color:#40564e;line-height:1.25}.mini-pick{font-size:.7rem;line-height:1.25}.model{background:#fff099;color:#2e2500;border-radius:5px;padding:2px 4px;font-size:.63rem}.model b{font-size:.85rem}.proof{font-size:.61rem;line-height:1.35;color:#38534a}.market-mini:hover{border-color:#867019;background:#fff9db}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #a06b00;outline-offset:2px}
 @media(max-width:740px){.board-row{grid-template-columns:76px minmax(0,1fr);gap:7px}.market-strip{grid-column:1/-1}.market-mini{flex-basis:116px}}

 .board-hero{background:radial-gradient(ellipse at top right,#c8e9dc 0%,transparent 52%),linear-gradient(125deg,#f6fbf8,#eaf4ef);border-color:#a8c4b6;box-shadow:inset 0 1px 0 #fff,0 12px 24px -20px #12382a}
 .board-hero h1{letter-spacing:-.035em}
 .board-row{border-radius:14px;background:linear-gradient(135deg,#fff,#f1f7f3);border-color:#b9ccc1;box-shadow:0 4px 14px -13px #0c3e2e}
 .schedule strong{font-variant-numeric:tabular-nums}.rank{display:inline-block;padding:1px 6px;margin-bottom:3px;border-radius:5px;background:#e3efe8;color:#234c3d;font-weight:750}
 .identity p{font-weight:650;color:#39574a;margin-bottom:3px}.identity a{color:#15352a}.identity small{margin-top:3px}
 .market-mini{background:linear-gradient(145deg,#fff,#edf5ef);transition:border-color .15s,background .15s}.market-mini.market-leader{border-color:#bb962e;background:linear-gradient(145deg,#fffdf1,#fff5cb)}
 .mini-title{font-weight:700}.model{display:flex;align-items:baseline;justify-content:space-between;gap:3px;font-variant-numeric:tabular-nums}.market-leader .model{background:#ffe15c}.proof b{color:#133f31;font-variant-numeric:tabular-nums}
 @media(prefers-reduced-motion:reduce){.market-mini{transition:none}}
</style>
