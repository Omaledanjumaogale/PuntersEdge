<script lang="ts">
  import { activeAiFixture } from "$lib/stores";
  import { X, Sparkles, ShieldCheck, TrendingUp, Users, DollarSign } from "lucide-svelte";
  import { FALLBACK_FOOTBALL, FALLBACK_BASKETBALL } from "$lib/convex";

  let fixture = $derived($activeAiFixture);

  let details = $derived.by(() => {
    if (!fixture) return null;
    if (fixture.sport === "football") {
      const match = FALLBACK_FOOTBALL.find((m) => m.fixtureId === fixture.fixtureId) || FALLBACK_FOOTBALL[0];
      return {
        title: `${match.homeTeam} vs ${match.awayTeam}`,
        summary: `Our statistical system identified clear value on ${match.bestValue.selection} at ${match.bestValue.bestOdds} odds with ${match.bestValue.bookmaker}.`,
        marketAnalysis: `SportyBet prices this at ${match.odds.sportybet.home}, while 1xBet offers ${match.bestValue.bestOdds}. After removing the bookmaker's margin, the true fair odds are ${match.bestValue.fairOdds}. This gives you a +${match.bestValue.edgePercent}% mathematical edge.`,
        lineupAnalysis: match.lineupAlert,
        staking: `We recommend risking ${match.bestValue.kellyStakePercent}% of your bankroll on this selection to preserve capital while maximizing long-term profit.`,
      };
    } else {
      const bMatch = FALLBACK_BASKETBALL.find((m) => m.fixtureId === fixture.fixtureId) || FALLBACK_BASKETBALL[0];
      return {
        title: `${bMatch.homeTeam} vs ${bMatch.awayTeam}`,
        summary: `The pace calculation projects ${bMatch.paceMetrics.possessionsPer48} possessions and a combined total of ${bMatch.projectedScore.total.toFixed(1)} points.`,
        marketAnalysis: `Bookmakers set their line around ${bMatch.odds.sportybet.totalLine}, but our computer simulation projects a distinct scoring advantage on ${bMatch.bestValue.selection}.`,
        lineupAnalysis: bMatch.lineupAlert,
        staking: `Recommended stake is ${bMatch.bestValue.kellyStakePercent}% of your active bankroll based on a +${bMatch.bestValue.edgePercent}% edge over bookmaker lines.`,
      };
    }
  });

  function close() {
    activeAiFixture.set(null);
  }
</script>

{#if fixture && details}
  <!-- Backdrop -->
  <div class="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm">
    <!-- Slide-in Drawer -->
    <div class="h-full w-full max-w-md border-l border-slate-800 bg-slate-900 p-6 shadow-2xl flex flex-col justify-between overflow-y-auto">
      <div>
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-slate-800 pb-4">
          <div class="flex items-center gap-2.5">
            <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sparkles class="h-5 w-5" />
            </div>
            <div>
              <h3 class="text-sm font-bold text-white">Smart Match Insights</h3>
              <p class="text-xs text-slate-400">{details.title}</p>
            </div>
          </div>
          <button
            onclick={close}
            class="rounded-xl border border-slate-800 p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X class="h-4 w-4" />
          </button>
        </div>

        <!-- Plain-English Breakdown Blocks -->
        <div class="my-5 space-y-4 text-xs">
          <!-- 1. Executive Summary -->
          <div class="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
            <div class="flex items-center gap-2 font-bold text-emerald-400 mb-1.5">
              <ShieldCheck class="h-4 w-4" />
              <span>Key Prediction</span>
            </div>
            <p class="text-slate-200 leading-relaxed">{details.summary}</p>
          </div>

          <!-- 2. Market Pricing & Odds Advantage -->
          <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div class="flex items-center gap-2 font-bold text-indigo-400 mb-1.5">
              <TrendingUp class="h-4 w-4" />
              <span>Bookmaker Pricing Advantage</span>
            </div>
            <p class="text-slate-300 leading-relaxed">{details.marketAnalysis}</p>
          </div>

          <!-- 3. Lineup & Player Impact -->
          <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div class="flex items-center gap-2 font-bold text-amber-400 mb-1.5">
              <Users class="h-4 w-4" />
              <span>Player & Squad Impact</span>
            </div>
            <p class="text-slate-300 leading-relaxed">{details.lineupAnalysis}</p>
          </div>

          <!-- 4. Recommended Staking -->
          <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div class="flex items-center gap-2 font-bold text-teal-400 mb-1.5">
              <DollarSign class="h-4 w-4" />
              <span>Recommended Stake</span>
            </div>
            <p class="text-slate-300 leading-relaxed">{details.staking}</p>
          </div>
        </div>
      </div>

      <!-- Action Button -->
      <button
        onclick={close}
        class="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 font-bold text-slate-950 hover:brightness-110 active:scale-95 transition-all text-sm shadow-lg shadow-emerald-500/20"
      >
        Understood, Close
      </button>
    </div>
  </div>
{/if}
