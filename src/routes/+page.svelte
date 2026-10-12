<script lang="ts">
  import { FALLBACK_FOOTBALL, FALLBACK_BASKETBALL } from "#lib/convex.ts";
  import FootballCard from "#lib/components/FootballCard.svelte";
  import BasketballCard from "#lib/components/BasketballCard.svelte";
  import { 
    Activity, 
    Flame, 
    TrendingUp, 
    ShieldCheck, 
    Filter, 
    CheckCircle2, 
    Sparkles, 
    Download 
  } from "lucide-svelte";

  let selectedSport = $state<"all" | "football" | "basketball">("all");
  let selectedLeague = $state<string>("all");
  let minEdgeFilter = $state<number>(0);

  let filteredFootball = $derived(
    FALLBACK_FOOTBALL.filter((m) => {
      if (selectedSport === "basketball") return false;
      if (selectedLeague !== "all" && m.league !== selectedLeague) return false;
      if (m.bestValue.edgePercent < minEdgeFilter) return false;
      return true;
    })
  );

  let filteredBasketball = $derived(
    FALLBACK_BASKETBALL.filter((b) => {
      if (selectedSport === "football") return false;
      if (selectedLeague !== "all" && b.league !== selectedLeague) return false;
      if (b.bestValue.edgePercent < minEdgeFilter) return false;
      return true;
    })
  );

  let totalAvailableCount = $derived(filteredFootball.length + filteredBasketball.length);
</script>

<svelte:head>
  <title>QuantEdge | Sports Predictive Intelligence Dashboard</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
  <!-- Hero / Market Pulse Banner -->
  <div class="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 p-6 sm:p-8 shadow-2xl">
    <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div class="max-w-2xl">
        <div class="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 mb-3">
          <Sparkles class="h-3.5 w-3.5" />
          <span>Real-Time Market Ingestion Active</span>
        </div>
        <h1 class="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
          Basketball & Football <br />
          <span class="bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
            Quantitative Prediction Engine
          </span>
        </h1>
        <p class="mt-2 text-sm text-slate-300">
          Eliminating bookmaker margin with Dixon-Coles Poisson football matrix calculations and tempo-free basketball pace simulations.
        </p>
      </div>

      <!-- Quick Stats KPI Cards -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4 shrink-0">
        <div class="rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5 text-center">
          <div class="text-[11px] font-semibold text-slate-400">Fixtures Modeled</div>
          <div class="mt-1 font-mono text-xl font-extrabold text-white">5 Active</div>
        </div>
        <div class="rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5 text-center">
          <div class="text-[11px] font-semibold text-slate-400">Best Edge Found</div>
          <div class="mt-1 font-mono text-xl font-extrabold text-emerald-400">+8.68%</div>
        </div>
        <div class="rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5 text-center">
          <div class="text-[11px] font-semibold text-slate-400">Avg Bookmaker Vig</div>
          <div class="mt-1 font-mono text-xl font-extrabold text-amber-400">3.8% - 7.1%</div>
        </div>
        <div class="rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5 text-center">
          <div class="text-[11px] font-semibold text-slate-400">Value Grade A+</div>
          <div class="mt-1 font-mono text-xl font-extrabold text-teal-400">3 Matches</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Filter & Sport Selector Bar -->
  <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 backdrop-blur-sm">
    <!-- Sport Toggle Tabs -->
    <div class="flex items-center gap-1 rounded-xl bg-slate-950 p-1 border border-slate-800">
      <button
        onclick={() => (selectedSport = "all")}
        class="rounded-lg px-4 py-2 text-xs font-bold transition-all {selectedSport === 'all' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:text-white'}"
      >
        All Matches
      </button>
      <button
        onclick={() => (selectedSport = "football")}
        class="rounded-lg px-4 py-2 text-xs font-bold transition-all {selectedSport === 'football' ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20' : 'text-slate-400 hover:text-white'}"
      >
        ⚽ Football (11v11)
      </button>
      <button
        onclick={() => (selectedSport = "basketball")}
        class="rounded-lg px-4 py-2 text-xs font-bold transition-all {selectedSport === 'basketball' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}"
      >
        🏀 Basketball (5v5)
      </button>
    </div>

    <!-- League & Edge Filters -->
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-1.5 text-xs text-slate-400">
        <Filter class="h-3.5 w-3.5" />
        <select
          bind:value={selectedLeague}
          class="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-white focus:border-emerald-500 focus:outline-none"
        >
          <option value="all">All Competitions</option>
          <option value="English Premier League">Premier League</option>
          <option value="La Liga (El Clásico)">La Liga</option>
          <option value="Bundesliga">Bundesliga</option>
          <option value="NBA">NBA</option>
          <option value="EuroLeague">EuroLeague</option>
        </select>
      </div>

      <!-- Edge Threshold -->
      <select
        bind:value={minEdgeFilter}
        class="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-white focus:border-emerald-500 focus:outline-none"
      >
        <option value={0}>Any Edge</option>
        <option value={3}>Min +3% Edge</option>
        <option value={5}>Min +5% Edge (Grade A+)</option>
      </select>
    </div>
  </div>

  <!-- Matches Grid -->
  <div>
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-lg font-bold text-white flex items-center gap-2">
        <span>Active Fixtures & Predictions</span>
        <span class="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-mono font-bold text-slate-400">
          {totalAvailableCount} Matches
        </span>
      </h2>
    </div>

    {#if totalAvailableCount === 0}
      <div class="rounded-3xl border border-slate-800 bg-slate-900/40 p-16 text-center text-slate-500">
        <p class="text-base font-semibold">No matches match your current filter.</p>
        <button
          onclick={() => { selectedSport = 'all'; selectedLeague = 'all'; minEdgeFilter = 0; }}
          class="mt-3 text-xs font-bold text-emerald-400 hover:underline"
        >
          Reset All Filters
        </button>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {#each filteredFootball as match}
          <FootballCard {match} />
        {/each}
        {#each filteredBasketball as fixture}
          <BasketballCard {fixture} />
        {/each}
      </div>
    {/if}
  </div>
</div>
