<script lang="ts">
	/**
	 * Interactive what-if for a basketball projection: nudge pace, efficiency
	 * and home advantage and the engine re-prices the game live.
	 */
	import type { BasketballPrediction } from '#lib/state.svelte.ts';
	import { projectBasketballGame, probabilityHomeCovers, probabilityOver } from '#lib/engine/basketball_model.js';
	import { pct, signed } from '#lib/format.ts';
	import { untrack } from 'svelte';

	let { p }: { p: BasketballPrediction } = $props();

	let paceDelta = $state(0);
	let homeOffDelta = $state(0);
	let awayOffDelta = $state(0);
	let hca = $state(untrack(() => p.hcaPoints));

	const sim = $derived(
		projectBasketballGame(
			{ ...p.ratings.home, pace: p.ratings.home.pace + paceDelta, offRtg: p.ratings.home.offRtg + homeOffDelta },
			{ ...p.ratings.away, pace: p.ratings.away.pace + paceDelta, offRtg: p.ratings.away.offRtg + awayOffDelta },
			p.leagueProfile,
			{ hcaPoints: hca, simulations: 8000, seed: 7 }
		)
	);
	const cover = $derived(probabilityHomeCovers(sim.projection, p.marketLines.spread));
	const over = $derived(probabilityOver(sim.projection, p.marketLines.total));

	// Histogram geometry
	const W = 480, H = 200, PAD = 22;
	const hist = $derived(sim.simulation.histogram.filter((b) => b.from >= -45 && b.to <= 45));
	const maxShare = $derived(Math.max(...hist.map((b) => b.share)));
	const x = (v: number) => PAD + ((v + 45) / 90) * (W - PAD * 2);
	const y = (s: number) => H - PAD - (s / maxShare) * (H - PAD * 2);
	const lineX = $derived(x(-p.marketLines.spread));

	function reset() {
		paceDelta = homeOffDelta = awayOffDelta = 0;
		hca = p.hcaPoints;
	}
</script>

<section aria-labelledby="lab-title" class="surface p-5">
	<div class="flex items-baseline justify-between gap-3">
		<h2 id="lab-title" class="text-2xl font-semibold">Pace lab</h2>
		<button onclick={reset} class="text-sm text-haze hover:text-chalk">Reset</button>
	</div>
	<p class="mt-1 text-sm text-haze">Change the inputs and watch the game re-price. {sim.simulation.simulations.toLocaleString()} seeded simulations per change.</p>

	<div class="mt-5 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
		<div class="space-y-4 text-sm">
			{#each [
				{ label: 'Tempo', get: () => paceDelta, set: (v: number) => (paceDelta = v), min: -8, max: 8, step: 0.5, unit: ' poss.' },
				{ label: `${p.homeTeam} offence`, get: () => homeOffDelta, set: (v: number) => (homeOffDelta = v), min: -8, max: 8, step: 0.5, unit: ' rtg' },
				{ label: `${p.awayTeam} offence`, get: () => awayOffDelta, set: (v: number) => (awayOffDelta = v), min: -8, max: 8, step: 0.5, unit: ' rtg' }
			] as s (s.label)}
				<label class="block">
					<span class="flex justify-between"><span>{s.label}</span><span class="text-haze">{signed(s.get(), 1)}{s.unit}</span></span>
					<input type="range" min={s.min} max={s.max} step={s.step} value={s.get()} oninput={(e) => s.set(+e.currentTarget.value)} class="mt-1 w-full accent-[var(--color-model)]" />
				</label>
			{/each}
			<label class="block">
				<span class="flex justify-between"><span>Home advantage</span><span class="text-haze">{hca.toFixed(1)} pts</span></span>
				<input type="range" min="0" max="6" step="0.2" bind:value={hca} class="mt-1 w-full accent-[var(--color-model)]" />
			</label>
		</div>

		<div>
			<dl class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
				<div><dt class="text-haze">Score</dt><dd class="font-display text-xl font-semibold">{Math.round(sim.projectedScore.home)}–{Math.round(sim.projectedScore.away)}</dd></div>
				<div><dt class="text-haze">{p.homeTeam.split(' ').at(-1)} win</dt><dd class="font-display text-xl font-semibold text-model">{pct(sim.winProbabilities.home, 1)}</dd></div>
				<div><dt class="text-haze">Covers {p.marketLines.spread > 0 ? '+' : ''}{p.marketLines.spread}</dt><dd class="font-display text-xl font-semibold">{pct(cover, 1)}</dd></div>
				<div><dt class="text-haze">Over {p.marketLines.total}</dt><dd class="font-display text-xl font-semibold">{pct(over, 1)}</dd></div>
			</dl>

			<svg viewBox="0 0 {W} {H}" class="mt-4 w-full" role="img" aria-label="Distribution of the home winning margin">
				{#each hist as b (b.from)}
					<rect
						x={x(b.from) + 1}
						y={y(b.share)}
						width={Math.max(1, x(b.to) - x(b.from) - 2)}
						height={H - PAD - y(b.share)}
						rx="2"
						fill={b.from >= -p.marketLines.spread ? 'var(--color-model)' : 'var(--color-line)'}
						class="transition-all duration-300"
					/>
				{/each}
				<line x1={x(0)} x2={x(0)} y1={PAD - 8} y2={H - PAD} stroke="var(--color-haze)" stroke-dasharray="3 4" />
				<line x1={lineX} x2={lineX} y1={PAD - 8} y2={H - PAD} stroke="var(--color-book)" stroke-width="2" />
				<text x={lineX + 6} y={PAD} fill="var(--color-book)" font-size="12">line</text>
				{#each [-40, -20, 0, 20, 40] as t}
					<text x={x(t)} y={H - 6} fill="var(--color-haze)" font-size="11" text-anchor="middle">{t > 0 ? `+${t}` : t}</text>
				{/each}
			</svg>
			<p class="text-xs text-haze">Home winning margin. Teal bars cover the spread; the amber line is the bookmakers' number.</p>
		</div>
	</div>
</section>
