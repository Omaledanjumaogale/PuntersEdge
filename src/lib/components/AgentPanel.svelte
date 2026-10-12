<script lang="ts">
	import type { Prediction } from '#lib/state.svelte.ts';
	import { QuantEdgeAIAgentHub } from '#lib/engine/ai_agent_orchestrator.js';
	import { odds, ngn } from '#lib/format.ts';
	import { app } from '#lib/state.svelte.ts';

	let { p }: { p: Prediction } = $props();
	const hub = new QuantEdgeAIAgentHub();
	const analysis = $derived(hub.analyze(p));
	const rec = $derived(analysis.recommendation);
	const stanceTone = { bullish: 'bg-model', bearish: 'bg-loss', neutral: 'bg-haze' } as const;
</script>

<section aria-labelledby="agents-title">
	<h2 id="agents-title" class="text-2xl font-semibold">Reasoning</h2>
	<p class="mt-1 text-sm text-haze">Four checks run over the numbers above. Each sentence is generated from computed values.</p>

	<div class="mt-4 grid gap-3 sm:grid-cols-2">
		{#each analysis.agents as a (a.agent)}
			<article class="surface p-4">
				<div class="flex items-center gap-2">
					<span class="h-2 w-2 rounded-full {stanceTone[a.stance]}" aria-hidden="true"></span>
					<h3 class="text-base font-semibold">{a.agent}</h3>
					<span class="ml-auto text-xs text-haze">{Math.round(a.confidence * 100)}% sure</span>
				</div>
				<p class="mt-1 text-sm text-chalk/90">{a.headline}</p>
				<ul class="mt-2 space-y-1 text-sm text-haze">
					{#each a.findings as f}<li>{f}</li>{/each}
				</ul>
			</article>
		{/each}
	</div>

	<div class="mt-4 rounded-[var(--radius-card)] p-5 ring-1 {rec.action === 'BET' ? 'bg-model/[0.07] ring-model/40' : 'bg-deep ring-line'}">
		<p class="text-sm text-haze">Verdict</p>
		{#if rec.action === 'BET'}
			<p class="mt-1 font-display text-2xl font-semibold">
				{rec.selection} at <span class="text-book">{odds(rec.odds)}</span>
			</p>
			<p class="mt-1 text-sm text-haze">
				{rec.bookmaker}, grade {rec.grade}, stake {rec.stakePercent}% ({ngn(app.stakeFor(rec.stakePercent))})
			</p>
		{:else}
			<p class="mt-1 font-display text-2xl font-semibold">Pass</p>
		{/if}
		<p class="mt-3 max-w-prose text-[15px] leading-relaxed">{rec.rationale}</p>
	</div>
</section>
