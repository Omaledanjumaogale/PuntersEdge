<script lang="ts">
  import type { BasketballFixture } from "$lib/convex";
  import { betslipItems, betslipOpen, activeAiFixture, activePaceSimulation } from "$lib/stores";
  import { 
    Activity, 
    Sparkles, 
    Sliders, 
    AlertCircle, 
    Plus, 
    Check, 
    TrendingUp 
  } from "lucide-svelte";

  let { fixture } = $props<{ fixture: BasketballFixture }>();

  let isSelected = $derived(
    $betslipItems.some((i) => i.fixtureId === fixture.fixtureId)
  );

  function toggleBetslip() {
    if (isSelected) {
      betslipItems.update((items) => items.filter((i) => i.fixtureId !== fixture.fixtureId));
    } else {
      betslipItems.update((items) => [
        ...items,
        {
          fixtureId: fixture.fixtureId,
          sport: "basketball",
          matchTitle: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          market: fixture.bestValue.market,
          selection: fixture.bestValue.selection,
          bookmaker: fixture.bestValue.bookmaker,
          odds: fixture.bestValue.bestOdds,
          edgePercent: fixture.bestValue.edgePercent,
        },
      ]);
      betslipOpen.set(true);
    }
  }

  function openAiExplainer() {
    activeAiFixture.set({
      fixtureId: fixture.fixtureId,
      sport: "basketball",
      matchTitle: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
    });
  }

  function openSimulation() {
    activePaceSimulation.set({
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      pace: fixture.paceMetrics.possessionsPer48,
      homeOff: fixture.paceMetrics.homeOffRating,
      awayOff: fixture.paceMetrics.awayOffRating,
      homeDef: fixture.paceMetrics.homeDefRating,
      awayDef: fixture.paceMetrics.awayDefRating,
      projectedScore: fixture.projectedScore,
      probabilities: fixture.probabilities,
    });
  }
</script>

