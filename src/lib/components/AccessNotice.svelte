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
  <p class="max-w-prose text-haze">{feed.error ?? (auth.signedIn ? 'The provider feed is unavailable. An active all-access membership is required for fixtures and backend AI explanations.' : 'Sign in with an all-access membership to load provider fixtures and analysis.')}</p>
  <a href="/subscribe" class="btn-ghost shrink-0">All-access · ₦10,000/month</a>
 </aside>
{/if}
