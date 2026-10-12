<script lang="ts">
	/**
	 * "Why this pick": a compact analysis of a fixture's best selection.
	 * Gauge: what the price needs to win (amber) vs the model (teal) vs the
	 * market consensus (outline). Drivers: the inputs that moved the number.
	 */
	import { app, type Prediction } from '#lib/state.svelte.ts';
	import { PuntersEdgeAIAgentHub } from '#lib/engine/ai_agent_orchestrator.js';
	import { pct, odds, ngn, gradeEmoji, gradeMeaning } from '#lib/format.ts';

	let { p, compact = false }: { p: Prediction; compact?: boolean } = $props();

	const hub = new PuntersEdgeAIAgentHub();
	const v = $derived(p.bestValue);
	const positive = $derived(Boolean(v && v.edgePercent > 0 && v.grade !== 'PASS'));
	const needs = $derived(v ? 1 / v.bestOdds : 0);
	const gapPts = $derived(v ? (v.modelProb - v.marketProb) * 100 : 0);
	const confidence = $derived(hub.analyze(p).consensusConfidence);
	const dots = $derived(Math.round(confidence * 5));

	interface Driver {
		emoji: string;
		text: string;
		tone: 'good' | 'bad' | 'neutral';
	}

	const drivers = $derived.by<Driver[]>(() => {
		if (!v) return [];
		const out: Driver[] = [];
		out.push({
			emoji: '🧮',
			text:
				Math.abs(gapPts) < 0.5
					? 'Model and market agree on this one.'
					: `Model rates it ${Math.abs(gapPts).toFixed(1)} pts ${gapPts > 0 ? 'higher' : 'lower'} than the market.`,
			tone: gapPts > 0.5 ? 'good' : gapPts < -0.5 ? 'bad' : 'neutral'
		});
		if (p.family === 'hockey' || p.family === 'baseball') {
			const diff = p.projectedScore.total - p.marketLines.total;
			out.push({
				emoji: p.family === 'hockey' ? '🏒' : '⚾',
				text: `Expected ${p.projectedScore.home.toFixed(1)}–${p.projectedScore.away.toFixed(1)} ${p.summary.unit}; ${Math.abs(diff) < 0.15 ? 'right on the total' : `${Math.abs(diff).toFixed(1)} ${diff > 0 ? 'over' : 'under'} the ${p.marketLines.total} line`}.`,
				tone: 'neutral'
			});
			if (p.ratingsSource && p.ratingsSource !== 'sample') {
				out.push({ emoji: p.ratingsSource === 'market' ? '🏦' : '📋', text: p.ratingsSource === 'market' ? 'No league table yet: model fitted to the market, edge comes from price shopping.' : `Team strength from ${p.ratingsSource}.`, tone: 'neutral' });
			}
		} else if (p.family === 'football') {
			out.push({
				emoji: '⚽',
				text: `Expected goals ${p.expectedGoals.homeLambda.toFixed(2)} vs ${p.expectedGoals.awayMu.toFixed(2)}; likeliest score ${p.topScorelines[0].home}–${p.topScorelines[0].away}.`,
				tone: 'neutral'
			});
		} else if (p.family === 'basketball') {
			const diff = p.projectedScore.total - p.marketLines.total;
			out.push({
				emoji: '🏀',
				text: `Projected ${Math.round(p.projectedScore.home)}–${Math.round(p.projectedScore.away)}; total ${diff >= 0 ? `${diff.toFixed(1)} over` : `${Math.abs(diff).toFixed(1)} under`} the line.`,
				tone: 'neutral'
			});
		}
		if (p.family === 'hockey' || p.family === 'baseball') {
			// No injury feed for these sports.
		} else if (p.absences.length > 0) {
			const names = p.absences.slice(0, 2).map((a) => a.name).join(', ');
			out.push({ emoji: '🚑', text: `${p.absences.length} out (${names}${p.absences.length > 2 ? '…' : ''}), priced in.`, tone: 'neutral' });
		} else {
			out.push({ emoji: '✅', text: 'Full squads, no injury adjustments.', tone: 'neutral' });
		}
		if (p.movement) {
			const m = p.movement.oddsMovementPct;
			out.push({
				emoji: m < -1 ? '📉' : m > 1 ? '📈' : '➖',
				text:
					Math.abs(m) <= 1
						? 'Home price steady since it opened.'
						: `Home price ${m < 0 ? 'shortened' : 'drifted'} ${Math.abs(m).toFixed(1)}% since open${p.movement.smartMoneyIndication ? ', a sharp-money sign' : ''}.`,
				tone: p.movement.smartMoneyIndication ? 'good' : 'neutral'
			});
		}
		return out;
	});

	// Gauge geometry (0–100% scale)
	const W = 320;
	const x = (prob: number) => 12 + Math.max(0, Math.min(1, prob)) * (W - 24);
	/** Label x, kept inside the drawing so text never clips. */
	const lx = (prob: number) => Math.max(46, Math.min(W - 46, x(prob)));
