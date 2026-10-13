<script lang="ts">
 import { auth } from '#lib/auth.svelte.ts';
 import type { SportKey } from '#lib/sports.ts';
 import { makeFunctionReference } from 'convex/server';
 let {fixtureId, sport}: {fixtureId: string; sport: SportKey} = $props();
 let provider = $state<'aihubmix' | 'agnes'>('agnes');
 let text = $state(''), error = $state(''), label = $state(''), loading = $state(false);
 let generation = 0;
 $effect(() => { fixtureId; sport; provider; generation++; text = ''; error = ''; loading = false; });
 async function explain() {
  if (!auth.client) { error = 'Sign in with an active subscription to request AI analysis.'; return; }
  const current = ++generation;
  loading = true; error = '';
  try {
   const result = await auth.client.action(makeFunctionReference<'action'>('ai_insights:explain'), {fixtureId, sport, provider});
   if (current === generation) { text = result.text; label = result.provider; }
  } catch (reason) { if (current === generation) error = reason instanceof Error ? reason.message : 'AI is temporarily unavailable.'; }
  finally { if (current === generation) loading = false; }
 }
</script>
<section class="surface mt-4 p-5" aria-label="Live AI explanation">
 <h3 class="font-bold text-chalk">Live AI explanation</h3>
 <p class="mt-1 text-sm text-haze">Subscriber access. Uses the backend fixture feed; AI may make mistakes. Up to 10 requests daily.</p>
 <label class="mt-3 block text-sm text-haze">AI provider
  <select class="mt-1 block w-full rounded-xl border border-line bg-deep p-3 text-chalk" bind:value={provider} disabled={loading}>
   <option value="agnes">Agnes AI · default</option>
   <option value="aihubmix">AIHubMix · free model</option>
  </select>
 </label>
 <button class="mt-3 rounded-xl bg-pop px-4 py-3 font-semibold text-deep disabled:opacity-50" onclick={explain} disabled={loading}>{loading ? 'Analysing…' : 'Explain live fixture'}</button>
 {#if error}<p role="alert" class="mt-3 text-sm text-loss">{error}</p>{/if}
 {#if text}<p class="mt-4 whitespace-pre-line text-sm leading-relaxed text-chalk">{text}</p><p class="mt-2 text-xs text-haze">{label} · Based on the current live feed</p>{/if}
</section>
