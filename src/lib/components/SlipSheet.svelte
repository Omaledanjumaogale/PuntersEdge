<script lang="ts">
	import { app } from '#lib/state.svelte.ts';
	import { auth } from '#lib/auth.svelte.ts';
	import { odds, pct, ngn, signed } from '#lib/format.ts';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { X, Trash2, Copy, Check } from 'lucide-svelte';

	let mode = $state<'singles' | 'acca'>('acca');
	let stake = $state(1000);
	let copied = $state(false);

	const items = $derived(app.slip);
	const econ = $derived(app.slipEconomics);
	const isAcca = $derived(mode === 'acca' && items.length > 1);

	const singlesEv = $derived(items.reduce((acc, i) => acc + stake * (i.modelProb * i.odds - 1), 0));
	const accaReturn = $derived(stake * econ.combinedOdds);
	const expected = $derived(isAcca ? stake * (econ.evPercent / 100) : singlesEv);

	function close() {
		app.slipOpen = false;
	}

	async function copySlip() {
		const lines = items.map((i) => `${i.matchTitle}: ${i.selection} @ ${odds(i.odds)} (${i.bookmaker})`);
		const head = isAcca ? `Accumulator, ${items.length} legs @ ${odds(econ.combinedOdds)}` : `${items.length} single${items.length > 1 ? 's' : ''}`;
		try {
			await navigator.clipboard.writeText(`${head}\n${lines.join('\n')}\nStake ${ngn(stake)}${isAcca ? '' : ' each'}`);
			copied = true;
			setTimeout(() => (copied = false), 1800);
		} catch {
			/* clipboard blocked */
		}
	}

	function onkey(e: KeyboardEvent) {
		if (e.key === 'Escape' && app.slipOpen) close();
	}
</script>

<svelte:window onkeydown={onkey} />

