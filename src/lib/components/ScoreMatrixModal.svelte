<script lang="ts">
  import { activeScoreMatrix } from "$lib/stores";
  import { X, Grid3x3, CheckCircle2 } from "lucide-svelte";
  import { generateScoreMatrix } from "$lib/engine/football_model.js";

  let data = $derived($activeScoreMatrix);
  let matrix = $derived(
    data ? generateScoreMatrix(data.lambda, data.mu, -0.05, 4).matrix : []
  );

  function close() {
    activeScoreMatrix.set(null);
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
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <Grid3x3 class="h-5 w-5" />
        </div>
        <div>
          <h2 class="text-lg font-bold text-white">Dixon-Coles Exact Score Matrix</h2>
          <p class="text-xs text-slate-400">{data.homeTeam} vs {data.awayTeam}</p>
        </div>
      </div>

      <!-- Expected Goals parameters -->
      <div class="my-4 grid grid-cols-2 gap-3 text-xs">
        <div class="rounded-xl bg-slate-950/60 p-3 border border-slate-800">
          <span class="text-slate-400">{data.homeTeam} Expected Goals (λ):</span>
          <span class="ml-2 font-mono font-bold text-emerald-400">{data.lambda.toFixed(2)}</span>
        </div>
        <div class="rounded-xl bg-slate-950/60 p-3 border border-slate-800">
          <span class="text-slate-400">{data.awayTeam} Expected Goals (μ):</span>
          <span class="ml-2 font-mono font-bold text-indigo-400">{data.mu.toFixed(2)}</span>
        </div>
      </div>

      <!-- Matrix Table -->
      <div class="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80 p-3">
        <table class="w-full text-center text-xs">
          <thead>
            <tr class="text-slate-400 border-b border-slate-800">
              <th class="p-2 font-semibold">Home \ Away</th>
              {#each [0, 1, 2, 3, 4] as awayScore}
                <th class="p-2 font-mono font-bold text-indigo-400">{awayScore}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each matrix as row, i}
              <tr class="border-b border-slate-900/60 hover:bg-slate-800/30">
                <td class="p-2 font-mono font-bold text-emerald-400 border-r border-slate-800">{i}</td>
                {#each row as prob, j}
                  <td class="p-2 font-mono font-semibold transition-colors {prob > 0.08 ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-300'}">
                    {(prob * 100).toFixed(1)}%
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Footer Info -->
      <div class="mt-4 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-3">
        <span>Includes bivariate Poisson low-score adjustment ($\rho = -0.13$).</span>
        <button
          onclick={close}
          class="rounded-xl bg-emerald-500 px-4 py-2 font-bold text-slate-950 hover:brightness-110"
        >
          Done
        </button>
      </div>
    </div>
  </div>
{/if}
