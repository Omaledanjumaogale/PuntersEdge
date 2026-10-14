<script lang="ts">
 import {auth} from '#lib/auth.svelte.ts';
 import {anyApi} from 'convex/server';
 let rows=$state<any[]>([]),allowed=$state(false),checked=$state(false),busy=$state(false),error=$state(''),source=$state('');
 $effect(()=>{const client=auth.client;if(!client)return;return client.onUpdate(anyApi.admin.status,{},r=>{allowed=r.isSuperAdmin===true;checked=true;},()=>{checked=true;error='Access verification failed.';});});
 $effect(()=>{if(!allowed||!auth.client)return;return auth.client.onUpdate(anyApi.models.list,{},r=>rows=r,()=>error='Model registry unavailable.');});
 async function register(){if(!auth.client)return;busy=true;error='';try{await auth.client.mutation(anyApi.models.register,{artifact:JSON.parse(source)});source='';}catch(e){error=e instanceof Error?e.message:'Import failed.';}finally{busy=false;}}
 async function change(id:any,retire=false){if(!auth.client)return;busy=true;try{await auth.client.mutation(retire?anyApi.models.retire:anyApi.models.shadowActivate,{id});}catch(e){error=e instanceof Error?e.message:'Update failed.';}finally{busy=false;}}
</script>
<svelte:head><title>Model registry · PuntersEdge</title><meta name="robots" content="noindex,nofollow"/></svelte:head>
<section class="mx-auto max-w-4xl space-y-6">
 <a href="/admin" class="text-model">← Admin console</a><h1 class="font-display text-3xl font-bold">Model registry</h1>
 {#if !checked}<p>Verifying access…</p>{:else if !allowed}<p>Administrator access required.</p>{:else}
 <p class="text-haze">Import fitted, versioned models for prospective evaluation. Activating a candidate updates forecasts for its mapped competition; it remains unapproved and produces no stake recommendation. Retire it to restore the baseline.</p>
 <label for="artifact" class="block font-semibold">Model artifact JSON</label><textarea id="artifact" bind:value={source} rows="10" class="w-full rounded-xl border border-line bg-deep p-3 font-mono text-sm" spellcheck="false"></textarea>
 <button class="btn-primary" disabled={busy||!source.trim()} onclick={register}>Import candidate</button>
 {#if error}<p role="alert" class="text-away">{error}</p>{/if}
 {#each rows as row}<article class="surface space-y-3 p-4"><h2 class="font-bold">{row.version}</h2><p class="text-sm text-haze">{row.sport} · {row.league} · {row.artifact.scope??'full game'} · {row.artifact.trainingCount} training games · {row.mode} · unvalidated</p><p class="text-xs text-haze">Training cutoff: {row.artifact.trainedThrough}</p><div class="flex flex-wrap gap-3"><button class="btn-ghost" disabled={busy||row.mode==='active'} onclick={()=>change(row._id)}>Use for shadow forecasts</button><button class="btn-ghost" disabled={busy||row.mode==='retired'} onclick={()=>change(row._id,true)}>Retire</button></div></article>{:else}<p>No fitted artifacts imported.</p>{/each}
 {/if}
</section>
