<script lang="ts">
  import { activeSport, betslipItems, betslipOpen, isDarkMode } from "$lib/stores";
  import { 
    Activity, 
    Flame, 
    BarChart3, 
    Layers, 
    ShieldCheck, 
    ReceiptText, 
    Download, 
    Sun, 
    Moon, 
    User,
    Sparkles
  } from "lucide-svelte";

  let itemsCount = $derived($betslipItems.length);
  let canInstallPwa = $state(false);

  // Check if beforeinstallprompt was captured
  if (typeof window !== "undefined") {
    window.addEventListener("beforeinstallprompt", () => {
      canInstallPwa = true;
    });
  }

  function handleInstallClick() {
    if (typeof window !== "undefined" && (window as any).deferredInstallPrompt) {
      (window as any).deferredInstallPrompt.prompt();
    }
  }

  function toggleTheme() {
    isDarkMode.update((d) => !d);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark");
    }
  }
</script>

<header class="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur-md transition-colors">
  <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
    <!-- Brand / Logo -->
    <div class="flex items-center gap-6">
      <a href="/" class="flex items-center gap-2.5 transition-transform hover:scale-105">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/20">
          <Activity class="h-6 w-6 stroke-[2.5]" />
        </div>
        <div class="flex flex-col">
          <div class="flex items-center gap-1.5">
            <span class="text-xl font-extrabold tracking-tight text-white">Quant<span class="text-emerald-400">Edge</span></span>
            <span class="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">PRO</span>
          </div>
          <span class="text-[10px] font-medium tracking-wide text-slate-400 uppercase">Sports Predictive Intelligence</span>
        </div>
      </a>

      <!-- Desktop Nav links -->
      <nav class="hidden md:flex items-center gap-1 text-sm font-semibold">
        <a href="/" class="rounded-lg px-3 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors">
          Overview
        </a>
        <a href="/football" class="rounded-lg px-3 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors flex items-center gap-1.5">
          <span>Football Matches</span>
        </a>
        <a href="/basketball" class="rounded-lg px-3 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors flex items-center gap-1.5">
          <span>Basketball Fixtures</span>
        </a>
        <a href="/bookmakers" class="rounded-lg px-3 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors">
          Bookmaker Audit
        </a>
        <a href="/value-bets" class="rounded-lg px-3 py-1.5 text-emerald-400 hover:bg-emerald-500/10 transition-colors flex items-center gap-1">
          <Flame class="h-4 w-4 text-emerald-400" />
          <span>Value Bets</span>
        </a>
      </nav>
    </div>

    <!-- Right utility controls -->
    <div class="flex items-center gap-3">
      <!-- PWA Install Button -->
      {#if canInstallPwa}
        <button
          onclick={handleInstallClick}
          class="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-all hover:bg-emerald-500/20 shadow-sm"
          title="Install Web App on your device"
        >
          <Download class="h-3.5 w-3.5" />
          <span>Install App</span>
        </button>
      {/if}

      <!-- Theme Switcher -->
      <button
        onclick={toggleTheme}
        class="rounded-lg border border-slate-800 p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        title="Toggle Theme"
        aria-label="Toggle Theme"
      >
        {#if $isDarkMode}
          <Sun class="h-4 w-4 text-amber-400" />
        {:else}
          <Moon class="h-4 w-4 text-indigo-400" />
        {/if}
      </button>

      <!-- Betslip Drawer Button -->
      <button
        onclick={() => betslipOpen.update((v) => !v)}
        class="relative flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-md shadow-emerald-500/20 transition-all hover:brightness-110 active:scale-95"
      >
        <ReceiptText class="h-4 w-4 stroke-[2.5]" />
        <span class="hidden sm:inline">Betslip</span>
        {#if itemsCount > 0}
          <span class="flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 text-[11px] font-black text-emerald-400">
            {itemsCount}
          </span>
        {/if}
      </button>

      <!-- Account / Auth button -->
      <a
        href="/auth"
        class="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 transition-colors hover:border-slate-700 hover:text-white"
        title="Account & Risk Settings"
      >
        <User class="h-4 w-4" />
      </a>
    </div>
  </div>
</header>
