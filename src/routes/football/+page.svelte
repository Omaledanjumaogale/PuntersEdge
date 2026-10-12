<script lang="ts">
	import { app } from '#lib/state.svelte.ts';
	import FixtureCard from '#lib/components/FixtureCard.svelte';

	const edges = $derived(app.football.filter((p) => p.bestValue && p.bestValue.edgePercent > 0).length);
</script>

<svelte:head><title>Football — QuantEdge</title></svelte:head>

<header class="max-w-2xl">
	<h1 class="text-4xl font-bold">Football</h1>
	<p class="mt-2 text-haze">
		{app.football.length} matches priced with a Dixon–Coles model, adjusted for confirmed absences. {edges} have at least one price above fair value.
	</p>
</header>

<div class="mt-6 grid gap-4 md:grid-cols-2">
	{#each app.football as p (p.fixtureId)}
		<FixtureCard {p} />
	{/each}
</div>
