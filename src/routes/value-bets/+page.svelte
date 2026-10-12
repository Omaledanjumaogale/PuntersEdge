<script lang="ts">
	import { app } from '#lib/state.svelte.ts';
	import PickTicket from '#lib/components/PickTicket.svelte';

	let minEdge = $state(0);
	let sport = $state<'all' | 'football' | 'basketball'>('all');
	let sort = $state<'edge' | 'stake' | 'prob'>('edge');

	const list = $derived(
		app.valueBets
			.filter((v) => v.edgePercent >= minEdge && (sport === 'all' || v.sport === sport))
			.sort((a, b) =>
				sort === 'edge' ? b.edgePercent - a.edgePercent : sort === 'stake' ? b.kellyStakePercent - a.kellyStakePercent : b.modelProb - a.modelProb
			)
	);
	const totalStakePct = $derived(list.reduce((a, v) => a + v.kellyStakePercent, 0));
</script>

<svelte:head><title>Value bets — QuantEdge</title></svelte:head>

<header class="max-w-2xl">
	<h1 class="text-4xl font-extrabold text-chalk">🔥 Value bets</h1>
	<p class="mt-2 text-haze">
		Every selection where the best available price beats the fair price. Stakes are {Math.round(app.settings.kellyFraction * 100)}% Kelly on a
		bankroll you set in Settings.
	</p>
</header>

<div class="mt-6 flex flex-wrap items-end gap-4 text-sm">
	<label class="flex flex-col gap-1">
		<span class="text-haze">Sport</span>
		<select bind:value={sport} class="rounded-xl bg-deep px-3 py-2 ring-1 ring-line">
			<option value="all">All</option><option value="football">Football</option><option value="basketball">Basketball</option>
		</select>
	</label>
	<label class="flex flex-col gap-1">
		<span class="text-haze">Minimum edge: {minEdge}%</span>
		<input type="range" min="0" max="10" step="0.5" bind:value={minEdge} class="w-44 accent-[var(--color-model)]" />
	</label>
	<label class="flex flex-col gap-1">
		<span class="text-haze">Sort by</span>
		<select bind:value={sort} class="rounded-xl bg-deep px-3 py-2 ring-1 ring-line">
			<option value="edge">Edge</option><option value="stake">Stake size</option><option value="prob">Win chance</option>
		</select>
	</label>
	<p class="ml-auto text-haze">
		{list.length} picks, {totalStakePct.toFixed(1)}% of bankroll if you take them all
	</p>
</div>

<div class="mt-5 grid gap-3 md:grid-cols-2">
	{#each list as pick (pick.id)}
		<PickTicket {pick} showMatch />
	{:else}
		<div class="surface p-8 text-center md:col-span-2">
			<p class="font-semibold">Nothing clears a {minEdge}% edge</p>
			<button onclick={() => (minEdge = 0)} class="mt-3 rounded-full bg-raised px-4 py-2 text-sm ring-1 ring-line">Show all value bets</button>
		</div>
	{/each}
</div>
