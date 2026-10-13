<script lang="ts">
 import { auth } from '#lib/auth.svelte.ts';
 import { app, type SlipItem } from '#lib/state.svelte.ts';
 import { ngn, odds } from '#lib/format.ts';
 import { toast } from '#lib/toast.svelte.ts';
 import { whatsappSlip, downloadSlipPdf } from '#lib/slip-export.ts';
 import { api } from '../../../convex/_generated/api.js';
 import type { Doc } from '../../../convex/_generated/dataModel';
 type Saved = Doc<'saved_slips'> & { outcome: string; items: (Doc<'saved_slips'>['items'][number] & {result: string})[] };
 let slips = $state<Saved[]>([]);
 let loading = $state(true);
 let error = $state('');
 let busy = $state('');
 let editing = $state<string | null>(null);
 let deleting = $state<string | null>(null);
 let name = $state('');
 let stake = $state(1000);
 let betType = $state<'acca'|'singles'>('acca');
 let editItems = $state<(SlipItem & {fixtureStatus?:string})[]>([]);
 const currentOwner = $derived(auth.viewer?.id);
 $effect(() => {
  const client = auth.client, owner = currentOwner;
  slips = []; editing = null; error = ''; loading = Boolean(client);
  if (!client || !owner) return;
  return client.onUpdate(api.betslip.history, {}, value => { slips = value as Saved[]; loading = false; }, reason => { error = reason.message || 'Could not load saved slips.'; loading = false; });
 });
 function locked(slip: Saved) { return slip.items.length>0 && slip.items.every(item => item.fixtureStatus === 'finished' || item.fixtureStatus === 'cancelled'); }
 function startEdit(slip: Saved) {
  if (locked(slip)) return;
  editing = slip._id; name = slip.name; stake = slip.stake; betType = slip.betType;
  editItems = slip.items.map(item => ({ ...item, id: `${item.fixtureId}:${item.marketKey ?? item.selection}`, sport: item.sport as SlipItem['sport'], modelProb: item.modelProb ?? 1 / item.odds }));
 }
 const payload = (items: (SlipItem | Doc<'saved_slips'>['items'][number])[]) => items.map(({ fixtureId,sport,matchTitle,market,selection,bookmaker,odds,modelProb,pushProb,edgePercent,marketKey }) => ({fixtureId,sport,matchTitle,market,selection,bookmaker,odds,modelProb,pushProb,edgePercent,marketKey}));
 function addDraft() {
  const existing = new Set(editItems.map(item => `${item.fixtureId}:${item.marketKey ?? item.selection}`));
  editItems = [...editItems, ...app.slip.filter(item => !existing.has(`${item.fixtureId}:${item.marketKey ?? item.selection}`))];
 }
 async function saveEdit(slip: Saved) {
  if (!auth.client) return;
  busy = slip._id;
  try { await auth.client.mutation(api.betslip.updateHistory,{id:slip._id,name,stake,betType,items:payload(editItems.map(item => ['finished','cancelled'].includes(item.fixtureStatus ?? '') ? slip.items.find(original => original.fixtureId===item.fixtureId && original.marketKey===item.marketKey && original.selection===item.selection) ?? item : item))}); editing = null; toast.success('Saved slip updated.'); }
  catch(reason) { toast.error((reason as Error).message); }
  finally { busy = ''; }
 }
 async function remove(slip: Saved) {
  if (!auth.client) return; busy = slip._id;
  try { await auth.client.mutation(api.betslip.deleteHistory,{id:slip._id}); deleting=null; toast.success('Saved slip deleted.'); }
  catch(reason) { toast.error((reason as Error).message); }
  finally { busy=''; }
 }
 async function pdf(slip: Saved) {
  busy=slip._id;
  try { await downloadSlipPdf(slip); } catch { toast.error('PDF download failed. Try again.'); } finally { busy=''; }
 }
