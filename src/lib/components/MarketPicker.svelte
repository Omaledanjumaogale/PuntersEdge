<script lang="ts">
	/** Sheet with every market for one fixture; opens after adding a pick. */
	import { app } from '#lib/state.svelte.ts';
	import { sportEmoji } from '#lib/format.ts';
	import MarketList from './MarketList.svelte';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { X } from 'lucide-svelte';

	let valueOnly = $state(false);
	let panel = $state<HTMLElement>();

	const p = $derived(app.pickerFixture ? app.byId(app.pickerFixture) : undefined);
	const legsHere = $derived(p ? app.slip.filter((s) => s.fixtureId === p.fixtureId).length : 0);
	const valueCount = $derived(p ? p.markets.flatMap((g) => g.selections).filter((s) => (s as any).opportunity?.green).length : 0);

	function close() {
		app.pickerFixture = null;
		app.lastAdded = null;
	}
	function openSlip() {
		close();
		app.slipOpen = true;
	}

	// Each match opens on "All markets", focused for keyboard users.
	let lastFixture: string | null = null;
	$effect(() => {
		if (app.pickerFixture !== lastFixture) {
			lastFixture = app.pickerFixture;
			valueOnly = false;
		}
		if (p) queueMicrotask(() => panel?.focus());
	});
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && p && close()} />

{#if p}
	<div class="fixed inset-0 z-50 bg-ink/70 backdrop-blur-sm" transition:fade={{ duration: 160 }} onclick={close} aria-hidden="true"></div>
	<div
		bind:this={panel}
		tabindex="-1"
		role="dialog"
		aria-modal="true"
		aria-labelledby="picker-title"
		transition:fly={{ y: 48, duration: 320, easing: cubicOut }}
		class="safe-bottom fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-[1.75rem] border-t border-line bg-deep outline-none md:inset-y-4 md:left-auto md:right-4 md:w-[32rem] md:max-h-none md:rounded-[1.75rem] md:border"
	>
		<div class="mx-auto mt-2 h-1 w-10 rounded-full bg-line md:hidden"></div>
		<header class="flex items-start gap-3 px-5 pb-3 pt-3">
			<div class="min-w-0 flex-1">
				<p class="text-sm font-medium text-haze">{sportEmoji[p.sport]} {p.league}</p>
				<h2 id="picker-title" class="truncate text-xl font-bold text-chalk">{p.matchTitle}</h2>
			</div>
			<button onclick={close} class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-raised text-chalk ring-1 ring-line hover:ring-pop" aria-label="Close markets"><X class="h-5 w-5" /></button>
		</header>

		{#if app.lastAdded}
			<p class="mx-5 mb-3 rounded-xl tint-model px-3 py-2 text-sm font-medium text-chalk ring-1 ring-model/50" role="status">
				✅ {app.lastAdded} added. Here's everything else on this match.
			</p>
		{/if}

		<div class="mx-5 mb-3 grid grid-cols-2 gap-1 rounded-full bg-ink p-1 text-sm ring-1 ring-line" role="tablist" aria-label="Filter markets">
			<button role="tab" aria-selected={!valueOnly} onclick={() => (valueOnly = false)} class="rounded-full py-1.5 font-medium {!valueOnly ? 'bg-raised text-chalk ring-1 ring-pop' : 'text-haze'}">🎯 All markets</button>
			<button role="tab" aria-selected={valueOnly} onclick={() => (valueOnly = true)} class="rounded-full py-1.5 font-medium {valueOnly ? 'bg-raised text-chalk ring-1 ring-pop' : 'text-haze'}">🟢 Favourable estimates ({valueCount})</button>
		</div>

		<div class="flex-1 overflow-y-auto px-5 pb-4">
			<MarketList groups={p.markets.filter((g) => g.selections.length > 0)} {valueOnly} />
			<p class="mt-4 text-xs text-haze">
				Green means estimated favourable value at a current quoted price. Screening grades describe the estimate; a validated recommendation additionally requires evidence approval. Derived prices are theoretical.
				Confirm the price at the bookmaker before you bet.
			</p>
		</div>

		<footer class="flex items-center gap-2 border-t border-line px-5 pb-2 pt-3">
			{#if legsHere > 1}
				<p class="flex-1 text-xs text-haze">⚠️ {legsHere} picks from this match. Fine as singles; combined, they're linked.</p>
			{:else}
				<span class="flex-1"></span>
			{/if}
			<button onclick={close} class="btn-ghost text-sm">Keep browsing</button>
			<button onclick={openSlip} class="btn-primary text-sm">🧾 Slip ({app.slip.length})</button>
		</footer>
	</div>
{/if}
