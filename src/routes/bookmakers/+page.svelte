<script lang="ts">
  import { ShieldAlert, TrendingDown, Layers, CheckCircle2, AlertTriangle } from "lucide-svelte";
  import { compareBookmakerOdds } from "#lib/engine/bookmaker_engine.js";

  // Real bookmaker sample odds for comparison
  const sampleBooks = [
    {
      name: "1xBet (NG)",
      engine: "BetB2B Global",
      home: 2.02,
      draw: 3.75,
      away: 4.10,
      margin: 2.76,
      rating: "Tier 1 (Lowest Juice)",
    },
    {
      name: "22Bet (NG)",
      engine: "BetB2B Regional",
      home: 2.01,
      draw: 3.72,
      away: 4.08,
      margin: 3.12,
      rating: "Tier 1 (Competitive)",
    },
    {
      name: "SportyBet (NG)",
      engine: "Sportradar MTS",
      home: 1.95,
      draw: 3.65,
      away: 3.90,
      margin: 6.84,
      rating: "Tier 3 (High Margin)",
    },
  ];

  // Accumulator margin decay simulation table
  const decayTable = [
    { legs: 1, baseVig: "3.5%", totalVig: "3.5%", expectedLoss: "₦35 per ₦1k", safety: "Optimal" },
    { legs: 2, baseVig: "3.5%", totalVig: "6.9%", expectedLoss: "₦69 per ₦1k", safety: "High" },
    { legs: 3, baseVig: "3.5%", totalVig: "10.2%", expectedLoss: "₦102 per ₦1k", safety: "Acceptable" },
    { legs: 4, baseVig: "3.5%", totalVig: "13.4%", expectedLoss: "₦134 per ₦1k", safety: "Moderate Caution" },
    { legs: 5, baseVig: "3.5%", totalVig: "16.5%", expectedLoss: "₦165 per ₦1k", safety: "High Risk" },
    { legs: 8, baseVig: "3.5%", totalVig: "25.2%", expectedLoss: "₦252 per ₦1k", safety: "Severe Risk" },
    { legs: 12, baseVig: "3.5%", totalVig: "35.8%", expectedLoss: "₦358 per ₦1k", safety: "Dangerous (Bookie Trap)" },
  ];
</script>

<svelte:head>
  <title>Bookmaker Audit | Margin Comparison & Accumulator Safety</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
  <!-- Header -->
  <div class="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8">
    <div class="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-400 border border-indigo-500/20 mb-2">
      <Layers class="h-3.5 w-3.5" />
      <span>Institutional Bookmaker Economics</span>
    </div>
    <h1 class="text-2xl sm:text-3xl font-extrabold text-white">Bookmaker Margin Audit & Arbitrage Scanner</h1>
    <p class="mt-1 text-xs sm:text-sm text-slate-300">
      Real-time vigorish analysis across SportyBet, 1xBet, and 22Bet to safeguard punter capital against compounding accumulator traps.
    </p>
  </div>

  <!-- Bookmaker Margin Comparison Cards -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    {#each sampleBooks as book}
      <div class="rounded-2xl border {book.margin < 3.5 ? 'border-emerald-500/40 bg-emerald-950/10' : 'border-slate-800 bg-slate-900'} p-5 shadow-lg">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 class="font-bold text-white text-base">{book.name}</h3>
            <span class="text-[11px] text-slate-400">{book.engine}</span>
          </div>
          <span class="rounded-md px-2 py-0.5 text-xs font-mono font-bold {book.margin < 3.5 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}">
            {book.margin}% Vig
          </span>
        </div>

        <div class="my-4 space-y-2 text-xs">
          <div class="flex justify-between text-slate-300 font-mono">
            <span>Arsenal Win:</span>
            <span class="font-bold text-white">{book.home}</span>
          </div>
          <div class="flex justify-between text-slate-300 font-mono">
            <span>Draw:</span>
            <span class="font-bold text-white">{book.draw}</span>
          </div>
          <div class="flex justify-between text-slate-300 font-mono">
            <span>Chelsea Win:</span>
            <span class="font-bold text-white">{book.away}</span>
          </div>
        </div>

        <div class="pt-3 border-t border-slate-800/80 text-xs">
          <span class="font-semibold text-slate-400">Classification:</span>
          <span class="ml-1 font-bold {book.margin < 3.5 ? 'text-emerald-400' : 'text-amber-400'}">{book.rating}</span>
        </div>
      </div>
    {/each}
  </div>

  <!-- Accumulator Economics Breakdown -->
  <div class="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 space-y-4">
    <div class="flex items-center gap-2">
      <AlertTriangle class="h-5 w-5 text-amber-400" />
      <h2 class="text-xl font-bold text-white">The Multi-Bet / Accumulator Compound Decay Formula</h2>
    </div>
    <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">
      Most punters lose money because each match added to an accumulator multiplies the bookmaker's edge against them: 
      <code class="rounded bg-slate-950 px-2 py-0.5 font-mono text-emerald-400">Total Margin = 1 - (1 - Margin)^N</code>. 
      Below is the real compounding impact per selection:
    </p>

    <!-- Table -->
    <div class="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/80">
      <table class="w-full text-left text-xs">
        <thead class="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/50">
          <tr>
            <th class="p-3">Accumulator Legs</th>
            <th class="p-3">Per-Match Margin</th>
            <th class="p-3">Compound Margin Taken</th>
            <th class="p-3">Expected Math Loss</th>
            <th class="p-3">Punter Safety Rating</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/50 font-mono">
          {#each decayTable as row}
            <tr class="hover:bg-slate-800/30">
              <td class="p-3 font-bold text-white">{row.legs} {row.legs === 1 ? 'Leg (Single)' : 'Legs'}</td>
              <td class="p-3 text-slate-300">{row.baseVig}</td>
              <td class="p-3 font-bold {parseFloat(row.totalVig) > 15 ? 'text-rose-400' : 'text-emerald-400'}">{row.totalVig}</td>
              <td class="p-3 text-slate-300">{row.expectedLoss}</td>
              <td class="p-3">
                <span class="rounded px-2 py-0.5 text-[11px] font-sans font-bold {row.safety.includes('Dangerous') ? 'bg-rose-500/20 text-rose-300' : row.safety.includes('Caution') ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}">
                  {row.safety}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