<div class="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl transition-all duration-300 hover:border-slate-700 hover:shadow-2xl hover:shadow-indigo-950/20">
  <!-- Header: League & Kickoff -->
  <div class="flex items-center justify-between border-b border-slate-800/80 pb-3 text-xs">
    <div class="flex items-center gap-2">
      <span class="rounded-md bg-indigo-500/10 px-2.5 py-1 font-semibold text-indigo-400 border border-indigo-500/20">
        {fixture.league}
      </span>
      {#if fixture.marketSteamAlert}
        <span class="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 font-bold text-amber-400 border border-amber-500/20">
          <TrendingUp class="h-3 w-3" />
          <span>Steam Move</span>
        </span>
      {/if}
    </div>
    <span class="font-medium text-slate-400">{fixture.kickoffTime}</span>
  </div>

  <!-- Teams & Projected Points Section -->
  <div class="my-4 grid grid-cols-7 items-center gap-2">
    <!-- Home Team -->
    <div class="col-span-3 text-left">
      <h3 class="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
        {fixture.homeTeam}
      </h3>
      <div class="mt-1 flex items-center gap-1 text-xs text-slate-400">
        <span>Projected:</span>
        <span class="font-mono font-bold text-emerald-400">{fixture.projectedScore.home.toFixed(1)} pts</span>
      </div>
    </div>

    <!-- Center Projected Total -->
    <div class="col-span-1 text-center">
      <div class="flex flex-col items-center">
        <span class="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-extrabold text-slate-400">TOTAL</span>
        <span class="font-mono text-xs font-bold text-amber-400">{fixture.projectedScore.total.toFixed(0)}</span>
      </div>
    </div>

    <!-- Away Team -->
    <div class="col-span-3 text-right">
      <h3 class="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
        {fixture.awayTeam}
      </h3>
      <div class="mt-1 flex items-center justify-end gap-1 text-xs text-slate-400">
        <span>Projected:</span>
        <span class="font-mono font-bold text-indigo-400">{fixture.projectedScore.away.toFixed(1)} pts</span>
      </div>
    </div>
  </div>

  <!-- Pace & Efficiency Metrics Panel -->
  <div class="my-3 rounded-xl bg-slate-950/60 p-3 border border-slate-800/60 text-xs">
    <div class="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-2">
      <span class="flex items-center gap-1">
        <Activity class="h-3 w-3 text-indigo-400" />
        <span>Pace: {fixture.paceMetrics.possessionsPer48} Possessions/48m</span>
      </span>
      <button
        onclick={openSimulation}
        class="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium"
      >
        <Sliders class="h-3 w-3" />
        <span>Monte Carlo Sim</span>
      </button>
    </div>

    <div class="grid grid-cols-2 gap-2 text-center text-[11px]">
      <div class="rounded-lg bg-slate-800/60 p-1.5 border border-slate-700/40">
        <div class="text-slate-400">{fixture.homeTeam} Eff</div>
        <div class="font-mono font-bold text-slate-200">
          Off: {fixture.paceMetrics.homeOffRating} | Def: {fixture.paceMetrics.homeDefRating}
        </div>
      </div>
      <div class="rounded-lg bg-slate-800/60 p-1.5 border border-slate-700/40">
        <div class="text-slate-400">{fixture.awayTeam} Eff</div>
        <div class="font-mono font-bold text-slate-200">
          Off: {fixture.paceMetrics.awayOffRating} | Def: {fixture.paceMetrics.awayDefRating}
        </div>
      </div>
    </div>
  </div>

  <!-- Multi-Bookmaker Odds Grid -->
  <div class="my-3 grid grid-cols-3 gap-2 text-center text-xs">
    <!-- SportyBet -->
    <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
      <div class="text-[10px] font-semibold text-slate-400">SportyBet</div>
      <div class="mt-1 font-mono font-bold text-slate-200">
        ML: {fixture.odds.sportybet.homeMoneyline} / {fixture.odds.sportybet.awayMoneyline}
      </div>
      <div class="text-[10px] text-slate-400">
        Spread: {fixture.odds.sportybet.spreadLine} @ {fixture.odds.sportybet.homeSpreadOdds}
      </div>
    </div>
    <!-- 1xBet -->
    <div class="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-2">
      <div class="text-[10px] font-semibold text-emerald-400">1xBet (Top Line)</div>
      <div class="mt-1 font-mono font-bold text-slate-200">
        ML: <span class="text-emerald-300 font-extrabold">{fixture.odds.oneXbet.homeMoneyline}</span> / {fixture.odds.oneXbet.awayMoneyline}
      </div>
      <div class="text-[10px] text-slate-400">
        Spread: {fixture.odds.oneXbet.spreadLine} @ <span class="text-emerald-300 font-bold">{fixture.odds.oneXbet.homeSpreadOdds}</span>
      </div>
    </div>
    <!-- 22Bet -->
    <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
      <div class="text-[10px] font-semibold text-slate-400">22Bet</div>
      <div class="mt-1 font-mono font-bold text-slate-200">
        ML: {fixture.odds.twentyTwoBet.homeMoneyline} / {fixture.odds.twentyTwoBet.awayMoneyline}
      </div>
      <div class="text-[10px] text-slate-400">
        Spread: {fixture.odds.twentyTwoBet.spreadLine} @ {fixture.odds.twentyTwoBet.homeSpreadOdds}
      </div>
    </div>
  </div>

  <!-- Lineup Alert if present -->
  {#if fixture.lineupAlert}
    <div class="my-3 flex items-start gap-2 rounded-xl bg-amber-500/10 p-2.5 border border-amber-500/20 text-xs text-amber-300">
      <AlertCircle class="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
      <span>{fixture.lineupAlert}</span>
    </div>
  {/if}

  <!-- Footer: Value Recommendation & Actions -->
  <div class="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800/80 pt-3">
    <!-- Value pill -->
    <div class="flex items-center gap-2">
      <span class="rounded-md bg-emerald-500 px-2 py-0.5 text-xs font-black text-slate-950">
        {fixture.bestValue.grade}
      </span>
      <div class="flex flex-col text-left">
        <span class="text-xs font-bold text-white">{fixture.bestValue.selection}</span>
        <span class="text-[11px] font-mono text-emerald-400">
          +{fixture.bestValue.edgePercent}% Edge @ {fixture.bestValue.bestOdds} ({fixture.bestValue.bookmaker})
        </span>
      </div>
    </div>

    <!-- Buttons -->
    <div class="flex w-full sm:w-auto items-center gap-2">
      <!-- AI Explainer Button -->
      <button
        onclick={openAiExplainer}
        class="flex-1 sm:flex-initial flex items-center justify-center gap-1 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs font-bold text-indigo-300 hover:bg-indigo-500/20 transition-colors"
        title="Plain-English AI Explanation"
      >
        <Sparkles class="h-3.5 w-3.5 text-indigo-400" />
        <span>Explain Edge</span>
      </button>

      <!-- Add to Betslip Button -->
      <button
        onclick={toggleBetslip}
        class="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all {isSelected ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}"
      >
        {#if isSelected}
          <Check class="h-3.5 w-3.5 stroke-[3]" />
          <span>Selected</span>
        {:else}
          <Plus class="h-3.5 w-3.5 stroke-[3]" />
          <span>Add Betslip</span>
        {/if}
      </button>
    </div>
  </div>
</div>