</script>

{#if v}
	<section class="space-y-3" aria-label="Why this pick">
		<p class="text-[15px] leading-snug text-chalk">
			{#if positive}
				<span aria-hidden="true">{gradeEmoji[v.grade]}</span>
				<strong>{v.selection}</strong> lands {pct(v.modelProb)} of the time by our numbers. At <span class="font-semibold text-book">{odds(v.bestOdds)}</span> it only needs {pct(needs)} to pay off.
			{:else}
				<span aria-hidden="true">✋</span>
				<strong>No bet here.</strong> The best price, {v.selection} at <span class="font-semibold text-book">{odds(v.bestOdds)}</span>, needs {pct(needs)}; our number is {pct(v.modelProb)}.
			{/if}
		</p>

		<!-- Probability gauge -->
		<figure>
			<svg viewBox="0 0 {W} 64" class="w-full" role="img" aria-label="Needs {pct(needs)} to break even; model says {pct(v.modelProb)}; market says {pct(v.marketProb)}">
				<rect x="12" y="26" width={W - 24} height="12" rx="6" style="fill: var(--color-ink); stroke: var(--color-line)" />
				<!-- the edge: between break-even and the model -->
				<rect
					x={Math.min(x(needs), x(v.modelProb))}
					y="26"
					width={Math.abs(x(v.modelProb) - x(needs))}
					height="12"
					rx="4"
					style="fill: {positive ? 'var(--color-model)' : 'var(--color-loss)'}; opacity: 0.35"
				/>
				<rect x="12" y="29" width={Math.max(0, x(v.modelProb) - 12)} height="6" rx="3" style="fill: var(--color-model)" />
				<!-- market tick -->
				<line x1={x(v.marketProb)} x2={x(v.marketProb)} y1="22" y2="42" style="stroke: var(--color-haze); stroke-width: 2; stroke-dasharray: 3 2" />
				<!-- break-even marker -->
				<path d="M{x(needs)} 24 l-6 -9 h12 z" style="fill: var(--color-book)" />
				<text x={lx(needs)} y="11" text-anchor="middle" font-size="11" font-weight="600" style="fill: var(--color-book)">Needs {pct(needs)}</text>
				<circle cx={x(v.modelProb)} cy="32" r="6" style="fill: var(--color-model); stroke: var(--color-deep); stroke-width: 2" />
				<text x={lx(v.modelProb)} y="58" text-anchor="middle" font-size="11" font-weight="600" style="fill: var(--color-model)">Model {pct(v.modelProb)}</text>
			</svg>
			<figcaption class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-haze">
				<span><span class="mr-1 inline-block h-2 w-3 rounded-full bg-model align-middle"></span>Model</span>
				<span><span class="mr-1 inline-block h-2 w-3 border-t-2 border-dashed border-haze align-middle"></span>Market {pct(v.marketProb)}</span>
				<span><span class="mr-1 inline-block h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-book align-middle"></span>Break-even</span>
			</figcaption>
		</figure>

		{#if !compact || positive}
			<ul class="grid gap-1.5 text-sm">
				{#each drivers as d (d.text)}
					<li class="flex items-start gap-2 rounded-xl bg-ink px-3 py-2 ring-1 ring-line">
						<span aria-hidden="true">{d.emoji}</span>
						<span class={d.tone === 'good' ? 'text-chalk' : d.tone === 'bad' ? 'text-loss' : 'text-chalk'}>{d.text}</span>
					</li>
				{/each}
			</ul>
		{/if}

		<div class="flex flex-wrap items-center justify-between gap-2 text-sm">
			<span class="text-haze">
				{gradeMeaning[v.grade]}{#if positive}, stake <span class="font-semibold text-chalk">{ngn(app.stakeFor(v.kellyStakePercent))}</span> ({v.kellyStakePercent}%){/if}
			</span>
			<span class="flex items-center gap-1.5 text-haze" title="How strongly the four checks agree">
				Confidence
				<span class="flex gap-0.5" aria-label="{dots} of 5">
					{#each Array(5) as _, i}
						<span class="h-2 w-2 rounded-full {i < dots ? 'bg-pop' : 'bg-line'}"></span>
					{/each}
				</span>
			</span>
		</div>
	</section>
{/if}
