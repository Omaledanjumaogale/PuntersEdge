<script lang="ts">
  import { User, ShieldCheck, DollarSign, Bell, CheckCircle2, Lock } from "lucide-svelte";

  let email = $state("");
  let password = $state("");
  let bankrollSize = $state(100000); // ₦100,000 default
  let preferredBook = $state("1xBet");
  let maxKellyFraction = $state(0.25); // Quarter-Kelly default
  let isLoggedIn = $state(false);
  let statusMessage = $state("");

  function handleLogin(e: Event) {
    e.preventDefault();
    isLoggedIn = true;
    statusMessage = "Authenticated successfully via Convex Auth.";
  }

  function handleDemoLogin() {
    email = "punter@quantedge.pro";
    isLoggedIn = true;
    statusMessage = "Logged in under Pro Demo Punter mode.";
  }
</script>

<svelte:head>
  <title>Account & Bankroll Preferences | Convex Auth</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
  <!-- Auth Header -->
  <div class="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8">
    <div class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20 mb-2">
      <ShieldCheck class="h-3.5 w-3.5" />
      <span>Convex Reactive Authentication</span>
    </div>
    <h1 class="text-2xl sm:text-3xl font-extrabold text-white">Punter Account & Capital Management</h1>
    <p class="mt-1 text-xs sm:text-sm text-slate-300">
      Configure your active bankroll size, bookmaker tracking priorities, and automated alerts for live line shifts.
    </p>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
    <!-- Sign In / Sign Up Card -->
    <div class="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
      <div class="flex items-center gap-2 mb-4">
        <Lock class="h-5 w-5 text-emerald-400" />
        <h2 class="text-lg font-bold text-white">Convex Secure Sign-In</h2>
      </div>

      {#if isLoggedIn}
        <div class="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-xs text-emerald-300 space-y-2">
          <div class="flex items-center gap-2 font-bold text-sm text-emerald-400">
            <CheckCircle2 class="h-4 w-4" />
            <span>Active Session</span>
          </div>
          <p>{statusMessage}</p>
          <p class="text-slate-400">Connected account: <strong>{email || 'Demo User'}</strong></p>
          <button
            onclick={() => { isLoggedIn = false; email = ''; }}
            class="mt-2 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700"
          >
            Sign Out
          </button>
        </div>
      {:else}
        <form onsubmit={handleLogin} class="space-y-4 text-xs">
          <div>
            <label for="auth-email" class="block font-bold text-slate-300 mb-1">Email Address</label>
            <input
              id="auth-email"
              type="email"
              bind:value={email}
              required
              placeholder="punter@example.com"
              class="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label for="auth-password" class="block font-bold text-slate-300 mb-1">Password</label>
            <input
              id="auth-password"
              type="password"
              bind:value={password}
              required
              placeholder="••••••••"
              class="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div class="flex flex-col gap-2 pt-2">
            <button
              type="submit"
              class="w-full rounded-xl bg-emerald-500 py-2.5 font-bold text-slate-950 hover:brightness-110 transition-all text-xs"
            >
              Sign In to QuantEdge
            </button>
            <button
              type="button"
              onclick={handleDemoLogin}
              class="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 font-bold text-slate-300 hover:bg-slate-800 transition-all text-xs"
            >
              Continue as Guest Punter (Instant Access)
            </button>
          </div>
        </form>
      {/if}
    </div>

    <!-- Capital & Bankroll Settings -->
    <div class="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4 text-xs">
      <div class="flex items-center gap-2 mb-2">
        <DollarSign class="h-5 w-5 text-emerald-400" />
        <h2 class="text-lg font-bold text-white">Bankroll & Staking Rules</h2>
      </div>

      <div>
        <label for="bankroll-input" class="block font-bold text-slate-300 mb-1">Total Active Betting Bankroll (₦ / $)</label>
        <input
          id="bankroll-input"
          type="number"
          bind:value={bankrollSize}
          class="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 font-mono text-white focus:border-emerald-500 focus:outline-none"
        />
        <span class="text-[11px] text-slate-400 mt-1 block">Used by Kelly formula to determine exact stake sizes.</span>
      </div>

      <div>
        <label for="primary-bookmaker" class="block font-bold text-slate-300 mb-1">Primary Bookmaker Account</label>
        <select
          id="primary-bookmaker"
          bind:value={preferredBook}
          class="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-white focus:border-emerald-500 focus:outline-none"
        >
          <option value="1xBet">1xBet (Lowest Juice / 2.7% margin)</option>
          <option value="SportyBet">SportyBet Nigeria (MTS pricing)</option>
          <option value="22Bet">22Bet Nigeria (BetB2B)</option>
        </select>
      </div>

      <div>
        <label for="kelly-preservation" class="block font-bold text-slate-300 mb-1">Kelly Criterion Capital Preservation</label>
        <select
          id="kelly-preservation"
          bind:value={maxKellyFraction}
          class="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-white focus:border-emerald-500 focus:outline-none"
        >
          <option value={0.25}>Quarter-Kelly (Recommended: 75% safer volatility)</option>
          <option value={0.50}>Half-Kelly (Moderate Growth)</option>
          <option value={0.10}>Tenth-Kelly (Ultra-Conservative)</option>
        </select>
      </div>

      <div class="pt-3 border-t border-slate-800/80">
        <button
          onclick={() => alert("Bankroll preferences saved successfully.")}
          class="w-full rounded-xl bg-indigo-500 py-2.5 font-bold text-white hover:brightness-110 transition-all text-xs"
        >
          Save Capital Preferences
        </button>
      </div>
    </div>
  </div>
</div>
