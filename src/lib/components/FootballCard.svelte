<script lang="ts">
  import type { FootballMatch } from "$lib/convex";
  import { betslipItems, betslipOpen, activeAiFixture, activeScoreMatrix } from "$lib/stores";
  import { 
    TrendingUp, 
    Sparkles, 
    Grid3x3, 
    AlertCircle, 
    Plus, 
    Check, 
    ArrowUpRight,
    ShieldAlert
  } from "lucide-svelte";

  let { match } = $props<{ match: FootballMatch }>();

  let isSelected = $derived(
    $betslipItems.some((i) => i.fixtureId === match.fixtureId)
  );

  function toggleBetslip() {
    if (isSelected) {
      betslipItems.update((items) => items.filter((i) => i.fixtureId !== match.fixtureId));
    } else {
      betslipItems.update((items) => [
        ...items,
        {
          fixtureId: match.fixtureId,
          sport: "football",
          matchTitle: `${match.homeTeam} vs ${match.awayTeam}`,
          market: match.bestValue.market,
          selection: match.bestValue.selection,
          bookmaker: match.bestValue.bookmaker,
          odds: match.bestValue.bestOdds,
          edgePercent: match.bestValue.edgePercent,
        },
      ]);
      betslipOpen.set(true);
    }
  }

  function openAiExplainer() {
    activeAiFixture.set({
      fixtureId: match.fixtureId,
      sport: "football",
      matchTitle: `${match.homeTeam} vs ${match.awayTeam}`,
    });
  }

  function openMatrix() {
    activeScoreMatrix.set({
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      lambda: match.expectedGoals.homeLambda,
      mu: match.expectedGoals.awayMu,
      topScores: match.topScorelines,
    });
  }
</script>

