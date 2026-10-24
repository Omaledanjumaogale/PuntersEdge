<script lang="ts">
 import {pct,odds} from '#lib/format.ts';
 let {fixtureId}:{fixtureId:string}=$props();let rows:any[]=$state([]),loading=$state(false),error=$state(''),loaded=$state('');
 async function load(){if(loading||loaded===fixtureId)return;loading=true;error='';const requested=fixtureId;try{const response=await fetch(`/api/fixture-evidence?id=${encodeURIComponent(requested)}`);if(!response.ok)throw new Error('Recorded evidence could not be loaded. Please retry.');const data=await response.json();if(requested===fixtureId){rows=data.rows;loaded=requested;}}catch(e){error=e instanceof Error?e.message:'Evidence unavailable';}finally{loading=false;}}
</script>
<details class="panel mt-4 p-3" ontoggle={(event)=>{if(event.currentTarget.open)void load();}}>
 <summary class="cursor-pointer font-semibold text-model">Selection evidence & recurrence proof</summary>
 {#if loading}<p class="mt-2 text-sm" role="status">Loading recorded evidence…</p>{:else if error}<p role="alert" class="mt-2 text-sm">{error}</p><button class="btn mt-2" onclick={load}>Retry evidence</button>{:else if loaded===fixtureId}
 <p class="mt-2 text-xs text-haze">Same recorded market evidence used by the production shortlist. Historical recurrence and its confidence interval describe comparable results, not a guarantee for this fixture.</p>
 <div class="mt-2 grid gap-2">{#each rows as row (row.id)}{@const g=row.cohort}
 <details class="option-card p-3 text-xs">
 <summary class="cursor-pointer font-semibold">{row.selection} · Model {pct(row.modelProb,1)}</summary>
 <p class="mt-2">{row.title??row.group??row.key} · {row.scope??'Recorded scope'} · {row.artifact??row.modelVersion} · {row.source??'Recorded publication'}</p>
 <p class="mt-1">Model band {Math.min(9,Math.floor(row.modelProb*10))*10}–{Math.min(100,Math.min(9,Math.floor(row.modelProb*10))*10+10)}% · {row.evidenceTier==='forecast-only'?'Forecast only':'Historical screening'}</p>
 <p class="mt-1"><strong>{g.strikeRate==null?'No binary results':pct(g.strikeRate,1)}</strong> recurrence · {g.won} wins / {g.binaryN} binary results · {g.lost} lost · {g.push??'Unrecorded'} returned · {g.partial??'Unrecorded'} partial</p>
 <p class="mt-1">Quoted history ROI: {g.quotedRoi==null?'Unavailable':pct(g.quotedRoi,1)} · {g.quotedN??'Unrecorded'} quotes</p>
 {#if g.binaryN}<div class="mt-2 block">Confidence meter · historical floor {pct(g.interval.low,1)}<span class="mt-1 block h-2 w-full overflow-hidden rounded-full bg-line" role="meter" aria-label="95% historical win-rate lower bound" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Number((g.interval.low*100).toFixed(1))}><span class="block h-full rounded-full" style:width={`${g.interval.low*100}%`} style:background={g.interval.low>=.65?'#22c55e':g.interval.low>=.5?'#f59e0b':'#ef4444'}></span></span></div>
 <p class="mt-1 font-semibold">{g.interval.low>=.65?'Strong recurrence':g.interval.low>=.5?'Moderate recurrence':'Weak recurrence'}</p><p>95% Wilson interval {pct(g.interval.low,1)}–{pct(g.interval.high,1)}</p>
 {:else}<p class="mt-2">Not validated · no historical confidence meter available.</p>{/if}
 <p class="mt-1">Recorded price: {row.pricing==='quoted'?odds(row.odds):'Unpriced · no bookmaker quote'} · Published {new Date(row.publishedAt).toLocaleString('en-NG')}</p>
 <details class="mt-2"><summary class="cursor-pointer font-semibold">Recorded examples & rules</summary><p class="mt-1">Comparable sport, model version, source, exact market, settlement scope and Model % band. Up to five recorded examples.</p>{#each g.examples??[] as example}<p class="mt-2">{example.matchTitle} · {example.league} · {example.country??''}<br />{example.selection} · Model {pct(example.modelProb,1)} · {example.result} · {example.score?.home}–{example.score?.away}<br />{new Date(example.kickoff).toLocaleString('en-NG')} · Published {new Date(example.publishedAt).toLocaleString('en-NG')}</p>{:else}<p class="mt-1">Examples were not recorded for this selection.</p>{/each}</details>
 </details>{:else}<p class="text-sm">No qualifying recorded shortlist evidence is available for this fixture. Its supported market forecasts remain below.</p>{/each}</div>
 {/if}
</details>
