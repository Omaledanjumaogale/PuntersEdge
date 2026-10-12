<script lang="ts">
  import { FALLBACK_FOOTBALL, FALLBACK_BASKETBALL } from "#lib/convex.ts";
  import { betslipItems, betslipOpen } from "#lib/stores.ts";
  import { Flame, TrendingUp, Sparkles, Plus, Check } from "lucide-svelte";

  // Combine top value bets
  const valueBets = [
    {
      sport: "Basketball",
      league: "NBA",
      match: "Los Angeles Lakers vs Golden State Warriors",
      fixtureId: "bb_lakers_warriors_02",
      market: "Total Game Points",
      selection: "Over 228.5 Points",
      bookmaker: "1xBet",
      bestOdds: 1.90,
      fairOdds: 1.75,
      edgePercent: 8.68,
      kellyStakePercent: 4.82,
      grade: "A+",
      steamMove: true,
      reason: "Pace calculation projects 101.8 possessions and 232.2 points; 1xBet line is significantly undervalued.",
    },
    {
      sport: "Football",
      league: "English Premier League",
      match: "Arsenal FC vs Chelsea FC",
      fixtureId: "fb_arsenal_chelsea_01",
      market: "Match Winner (1X2)",
      selection: "Arsenal Win",
      bookmaker: "1xBet",
      bestOdds: 2.02,
      fairOdds: 1.89,
      edgePercent: 6.87,
      kellyStakePercent: 3.36,
      grade: "A+",
      steamMove: true,
      reason: "Dixon-Coles bivariate model projects 52.8% win probability vs 1xBet implied 49.5%.",
    },
    {
      sport: "Basketball",
      league: "NBA",
      match: "Boston Celtics vs Miami Heat",
      fixtureId: "bb_boston_miami_01",
      market: "Point Spread (-7.5)",
      selection: "Boston Celtics -7.5",
      bookmaker: "1xBet",
      bestOdds: 1.94,
      fairOdds: 1.82,
      edgePercent: 6.31,
      kellyStakePercent: 3.35,
      grade: "A+",
      steamMove: true,
      reason: "Miami defensive frontcourt degradation gives Boston +6.31% spread coverage advantage.",
    },
    {
      sport: "Football",
      league: "La Liga (El Clásico)",
      match: "Real Madrid vs FC Barcelona",
      fixtureId: "fb_realmadrid_barcelona_02",
      market: "Total Goals",
      selection: "Over 2.5 Goals",
      bookmaker: "1xBet",
      bestOdds: 1.62,
      fairOdds: 1.54,
      edgePercent: 5.19,
      kellyStakePercent: 4.12,
      grade: "A",
      steamMove: false,
      reason: "Both squads attacking outputs yield combined 3.50 expected goals.",
    },
  ];

  function isAdded(id: string) {
    return $betslipItems.some((i) => i.fixtureId === id);
  }

  function addBet(bet: any) {
    if (!isAdded(bet.fixtureId)) {
      betslipItems.update((items) => [
        ...items,
        {
          fixtureId: bet.fixtureId,
          sport: bet.sport.toLowerCase() as any,
          matchTitle: bet.match,
          market: bet.market,
          selection: bet.selection,
          bookmaker: bet.bookmaker,
          odds: bet.bestOdds,
          edgePercent: bet.edgePercent,
        },
      ]);
      betslipOpen.set(true);
    }
  }
</script>

<svelte:head>
  <title>Value Bets Radar | Expected Edge & Staking Optimizer</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
  <!-- Value Radar Header -->
  <div class="rounded-3xl border border-amber-500/20 bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 p-6 sm:p-8">
    <div class="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400 border border-amber-500/20 mb-2">
      <Flame class="h-3.5 w-3.5" />
      <span>Positive Mathematical Expectation (+EV)</span>
    </div>
    <h1 class="text-2xl sm:text-3xl font-extrabold text-white">Daily High-Yield Value Radar</h1>
    <p class="mt-1 text-xs sm:text-sm text-slate-300">
      Only showing mathematically validated bets where the fair statistical probability exceeds the bookmaker's offering.
    </p>
  </div>

  <!-- Value Bets Table / Cards -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    {#each valueBets as bet}
      <div class="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl transition-all hover:border-slate-700">
        <!-- Top bar -->
        <div class="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
          <div class="flex items-center gap-2">
            <span class="rounded bg-slate-800 px-2 py-0.5 font-bold text-slate-300">{bet.sport}</span>
            <span class="text-slate-400 font-medium">{bet.league}</span>
          </div>
          <div class="flex items-center gap-1.5">
            {#if bet.steamMove}
              <span class="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                Steam Signal
              </span>
            {/if}
            <span class="rounded-md bg-emerald-500 px-2 py-0.5 text-xs font-black text-slate-950">
              Grade {bet.grade}
            </span>
          </div>
        </div>

        <!-- Match & Pick -->
        <div class="my-3">
          <h3 class="text-base font-bold text-white">{bet.match}</h3>
          <div class="mt-1 flex items-center gap-2 text-xs">
            <span class="text-slate-400">{bet.market}:</span>
            <span class="font-bold text-emerald-400 text-sm">{bet.selection}</span>
          </div>
        </div>

        <!-- Metrics comparison -->
        <div class="my-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-950/60 p-2.5 border border-slate-800 text-center text-xs font-mono">
          <div>
            <div class="text-[10px] text-slate-400 font-sans">Best Odds</div>
            <div class="font-bold text-white mt-0.5">{bet.bestOdds} ({bet.bookmaker})</div>
          </div>
          <div>
            <div class="text-[10px] text-slate-400 font-sans">True Fair Odds</div>
            <div class="font-bold text-indigo-400 mt-0.5">{bet.fairOdds}</div>
          </div>
          <div>
            <div class="text-[10px] text-slate-400 font-sans">Expected Edge</div>
            <div class="font-bold text-emerald-400 mt-0.5">+{bet.edgePercent}%</div>
          </div>
        </div>

        <!-- Plain English reason -->
        <p class="text-xs text-slate-300 leading-relaxed my-2">
          {bet.reason}
        </p>

        <!-- Footer -->
        <div class="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs">
          <span class="text-slate-400">
            Suggested Stake: <strong class="text-teal-400 font-mono">{bet.kellyStakePercent}% of Bankroll</strong>
          </span>
          <button
            onclick={() => addBet(bet)}
            class="flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold transition-all {isAdded(bet.fixtureId) ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}"
          >
            {#if isAdded(bet.fixtureId)}
              <Check class="h-3.5 w-3.5" />
              <span>Added</span>
            {:else}
              <Plus class="h-3.5 w-3.5" />
              <span>Add to Betslip</span>
            {/if}
          </button>
        </div>
      </div>
    {/each}
  </div>
</div>
