<script lang="ts">
	import { app } from '#lib/state.svelte.ts';
	import { SPORTS, SPORT_ORDER } from '#lib/sports.ts';
	import { tilt } from '#lib/actions/tilt.ts';
	import DataBadge from '#lib/components/DataBadge.svelte';

	const stats = $derived(
		SPORT_ORDER.map((key) => {
			const preds = app.bySport(key);
			const live = app.games.filter((g) => g.sport === key && g.status.state === 'live').length;
			const upcoming = preds.filter((p) => p.status.state === 'scheduled');
			const value = upcoming.filter((p) => p.bestValue && p.bestValue.edgePercent > 0 && p.bestValue.grade !== 'PASS').length;
			const top = upcoming
				.filter((p) => p.bestValue && p.bestValue.edgePercent > 0)
				.sort((a, b) => (b.bestValue?.edgePercent ?? 0) - (a.bestValue?.edgePercent ?? 0))[0];
			return { s: SPORTS[key], upcoming: upcoming.length, value, live, top };
		})
	);
</script>

<svelte:head><title>Sports — PuntersEdge</title></svelte:head>

<header class="max-w-2xl">
	<div class="flex flex-wrap items-center gap-3">
		<h1 class="text-4xl font-extrabold text-chalk">🏟️ Sports</h1>
		<DataBadge />
	</div>
	<p class="mt-2 text-haze">Explore five score-based sports dashboards and the experimental tennis forecast workspace.</p>
</header>

<div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
	{#each stats as x (x.s.key)}
		<a
			href={x.s.href}
			use:tilt={{ max: 4, enabled: app.settings.motion }}
			class="surface group relative flex flex-col gap-3 overflow-hidden p-5 transition-shadow hover:shadow-[0_24px_60px_-28px_color-mix(in_oklab,var(--color-pop)_45%,transparent)]"
		>
			<span class="pointer-events-none absolute -right-6 -top-6 text-[7rem] leading-none opacity-15 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110" aria-hidden="true">{x.s.emoji}</span>
			<span class="text-4xl leading-none" aria-hidden="true">{x.s.emoji}</span>
			<span class="text-2xl font-bold text-chalk">{x.s.label}</span>
			<span class="text-sm text-haze">{x.s.engine}</span>
			<span class="mt-auto flex flex-wrap gap-2 text-xs font-semibold">
				<span class="rounded-full bg-raised px-2.5 py-1 text-chalk ring-1 ring-line">📅 {x.upcoming} upcoming</span>
				{#if x.value}<span class="rounded-full tint-model px-2.5 py-1 text-model ring-1 ring-model/50">🔥 {x.value} value</span>{/if}
				{#if x.live}<span class="rounded-full tint-loss px-2.5 py-1 text-loss ring-1 ring-loss/50">● {x.live} live</span>{/if}
			</span>
			{#if x.top?.bestValue}
				<span class="rounded-xl bg-ink px-3 py-2 text-sm text-chalk ring-1 ring-line">
					Top edge: <strong>{x.top.bestValue.selection}</strong> <span class="text-book">@ {x.top.bestValue.bestOdds.toFixed(2)}</span> <span class="text-model">+{x.top.bestValue.edgePercent.toFixed(1)}%</span>
				</span>
			{/if}
		</a>
	{/each}
</div>
<a href="/tennis" class="surface mt-4 flex min-w-0 flex-wrap items-center justify-between gap-4 p-5"><span class="min-w-0"><strong class="text-xl">🎾 Tennis</strong><span class="mt-2 block text-sm text-haze">Results-based match and first-set estimates. Experimental evidence and coverage are shown alongside each forecast.</span></span><span class="text-sm font-semibold text-model">Explore tennis ↗</span></a>