</script>
<svelte:head><title>Saved betslips — PuntersEdge</title><meta name="robots" content="noindex" /></svelte:head>
<div class="mx-auto max-w-4xl space-y-6">
 <header class="flex flex-wrap items-start justify-between gap-4">
  <div><p class="text-sm font-semibold uppercase tracking-widest text-model">Your collection</p><h1 class="mt-2 text-3xl font-bold">Saved betslips</h1><p class="mt-2 max-w-xl text-haze">Keep separate named slips, follow final scores, and share your picks. Edit your personal records while games are scheduled or live. Finished or cancelled selections stay fixed; unfinished selections remain editable.</p></div>
  <button class="btn-primary" onclick={() => app.slipOpen = true}>Open working slip</button>
 </header>
 {#if !auth.signedIn}
  <section class="surface p-6"><h2 class="text-xl font-bold">Your history follows your account</h2><p class="mt-2 text-haze">Log in to create and manage saved slips.</p><a class="btn-primary mt-4 inline-flex" href="/login?next=%2Fbetslips">Log in</a></section>
 {:else if loading}<p class="surface p-6" role="status">Loading your slips…</p>
 {:else if error}<p class="surface p-6 text-loss" role="alert">{error}</p>
 {:else if !slips.length}<section class="surface p-8 text-center"><h2 class="text-xl font-bold">Your first slip starts with a pick</h2><p class="mt-2 text-haze">Add scheduled or live picks from a dashboard, then name and save your working slip before games finish.</p><a href="/value-bets" class="btn-primary mt-4 inline-flex">Explore value bets</a></section>
 {:else}
  <p class="text-sm text-haze">{slips.length} saved slip{slips.length===1?'':'s'} · up to 100 per account</p>
  {#each slips as slip (slip._id)}
   <details class="surface group overflow-hidden">
    <summary class="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
     <div><h2 class="text-xl font-bold">{slip.name} <span class="inline-block text-haze transition-transform group-open:rotate-180">⌄</span></h2><p class="mt-1 text-sm text-haze">{slip.betType==='acca'?'Accumulator':'Singles'} · {slip.items.length} picks · {new Date(slip._creationTime).toLocaleDateString('en-NG')}</p></div>
     <span class="rounded-full px-3 py-1 text-sm font-semibold {slip.outcome==='won'?'tint-model text-model':slip.outcome==='lost'?'tint-loss text-loss':'bg-raised text-haze'}">{slip.outcome==='pending'?(slip.items.some(item=>item.fixtureStatus==='live')?'In progress':'Scheduled'):slip.outcome==='ungraded'?'Score available · ungraded':slip.outcome}</span>
    </summary>
    {#if editing===slip._id && !locked(slip)}
     <form class="space-y-4 p-5" onsubmit={event=>{event.preventDefault();void saveEdit(slip);}}>
      <label class="grid gap-1 text-sm">Slip name<input class="rounded-xl bg-ink p-3 ring-1 ring-line" maxlength="80" bind:value={name} required /></label>
      <div class="grid gap-3 sm:grid-cols-2"><label class="grid gap-1 text-sm">Stake (NGN)<input class="rounded-xl bg-ink p-3 ring-1 ring-line" type="number" min="0" max="1000000000" step="100" bind:value={stake} required /></label><label class="grid gap-1 text-sm">Type<select class="rounded-xl bg-ink p-3 ring-1 ring-line" bind:value={betType}><option value="acca">Accumulator</option><option value="singles">Singles</option></select></label></div>
      {#each editItems as item,index}<div class="flex items-center gap-3 rounded-xl bg-ink p-3"><div class="min-w-0 flex-1"><p class="text-xs text-haze">{item.matchTitle}</p><p class="font-medium">{item.selection} · {odds(item.odds)}</p></div><button type="button" class="p-2 text-loss disabled:opacity-40" disabled={item.fixtureStatus==='finished'||item.fixtureStatus==='cancelled'} onclick={()=>editItems=editItems.filter((_,i)=>i!==index)} aria-label="Remove {item.selection}">Remove</button></div>{/each}
      <button type="button" class="btn-secondary" disabled={!app.slip.length} onclick={addDraft}>Add picks from working slip</button>
      <p class="text-xs text-haze">Every retained or new selection is checked against the live schedule when you save.</p>
      <div class="flex flex-wrap gap-2"><button class="btn-primary" disabled={busy===slip._id||!editItems.length}>{busy===slip._id?'Saving…':'Save changes'}</button><button type="button" class="btn-secondary" onclick={()=>editing=null}>Cancel</button></div>
     </form>
    {:else}
     <ul class="divide-y divide-line px-5">{#each slip.items as item}<li class="py-4"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><a class="text-sm text-haze hover:text-chalk" href="/match?id={encodeURIComponent(item.fixtureId)}">{item.matchTitle}</a><p class="mt-1 font-semibold">{item.selection} <span class="text-book">@ {odds(item.odds)}</span></p><p class="mt-1 text-xs text-haze">{item.market} · {item.bookmaker} · Model {((item.modelProb??0)*100).toFixed(1)}%</p>{#if item.kickoff}<p class="mt-1 text-xs text-haze">{new Date(item.kickoff).toLocaleString('en-NG',{timeZone:'Africa/Lagos',dateStyle:'medium',timeStyle:'short'})} WAT</p>{/if}</div><span class="shrink-0 text-sm {item.result==='won'?'text-model':item.result==='lost'?'text-loss':'text-haze'}">{item.result==='pending'?(item.fixtureStatus==='live'?'Live':'Pending'):item.result}</span></div>{#if item.score}<p class="mt-2 rounded-lg bg-ink px-3 py-2 text-sm">{item.fixtureStatus==='finished'?'Final score':'Live score'}: <strong>{item.score.home}–{item.score.away}</strong>{#if item.score.regHome!==undefined && item.score.regAway!==undefined && (item.score.regHome!==item.score.home || item.score.regAway!==item.score.away)}<span class="text-haze"> · regulation {item.score.regHome}–{item.score.regAway}</span>{/if}</p>{/if}</li>{/each}</ul>
     <div class="grid grid-cols-2 gap-3 border-t border-line p-5 text-sm"><div><p class="text-haze">Stake {slip.betType==='singles'?'per pick':''}</p><p class="mt-1 font-semibold">{ngn(slip.stake)}</p></div><div><p class="text-haze">Potential return</p><p class="mt-1 font-semibold">{ngn(slip.potentialReturn)}</p></div></div>
     <div class="flex flex-wrap gap-2 border-t border-line p-5"><button class="btn-secondary" disabled={locked(slip)||busy===slip._id} onclick={()=>startEdit(slip)}>{locked(slip)?'Selections locked':'Edit slip'}</button><a class="btn-secondary" href={whatsappSlip(slip)} target="_blank" rel="noopener noreferrer">Share to WhatsApp</a><button class="btn-secondary" disabled={busy===slip._id} onclick={()=>pdf(slip)}>Download PDF</button><button class="rounded-full px-4 py-2 text-sm text-loss" onclick={()=>deleting=slip._id}>Delete</button></div>
     {#if deleting===slip._id}<div class="border-t border-line bg-ink p-5"><p class="text-sm">Delete “{slip.name}” from your history?</p><div class="mt-3 flex gap-3"><button class="btn-secondary text-loss" disabled={busy===slip._id} onclick={()=>remove(slip)}>Delete slip</button><button class="btn-secondary" onclick={()=>deleting=null}>Keep slip</button></div></div>{/if}
    {/if}
   </details>
  {/each}
 {/if}
 <p class="text-xs text-haze">Recorded odds are snapshots, not live bookmaker offers. Unknown markets remain ungraded. These records do not place or confirm wagers. 18+, bet within your means.</p>
</div>
