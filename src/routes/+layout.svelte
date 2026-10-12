<script lang="ts">
  import './layout.css';
  import Navbar from '#lib/components/Navbar.svelte';
  import BetslipDrawer from '#lib/components/BetslipDrawer.svelte';
  import AiReasoningDrawer from '#lib/components/AiReasoningDrawer.svelte';
  import ScoreMatrixModal from '#lib/components/ScoreMatrixModal.svelte';
  import PaceSimulationModal from '#lib/components/PaceSimulationModal.svelte';
  import { betslipItems, betslipOpen, isDarkMode } from '#lib/stores.ts';
  import { 
    LayoutDashboard, 
    Flame, 
    ShieldCheck, 
    ReceiptText, 
    BarChart3 
  } from 'lucide-svelte';

  let { children } = $props();
  let count = $derived($betslipItems.length);
</script>

<div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans transition-colors">
  <!-- Top Navigation -->
  <Navbar />

  <!-- Main Content Container -->
  <main class="flex-1 pb-20 md:pb-8">
    {@render children()}
  </main>

  <!-- Modals & Drawers -->
  <BetslipDrawer />
  <AiReasoningDrawer />
  <ScoreMatrixModal />
  <PaceSimulationModal />

  <!-- Mobile Bottom Navigation (Responsive Bar) -->
  <nav class="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur-md px-2 py-1.5 flex items-center justify-around text-[10px] font-semibold text-slate-400">
    <a href="/" class="flex flex-col items-center py-1 px-2 hover:text-emerald-400 transition-colors">
      <LayoutDashboard class="h-4 w-4 mb-0.5" />
      <span>Overview</span>
    </a>
    <a href="/football" class="flex flex-col items-center py-1 px-2 hover:text-emerald-400 transition-colors">
      <BarChart3 class="h-4 w-4 mb-0.5 text-emerald-400" />
      <span>Football</span>
    </a>
    <a href="/basketball" class="flex flex-col items-center py-1 px-2 hover:text-indigo-400 transition-colors">
      <BarChart3 class="h-4 w-4 mb-0.5 text-indigo-400" />
      <span>Basketball</span>
    </a>
    <a href="/value-bets" class="flex flex-col items-center py-1 px-2 hover:text-emerald-400 transition-colors">
      <Flame class="h-4 w-4 mb-0.5 text-amber-400" />
      <span>Value Bets</span>
    </a>
    <button
      onclick={() => betslipOpen.update((v) => !v)}
      class="relative flex flex-col items-center py-1 px-2 text-emerald-400 hover:text-emerald-300"
    >
      <ReceiptText class="h-4 w-4 mb-0.5" />
      <span>Betslip</span>
      {#if count > 0}
        <span class="absolute top-0 right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-black text-slate-950">
          {count}
        </span>
      {/if}
    </button>
  </nav>
</div>
