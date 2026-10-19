<script lang="ts">
	import type { Prediction } from '#lib/state.svelte.ts';
	import { PuntersEdgeAIAgentHub } from '#lib/engine/ai_agent_orchestrator.js';
	import { odds, ngn } from '#lib/format.ts';
	import { app } from '#lib/state.svelte.ts';
	import AIExplanation from '#lib/components/AIExplanation.svelte';
 import SelectionIdentity from './SelectionIdentity.svelte';

	let { p }: { p: Prediction } = $props();
	const hub = new PuntersEdgeAIAgentHub();
	const analysis = $derived(hub.analyze(p));
	const rec = $derived(analysis.recommendation);
	const stanceTone = { bullish: 'bg-model', bearish: 'bg-loss', neutral: 'bg-haze' } as const;
	const stanceLabel = { bullish: 'Supports a bet', bearish: 'Argues caution', neutral: 'Neutral' } as const;
	const agentEmoji: Record<string, string> = { 'Market Intelligence': '📈', 'Squad & Context': '🚑', 'Quantitative Model': '🧮', 'Risk Manager': '🛡️' };
</script>

<section aria-labelledby="agents-title">
	<h2 id="agents-title" class="text-2xl font-bold text-chalk">🧠 Reasoning</h2>
	<p class="mt-1 text-sm text-haze">Four checks run over the numbers above. Each sentence is generated from computed values.</p>

	<div class="mt-4 grid gap-3 sm:grid-cols-2">
		{#each analysis.agents as a (a.agent)}
			<article class="surface p-4">
				<div class="flex items-center gap-2">
					<span class="text-xl" aria-hidden="true">{agentEmoji[a.agent] ?? '🤖'}</span>
					<h3 class="text-base font-bold text-chalk">{a.agent}</h3>
					<span class="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-haze"><span class="h-2 w-2 rounded-full {stanceTone[a.stance]}" aria-hidden="true"></span>{stanceLabel[a.stance]}</span>
				</div>
				<p class="mt-1 font-medium text-chalk">{a.headline}</p>
				<ul class="mt-2 space-y-1 text-sm text-haze">
					{#each a.findings as f}<li>{f}</li>{/each}
				</ul>
			</article>
		{/each}
	</div>

	<div class="mt-4 rounded-[var(--radius-card)] p-5 ring-1 {rec.action === 'BET' ? 'tint-model ring-model/40' : 'bg-deep ring-line'}">
		<p class="text-sm font-semibold text-haze">{rec.action === 'BET' ? '✅ Verdict' : '✋ Verdict'}</p>
		{#if rec.action === 'BET'}
			<p class="mt-1 font-display text-2xl font-semibold">
				<SelectionIdentity selection={{selection:rec.selection}} home={p.homeTeam} away={p.awayTeam} showTag={false}/> at <span class="text-book">{odds(rec.odds)}</span>
			</p>
			<p class="mt-1 text-sm text-haze">
				{rec.bookmaker}, grade {rec.grade}, stake {rec.stakePercent}% ({ngn(app.stakeFor(rec.stakePercent))})
			</p>
		{:else}
			<p class="mt-1 font-display text-2xl font-semibold">Pass</p>
		{/if}
		<p class="mt-3 max-w-prose text-[15px] leading-relaxed text-chalk">{rec.rationale}</p>
	</div>
	<AIExplanation fixtureId={p.fixtureId} sport={p.sport} />
</section>
