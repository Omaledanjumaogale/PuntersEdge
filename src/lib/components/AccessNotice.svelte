<script lang="ts">
 import { auth } from '#lib/auth.svelte.ts';
 import { feed } from '#lib/feed.svelte.ts';
 import { anyApi } from 'convex/server';
 let active = $state(false);
 $effect(() => {
  const client = auth.client; active = false;
  if (!client) return;
  return client.onUpdate(anyApi.payments.mine, {}, subscription => { active = subscription?.active === true; }, () => { active = false; });
 });
</script>
{#if !active || feed.error}
 <aside class="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-raised p-4 text-sm" aria-label="Live data access">
  <p class="max-w-prose text-haze">{feed.error ?? (auth.signedIn ? 'You are on the free preview. Exclusive VIP unlocks every analytical page and full match outputs.' : 'Free board preview · Subscribe to Exclusive VIP for all projections and confidence percentages.')}</p>
  <a href="/subscribe" class="btn-ghost shrink-0">Exclusive VIP · ₦10,000/month</a>
 </aside>
{/if}
