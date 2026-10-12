<script lang="ts">
  import { activePaceSimulation } from "$lib/stores";
  import { X, Sliders, Activity, BarChart2 } from "lucide-svelte";

  let data = $derived($activePaceSimulation);

  function close() {
    activePaceSimulation.set(null);
  }
</script>

{#if data}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
    <div class="relative w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
      <!-- Close button -->
      <button
        onclick={close}
        class="absolute right-4 top-4 rounded-xl border border-slate-800 p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
      >
        <X class="h-4 w-4" />
      </button>

      <!-- Modal Header -->
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <Sliders class="h-5 w-5" />
        </div>
        <div>
          <h2 class="text-lg font-bold text-white">Monte Carlo Pace Simulation (25,000 Runs)</h2>
          <p class="text-xs text-slate-400">{data.homeTeam} vs {data.awayTeam}</p>
        </div>
      </div>

      <!-- Core Projected Metrics -->
      <div class="my-4 grid grid-cols-3 gap-3 text-center text-xs">
        <div class="rounded-xl bg-slate-950/60 p-3 border border-slate-800">
          <div class="text-slate-400">Tempo Pace</div>
          <div class="mt-1 font-mono text-base font-bold text-emerald-400">{data.pace} Possessions</div>
        </div>
        <div class="rounded-xl bg-slate-950/60 p-3 border border-slate-800">
          <div class="text-slate-400">Projected Score</div>
          <div class="mt-1 font-mono text-base font-bold text-white">
            {data.projectedScore.home.toFixed(1)} - {data.projectedScore.away.toFixed(1)}
          </div>
        </div>
        <div class="rounded-xl bg-slate-950/60 p-3 border border-slate-800">
          <div class="text-slate-400">Projected Total</div>
          <div class="mt-1 font-mono text-base font-bold text-amber-400">{data.projectedScore.total.toFixed(1)} Pts</div>
        </div>
      </div>

      <!-- Simulation Distribution Breakdown -->
      <div class="rounded-xl bg-slate-950/60 p-4 border border-slate-800 space-y-3 text-xs">
        <h4 class="font-bold text-slate-200">Simulated Outcome Probabilities</h4>
        
        <!-- Moneyline -->
        <div>
          <div class="flex justify-between font-medium text-slate-400 mb-1">
            <span>{data.homeTeam} Win: {(data.probabilities.homeWin * 100).toFixed(1)}%</span>
            <span>{data.awayTeam} Win: {(data.probabilities.awayWin * 100).toFixed(1)}%</span>
          </div>
          <div class="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div style="width: {data.probabilities.homeWin * 100}%" class="bg-emerald-500"></div>
            <div style="width: {data.probabilities.awayWin * 100}%" class="bg-indigo-500"></div>
          </div>
        </div>

        <!-- Over / Under Total -->
        <div>
          <div class="flex justify-between font-medium text-slate-400 mb-1">
            <span>Over Total: {(data.probabilities.overTotal * 100).toFixed(1)}%</span>
            <span>Under Total: {(data.probabilities.underTotal * 100).toFixed(1)}%</span>
          </div>
          <div class="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div style="width: {data.probabilities.overTotal * 100}%" class="bg-amber-500"></div>
            <div style="width: {data.probabilities.underTotal * 100}%" class="bg-slate-600"></div>
          </div>
        </div>

        <!-- Spread Coverage -->
        <div>
          <div class="flex justify-between font-medium text-slate-400 mb-1">
            <span>Home Spread Cover: {(data.probabilities.spreadCoverHome * 100).toFixed(1)}%</span>
            <span>Away Spread Cover: {((1 - data.probabilities.spreadCoverHome) * 100).toFixed(1)}%</span>
          </div>
          <div class="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div style="width: {data.probabilities.spreadCoverHome * 100}%" class="bg-teal-500"></div>
            <div style="width: {(1 - data.probabilities.spreadCoverHome) * 100}%" class="bg-rose-500"></div>
          </div>
        </div>
      </div>

      <!-- Footer Info -->
      <div class="mt-4 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-3">
        <span>Evaluated with tempo-free regression and Box-Muller Gaussian sampling.</span>
        <button
          onclick={close}
          class="rounded-xl bg-indigo-500 px-4 py-2 font-bold text-white hover:brightness-110"
        >
          Done
        </button>
      </div>
    </div>
  </div>
{/if}