<div class="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl transition-all duration-300 hover:border-slate-700 hover:shadow-2xl hover:shadow-emerald-950/20">
  <!-- Header: League & Kickoff -->
  <div class="flex items-center justify-between border-b border-slate-800/80 pb-3 text-xs">
    <div class="flex items-center gap-2">
      <span class="rounded-md bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-400 border border-emerald-500/20">
        {match.league}
      </span>
      {#if match.marketSteamAlert}
        <span class="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 font-bold text-amber-400 border border-amber-500/20">
          <TrendingUp class="h-3 w-3" />
          <span>Steam Move</span>
        </span>
      {/if}
    </div>
    <span class="font-medium text-slate-400">{match.kickoffTime}</span>
  </div>

  <!-- Teams & Expected Goals Section -->
  <div class="my-4 grid grid-cols-7 items-center gap-2">
    <!-- Home Team -->
    <div class="col-span-3 text-left">
      <h3 class="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
        {match.homeTeam}
      </h3>
      <div class="mt-1 flex items-center gap-1 text-xs text-slate-400">
        <span>Expected Goals:</span>
        <span class="font-mono font-bold text-emerald-400">{match.expectedGoals.homeLambda.toFixed(2)}</span>
      </div>
    </div>

    <!-- Center VS / Probability -->
    <div class="col-span-1 text-center">
      <span class="rounded-full bg-slate-800 px-2 py-1 text-[11px] font-extrabold text-slate-400">VS</span>
    </div>

    <!-- Away Team -->
    <div class="col-span-3 text-right">
      <h3 class="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
        {match.awayTeam}
      </h3>
      <div class="mt-1 flex items-center justify-end gap-1 text-xs text-slate-400">
        <span>Expected Goals:</span>
        <span class="font-mono font-bold text-indigo-400">{match.expectedGoals.awayMu.toFixed(2)}</span>
      </div>
    </div>
  </div>

  <!-- Win Probability Split Bar -->
  <div class="my-3">
    <div class="mb-1.5 flex justify-between text-[11px] font-semibold text-slate-400">
      <span>Home {(match.probabilities.homeWin * 100).toFixed(0)}%</span>
      <span>Draw {(match.probabilities.draw * 100).toFixed(0)}%</span>
      <span>Away {(match.probabilities.awayWin * 100).toFixed(0)}%</span>
    </div>
    <div class="flex h-2 w-full overflow-hidden rounded-full bg-slate-800">
      <div style="width: {match.probabilities.homeWin * 100}%" class="bg-emerald-500"></div>
      <div style="width: {match.probabilities.draw * 100}%" class="bg-slate-500"></div>
      <div style="width: {match.probabilities.awayWin * 100}%" class="bg-indigo-500"></div>
    </div>
  </div>

  <!-- Predicted Scorelines Pills -->
  <div class="my-3 rounded-xl bg-slate-950/60 p-2.5 border border-slate-800/60">
    <div class="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-400">
      <span>Most Probable Scorelines (Dixon-Coles)</span>
      <button 
        onclick={openMatrix}
        class="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-[11px] font-medium"
      >
        <Grid3x3 class="h-3 w-3" />
        <span>Full Matrix</span>
      </button>
    </div>
    <div class="flex flex-wrap gap-1.5">
      {#each match.topScorelines.slice(0, 4) as score}
        <span class="rounded-lg bg-slate-800/80 px-2 py-1 text-xs font-mono font-medium text-slate-200 border border-slate-700/50">
          <strong class="text-white">{score.home} - {score.away}</strong>
          <span class="ml-1 text-[10px] text-emerald-400">{(score.prob * 100).toFixed(1)}%</span>
        </span>
      {/each}
    </div>
  </div>

  <!-- Multi-Bookmaker Odds Grid -->
  <div class="my-3 grid grid-cols-3 gap-2 text-center text-xs">
    <!-- SportyBet -->
    <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
      <div class="text-[10px] font-semibold text-slate-400">SportyBet</div>
      <div class="mt-1 font-mono font-bold text-slate-200">
        1: <span class="text-emerald-400">{match.odds.sportybet.home}</span> | X: {match.odds.sportybet.draw} | 2: {match.odds.sportybet.away}
      </div>
    </div>
    <!-- 1xBet -->
    <div class="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-2">
      <div class="text-[10px] font-semibold text-emerald-400">1xBet (Top Odds)</div>
      <div class="mt-1 font-mono font-bold text-slate-200">
        1: <span class="text-emerald-300 font-extrabold">{match.odds.oneXbet.home}</span> | X: {match.odds.oneXbet.draw} | 2: {match.odds.oneXbet.away}
      </div>
    </div>
    <!-- 22Bet -->
    <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
      <div class="text-[10px] font-semibold text-slate-400">22Bet</div>
      <div class="mt-1 font-mono font-bold text-slate-200">
        1: {match.odds.twentyTwoBet.home} | X: {match.odds.twentyTwoBet.draw} | 2: {match.odds.twentyTwoBet.away}
      </div>
    </div>
  </div>

  <!-- Lineup Alert if present -->
  {#if match.lineupAlert}
    <div class="my-3 flex items-start gap-2 rounded-xl bg-amber-500/10 p-2.5 border border-amber-500/20 text-xs text-amber-300">
      <AlertCircle class="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
      <span>{match.lineupAlert}</span>
    </div>
  {/if}

  <!-- Footer: Value Recommendation & Actions -->
  <div class="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800/80 pt-3">
    <!-- Value pill -->
    <div class="flex items-center gap-2">
      <span class="rounded-md bg-emerald-500 px-2 py-0.5 text-xs font-black text-slate-950">
        {match.bestValue.grade}
      </span>
      <div class="flex flex-col text-left">
        <span class="text-xs font-bold text-white">{match.bestValue.selection}</span>
        <span class="text-[11px] font-mono text-emerald-400">
          +{match.bestValue.edgePercent}% Expected Edge @ {match.bestValue.bestOdds} ({match.bestValue.bookmaker})
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
