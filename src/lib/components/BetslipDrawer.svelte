<script lang="ts">
  import { betslipItems, betslipOpen, userStake } from "$lib/stores";
  import { 
    X, 
    Trash2, 
    ReceiptText, 
    ShieldCheck, 
    AlertTriangle, 
    CheckCircle2, 
    ArrowRight 
  } from "lucide-svelte";

  let items = $derived($betslipItems);
  let totalOdds = $derived(
    items.length > 0 ? items.reduce((acc, i) => acc * i.odds, 1) : 1
  );
  let potentialReturn = $derived(
    Math.round($userStake * totalOdds * 100) / 100
  );

  // Accumulator safety indicator:
  // 1 leg: 100% safe (3.5% bookmaker vig)
  // 2 legs: 82% safe (7% vig)
  // 3 legs: 65% safe (11% vig)
  // 4 legs: 45% safe (18% vig)
  // 5+ legs: 25% safe (>25% compounding vig)
  let safetyScore = $derived.by(() => {
    if (items.length <= 1) return 100;
    return Math.max(15, Math.round(100 - (items.length - 1) * 20));
  });

  let betType = $state<"single" | "accumulator">("accumulator");
  let orderPlaced = $state(false);

  function removeItem(id: string) {
    betslipItems.update((list) => list.filter((i) => i.fixtureId !== id));
  }

  function clearSlip() {
    betslipItems.set([]);
  }

  function close() {
    betslipOpen.set(false);
  }

  function placeBet() {
    orderPlaced = true;
    setTimeout(() => {
      orderPlaced = false;
      betslipItems.set([]);
      betslipOpen.set(false);
    }, 2200);
  }
</script>

{#if $betslipOpen}
  <!-- Backdrop -->
  <div class="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm">
    <!-- Slide-in Drawer -->
    <div class="h-full w-full max-w-md border-l border-slate-800 bg-slate-900 p-6 shadow-2xl flex flex-col justify-between overflow-y-auto">
      <div>
        <!-- Drawer Header -->
        <div class="flex items-center justify-between border-b border-slate-800 pb-4">
          <div class="flex items-center gap-2.5">
            <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ReceiptText class="h-5 w-5" />
            </div>
            <div>
              <h3 class="text-sm font-bold text-white">Smart Betslip</h3>
              <p class="text-xs text-slate-400">{items.length} {items.length === 1 ? 'Selection' : 'Selections'}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            {#if items.length > 0}
              <button
                onclick={clearSlip}
                class="rounded-lg p-2 text-slate-400 hover:text-rose-400 transition-colors"
                title="Clear all selections"
              >
                <Trash2 class="h-4 w-4" />
              </button>
            {/if}
            <button
              onclick={close}
              class="rounded-xl border border-slate-800 p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X class="h-4 w-4" />
            </button>
          </div>
        </div>

        <!-- Selections List -->
        <div class="my-4 space-y-3">
          {#if items.length === 0}
            <div class="py-16 text-center text-slate-500">
              <ReceiptText class="mx-auto h-12 w-12 stroke-[1.5] text-slate-600 mb-3" />
              <p class="text-sm font-medium">Your Betslip is Empty</p>
              <p class="mt-1 text-xs text-slate-600">Select any value bet from the dashboard to add.</p>
            </div>
          {:else}
            {#each items as item}
              <div class="group relative rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs transition-colors hover:border-slate-700">
                <button
                  onclick={() => removeItem(item.fixtureId)}
                  class="absolute right-2.5 top-2.5 text-slate-500 hover:text-rose-400"
                >
                  <X class="h-3.5 w-3.5" />
                </button>
                <div class="font-bold text-white pr-6">{item.matchTitle}</div>
                <div class="mt-1 text-slate-400">{item.market}</div>
                <div class="mt-2 flex items-center justify-between border-t border-slate-800/80 pt-2 font-mono">
                  <span class="font-bold text-emerald-400">{item.selection}</span>
                  <div class="flex items-center gap-2">
                    <span class="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{item.bookmaker}</span>
                    <span class="rounded-md bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300">
                      {item.odds.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <!-- Financial calculations & Submit -->
      {#if items.length > 0}
        <div class="border-t border-slate-800 pt-4 space-y-3 text-xs">
          <!-- Accumulator Safety Warning -->
          {#if items.length > 1}
            <div class="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
              <div class="flex items-center justify-between font-bold text-amber-400 mb-1">
                <span class="flex items-center gap-1.5">
                  <ShieldCheck class="h-4 w-4" />
                  <span>Accumulator Safety Score</span>
                </span>
                <span class="font-mono text-sm">{safetyScore}%</span>
              </div>
              <p class="text-[11px] text-slate-300">
                {items.length} legs selected. Note: Bookmaker margins compound multiplicatively on multi-bets.
              </p>
            </div>
          {/if}

          <!-- Stake Input -->
          <div>
            <div class="flex justify-between font-bold text-slate-300 mb-1.5">
              <span>Your Stake Amount</span>
              <span class="font-mono text-emerald-400">₦{$userStake.toLocaleString()}</span>
            </div>
            <div class="grid grid-cols-4 gap-1.5 mb-2">
              {#each [500, 1000, 5000, 10000] as preset}
                <button
                  onclick={() => userStake.set(preset)}
                  class="rounded-lg border border-slate-800 bg-slate-950 py-1.5 font-mono text-[11px] font-bold text-slate-300 hover:border-emerald-500 hover:text-emerald-400"
                >
                  ₦{preset.toLocaleString()}
                </button>
              {/each}
            </div>
          </div>

          <!-- Total Odds & Potential Payout -->
          <div class="rounded-xl bg-slate-950/80 p-3 border border-slate-800 space-y-1.5 font-mono">
            <div class="flex justify-between text-slate-400">
              <span>Total Multiplier Odds:</span>
              <span class="font-bold text-white">{totalOdds.toFixed(2)}</span>
            </div>
            <div class="flex justify-between text-base font-bold text-emerald-400 border-t border-slate-800 pt-1.5">
              <span>Potential Return:</span>
              <span>₦{potentialReturn.toLocaleString()}</span>
            </div>
          </div>

          <!-- Confirm button -->
          <button
            onclick={placeBet}
            disabled={orderPlaced}
            class="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
          >
            {#if orderPlaced}
              <CheckCircle2 class="h-5 w-5" />
              <span>Bet Saved to Portfolio!</span>
            {:else}
              <span>Place {items.length > 1 ? 'Accumulator' : 'Single'} Bet</span>
              <ArrowRight class="h-4 w-4" />
            {/if}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
