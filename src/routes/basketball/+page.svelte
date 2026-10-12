<script lang="ts">
  import { FALLBACK_BASKETBALL } from "$lib/convex";
  import BasketballCard from "$lib/components/BasketballCard.svelte";
  import { Activity, Sliders, Sparkles } from "lucide-svelte";
</script>

<svelte:head>
  <title>Basketball Fixtures | Pace Model & Monte Carlo Predictions</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
  <!-- Basketball Header -->
  <div class="rounded-3xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 p-6 sm:p-8">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-400 border border-indigo-500/20 mb-2">
          <Activity class="h-3.5 w-3.5" />
          <span>Basketball Analytics Hub (5v5)</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-white">Basketball Fixtures & Pace Performance</h1>
        <p class="mt-1 text-xs sm:text-sm text-slate-300">
          Evaluated via tempo-free possessions per 48 minutes, offensive/defensive efficiency, and 25,000-run Monte Carlo simulation distributions.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <div class="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-center">
          <div class="text-[10px] text-slate-400 font-semibold">Active Fixtures</div>
          <div class="font-mono text-lg font-bold text-indigo-400">{FALLBACK_BASKETBALL.length} Fixtures</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Matches Grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    {#each FALLBACK_BASKETBALL as fixture}
      <BasketballCard {fixture} />
    {/each}
  </div>
</div>
