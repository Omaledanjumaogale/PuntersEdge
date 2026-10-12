<script lang="ts">
	import { app } from '#lib/state.svelte.ts';
	import { compareBookmakerOdds, calculateAccumulatorEconomics } from '#lib/engine/bookmaker_engine.js';
	import { ngn, odds } from '#lib/format.ts';

	/** Average margin per book across every priced fixture. */
	const books = $derived.by(() => {
		const sums = new Map<string, { total: number; n: number; best: number }>();
		for (const p of app.all) {
			for (const [book, m] of Object.entries(p.margins)) {
				const s = sums.get(book) ?? { total: 0, n: 0, best: 0 };
				s.total += m;
				s.n += 1;
				if (p.bestValue?.bookmaker === book) s.best += 1;
				sums.set(book, s);
			}
		}
		return [...sums.entries()]
			.map(([name, s]) => ({ name, margin: s.total / s.n, bestPrices: s.best }))
			.sort((a, b) => a.margin - b.margin);
	});
	const maxMargin = $derived(Math.max(...books.map((b) => b.margin)));

	const arbs = $derived(
		app.football
			.filter((p) => p.status.state === 'scheduled')
			.map((p) => ({ p, books: Object.entries(p.odds).filter(([, o]) => o.home > 1 && o.draw > 1 && o.away > 1) }))
			.filter((x) => x.books.length >= 2)
			.slice(0, 20)
			.map(({ p, books }) => {
				const cmp = compareBookmakerOdds(books.map(([bookmaker, o]) => ({ bookmaker, odds: { home: o.home, draw: o.draw, away: o.away } })));
				return { p, ...cmp.bestMarketConsensus };
			})
	);

	let perLeg = $state(5);
	const decay = $derived([1, 2, 3, 4, 5, 6, 8, 10, 12].map((legs) => ({ legs, ...calculateAccumulatorEconomics(Array(legs).fill(2), perLeg / 100) })));
</script>

<svelte:head><title>Bookmakers — PuntersEdge</title></svelte:head>

<header class="max-w-2xl">
	<h1 class="text-4xl font-extrabold text-chalk">🏦 Bookmakers</h1>
	<p class="mt-2 text-haze">How much each book keeps, where the best prices sit, and what margin does to accumulators.</p>
</header>

<section class="mt-8" aria-labelledby="margin-title">
	<h2 id="margin-title" class="text-2xl font-semibold">Average margin on match result</h2>
	<p class="mt-1 text-sm text-haze">Lower is better for you. Measured across all {app.all.length} fixtures in the feed.</p>
	<div class="surface mt-4 space-y-4 p-5">
		{#each books as b (b.name)}
			<div class="grid grid-cols-[6rem_1fr_auto] items-center gap-3 text-sm">
				<span class="font-semibold">{b.name}</span>
				<div class="h-3 rounded-full bg-ink">
					<div class="h-3 rounded-full bg-book transition-[width] duration-700" style="width: {(b.margin / maxMargin) * 100}%"></div>
				</div>
				<span class="w-36 text-right"><span class="text-book">{b.margin.toFixed(2)}%</span> <span class="text-haze">margin, {b.bestPrices} top picks</span></span>
			</div>
		{/each}
	</div>
</section>

<section class="mt-10" aria-labelledby="arb-title">
	<h2 id="arb-title" class="text-2xl font-semibold">Best price across books</h2>
	<p class="mt-1 text-sm text-haze">
		Backing every outcome at its best price costs the shown overround. Below 1.000 would be a guaranteed profit (an arbitrage).
	</p>
	<div class="mt-4 overflow-x-auto rounded-[var(--radius-card)] border border-line">
		<table class="w-full min-w-[34rem] text-sm">
			<thead class="bg-deep text-left text-haze">
				<tr><th class="p-3 font-normal">Match</th><th class="p-3 font-normal">Home</th><th class="p-3 font-normal">Draw</th><th class="p-3 font-normal">Away</th><th class="p-3 text-right font-normal">Overround</th></tr>
			</thead>
			<tbody>
				{#each arbs as a (a.p.fixtureId)}
					<tr class="border-t border-line">
						<td class="p-3"><a href="/match?id={a.p.fixtureId}" class="hover:text-model">{a.p.matchTitle}</a></td>
						<td class="p-3"><span class="text-book">{odds(a.bestHome.odds)}</span> <span class="text-xs text-haze">{a.bestHome.bookmaker}</span></td>
						<td class="p-3"><span class="text-book">{odds(a.bestDraw.odds)}</span> <span class="text-xs text-haze">{a.bestDraw.bookmaker}</span></td>
						<td class="p-3"><span class="text-book">{odds(a.bestAway.odds)}</span> <span class="text-xs text-haze">{a.bestAway.bookmaker}</span></td>
						<td class="p-3 text-right {a.isArbitrage ? 'text-model font-semibold' : ''}">{a.arbOverround.toFixed(3)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>

<section class="mt-10" aria-labelledby="acca-title">
	<h2 id="acca-title" class="text-2xl font-semibold">What margin does to accumulators</h2>
	<label class="mt-2 flex max-w-sm flex-col gap-1 text-sm">
		<span class="text-haze">Margin per leg: <span class="text-chalk">{perLeg}%</span></span>
		<input type="range" min="2" max="10" step="0.5" bind:value={perLeg} class="accent-[var(--color-book)]" />
	</label>
	<div class="mt-4 overflow-x-auto rounded-[var(--radius-card)] border border-line">
		<table class="w-full min-w-[30rem] text-sm">
			<thead class="bg-deep text-left text-haze">
				<tr><th class="p-3 font-normal">Legs</th><th class="p-3 font-normal">Book keeps</th><th class="p-3 font-normal">Expected loss on ₦10,000</th><th class="p-3 font-normal"></th></tr>
			</thead>
			<tbody>
				{#each decay as d (d.legs)}
					<tr class="border-t border-line">
						<td class="p-3">{d.legs}</td>
						<td class="p-3 text-book">{d.compoundMarginRiskPct.toFixed(1)}%</td>
						<td class="p-3">{ngn((10000 * d.compoundMarginRiskPct) / 100)}</td>
						<td class="w-1/3 p-3"><div class="h-2 rounded-full bg-loss/80" style="width: {Math.min(100, d.compoundMarginRiskPct * 1.6)}%"></div></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="mt-3 max-w-2xl text-sm text-haze">
		Without a genuine edge on each leg, every extra selection multiplies the book's share. A 10-leg slip at {perLeg}% per leg hands over
		{decay.find((d) => d.legs === 10)?.compoundMarginRiskPct.toFixed(0)}% of your stake in expectation.
	</p>
</section>