{#if app.slipOpen}
	<div class="fixed inset-0 z-50 bg-ink/70 backdrop-blur-sm" transition:fade={{ duration: 180 }} onclick={close} aria-hidden="true"></div>
	<div
		role="dialog"
		aria-modal="true"
		aria-labelledby="slip-title"
		transition:fly={{ y: 40, duration: 320, easing: cubicOut }}
		class="safe-bottom fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-[1.75rem] border-t border-line bg-deep md:inset-y-4 md:left-auto md:right-4 md:w-[26rem] md:max-h-none md:rounded-[1.75rem] md:border"
	>
		<div class="mx-auto mt-2 h-1 w-10 rounded-full bg-line md:hidden"></div>
		<header class="flex items-center gap-2 px-5 pb-3 pt-3">
			<h2 id="slip-title" class="text-xl font-bold text-chalk">🧾 Betslip</h2>
			<span class="text-sm text-haze">{items.length} selection{items.length === 1 ? '' : 's'}</span>
			<div class="ml-auto flex gap-1">
				{#if items.length}
					<button onclick={() => app.clearSlip()} class="rounded-full p-2 text-haze hover:text-loss" aria-label="Clear slip"><Trash2 class="h-4 w-4" /></button>
				{/if}
				<button onclick={close} class="rounded-full p-2 text-haze hover:text-chalk" aria-label="Close slip"><X class="h-5 w-5" /></button>
			</div>
		</header>

		<div class="flex-1 space-y-2 overflow-y-auto px-5">
			{#each items as i (i.id)}
				<div class="ticket flex items-center gap-3 px-4 py-3" transition:fly={{ x: 24, duration: 200 }}>
					<div class="min-w-0 flex-1">
						<p class="truncate text-xs text-haze">{i.matchTitle}</p>
						<p class="truncate font-semibold text-chalk">{i.selection}</p>
						<p class="text-xs text-haze">{i.bookmaker}, model {pct(i.modelProb, 1)}</p>
					</div>
					<span class="font-display text-lg font-semibold text-book">{odds(i.odds)}</span>
					<button onclick={() => app.remove(i.id)} class="rounded-full p-1.5 text-haze hover:text-loss" aria-label="Remove {i.selection}"><X class="h-4 w-4" /></button>
				</div>
			{:else}
				<div class="py-8 text-center">
					<svg viewBox="0 0 160 110" class="mx-auto h-28 w-auto" aria-hidden="true">
						<g transform="rotate(-8 80 55)">
							<rect x="30" y="18" width="100" height="74" rx="12" style="fill: var(--color-raised); stroke: var(--color-line); stroke-width: 2" />
							<circle cx="30" cy="55" r="8" style="fill: var(--color-deep)" />
							<circle cx="130" cy="55" r="8" style="fill: var(--color-deep)" />
							<line x1="96" y1="26" x2="96" y2="84" style="stroke: var(--color-line); stroke-width: 2; stroke-dasharray: 4 4" />
							<rect x="42" y="34" width="44" height="8" rx="4" style="fill: var(--color-pop); opacity: 0.8" />
							<rect x="42" y="50" width="30" height="6" rx="3" style="fill: var(--color-haze); opacity: 0.6" />
							<rect x="42" y="64" width="38" height="6" rx="3" style="fill: var(--color-book); opacity: 0.8" />
							<text x="113" y="62" text-anchor="middle" font-size="22" style="fill: var(--color-model)">+</text>
						</g>
					</svg>
					<p class="mt-2 text-lg font-bold text-chalk">Your slip is empty</p>
					<p class="mt-1 text-sm text-haze">Tap + on any ticket to add a pick.</p>
					<a href="/value-bets" onclick={close} class="btn-primary mt-4 text-sm">🔥 Browse value bets</a>
				</div>
			{/each}
		</div>

		{#if items.length}
			<footer class="space-y-3 border-t border-line px-5 pb-3 pt-4">
				{#if items.length > 1}
					<div class="grid grid-cols-2 gap-1 rounded-full bg-ink p-1 text-sm" role="tablist">
						{#each [['acca', 'Accumulator'], ['singles', 'Singles']] as [m, label]}
							<button role="tab" aria-selected={mode === m} onclick={() => (mode = m as typeof mode)} class="rounded-full py-1.5 {mode === m ? 'bg-raised text-chalk' : 'text-haze'}">{label}</button>
						{/each}
					</div>
				{/if}

				<label class="block">
					<span class="text-sm text-haze">Stake {isAcca ? '' : 'per selection'}</span>
					<div class="mt-1 flex items-center gap-2 rounded-xl bg-ink px-3 ring-1 ring-line focus-within:ring-model">
						<span class="text-haze">₦</span>
						<input type="number" inputmode="numeric" min="0" step="100" bind:value={stake} class="w-full bg-transparent py-2.5 text-lg outline-none" />
					</div>
				</label>

				<dl class="grid grid-cols-2 gap-y-1.5 text-sm">
					{#if isAcca}
						<dt class="text-haze">Combined odds</dt><dd class="text-right text-book">{odds(econ.combinedOdds)}</dd>
						<dt class="text-haze">Model win chance</dt><dd class="text-right">{pct(econ.combinedProb, 1)}</dd>
						<dt class="text-haze">Return if it lands</dt><dd class="text-right">{ngn(accaReturn)}</dd>
					{:else}
						<dt class="text-haze">Total staked</dt><dd class="text-right">{ngn(stake * items.length)}</dd>
					{/if}
					<dt class="text-haze">Expected profit</dt>
					<dd class="text-right font-semibold {expected >= 0 ? 'text-model' : 'text-loss'}">{expected >= 0 ? '+' : '−'}{ngn(Math.abs(expected))}</dd>
				</dl>

				{#if isAcca && econ.evPercent < 0}
					<p class="rounded-xl bg-loss/10 px-3 py-2 text-xs text-loss">This combination has negative expected value ({signed(econ.evPercent)}%). Singles keep each edge intact.</p>
				{/if}

				<button onclick={copySlip} class="flex w-full items-center justify-center gap-2 rounded-full bg-chalk py-3 font-semibold text-ink hover:bg-white">
					{#if copied}<Check class="h-4 w-4" /> Copied{:else}<Copy class="h-4 w-4" /> Copy slip for your bookmaker{/if}
				</button>
				<p class="text-center text-xs text-haze">
					{#if auth.signedIn && auth.mode === 'convex'}☁️ Synced to your account. {:else if !auth.signedIn}<a href="/login" onclick={close} class="font-semibold text-pop underline">Log in</a> to sync this slip. {/if}QuantEdge doesn't place bets. 18+, bet within your means.
				</p>
			</footer>
		{/if}
	</div>
{/if}
