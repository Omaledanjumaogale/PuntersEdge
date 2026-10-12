<script lang="ts">
	import { app } from '#lib/state.svelte.ts';
	import FixtureCard from '#lib/components/FixtureCard.svelte';

	const edges = $derived(app.basketball.filter((p) => p.bestValue && p.bestValue.edgePercent > 0).length);
</script>

<svelte:head><title>Basketball — QuantEdge</title></svelte:head>

<header class="max-w-2xl">
	<h1 class="text-4xl font-extrabold text-chalk">🏀 Basketball</h1>
	<p class="mt-2 text-haze">
		{app.basketball.length} games projected from pace and per-possession efficiency, priced for every line the books hang. {edges} show value.
	</p>
</header>

<div class="mt-6 grid gap-4 md:grid-cols-2">
	{#each app.basketball as p (p.fixtureId)}
		<FixtureCard {p} />
	{/each}
</div>
