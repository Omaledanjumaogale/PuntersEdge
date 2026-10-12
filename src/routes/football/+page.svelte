<script lang="ts">
  import { FALLBACK_FOOTBALL } from "$lib/convex";
  import FootballCard from "$lib/components/FootballCard.svelte";
  import { ShieldCheck, BarChart3, TrendingUp, Sparkles } from "lucide-svelte";
</script>

<svelte:head>
  <title>Football Scheduled Matches | Dixon-Coles Poisson Predictions</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
  <!-- Football Header -->
  <div class="rounded-3xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 p-6 sm:p-8">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20 mb-2">
          <BarChart3 class="h-3.5 w-3.5" />
          <span>Football Analytics Hub (11v11)</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-white">Scheduled Football Matches & Value Screener</h1>
        <p class="mt-1 text-xs sm:text-sm text-slate-300">
          Powered by Dixon-Coles bivariate Poisson modeling, low-score dependency adjustments, and player injury degradation matrices.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <div class="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-center">
          <div class="text-[10px] text-slate-400 font-semibold">Active Fixtures</div>
          <div class="font-mono text-lg font-bold text-emerald-400">{FALLBACK_FOOTBALL.length} Matches</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Matches Grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    {#each FALLBACK_FOOTBALL as match}
      <FootballCard {match} />
    {/each}
  </div>
</div>
