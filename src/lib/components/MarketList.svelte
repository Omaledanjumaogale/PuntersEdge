<script lang="ts">
	/** Every priced market for a fixture, grouped, with add-to-slip toggles. */
	import { feed } from '#lib/feed.svelte.ts';
	import { likelihoodGrade } from '#lib/engine/decision_screener.js';
	import { app } from '#lib/state.svelte.ts';
	import type { MarketGroup } from '#lib/engine/market_book.js';
	import { odds, pct, signed, gradeTone, gradeEmoji, gradeMeaning } from '#lib/format.ts';
	import { Plus, Check } from 'lucide-svelte';

	let { groups, valueOnly = false }: { groups: MarketGroup[]; valueOnly?: boolean } = $props();

	const shown = $derived(
		groups
			.map((g) => ({ ...g, selections: valueOnly ? g.selections.filter((s) => s.edgePercent > 0) : g.selections }))
			.filter((g) => g.selections.length > 0)
	);
</script>

{#if shown.length === 0}
	<p class="rounded-2xl bg-raised p-5 text-center text-chalk ring-1 ring-line">✋ No market here beats fair value right now.</p>
{/if}

<div class="grid gap-4">
	{#each shown as g (g.key)}
		<section aria-labelledby="mk-{g.key}">
			<header class="mb-2">
				<h3 id="mk-{g.key}" class="text-base font-bold text-chalk"><span aria-hidden="true">{g.emoji}</span> {g.title}</h3>
				<p class="text-xs text-haze">{g.blurb}</p>
			</header>
			<ul class="overflow-hidden rounded-2xl ring-1 ring-line">
				{#each g.selections as s (s.id)}
					{@const inSlip = app.inSlip(s.id)}
					<li class="flex items-center gap-2.5 border-t border-line px-3 py-2.5 first:border-t-0 {inSlip ? 'tint-pop' : 'bg-deep'}">
						<div class="min-w-0 flex-1">
							<p class="flex min-w-0 items-center gap-1.5 font-semibold text-chalk">
								{#if s.pricing === 'quoted'}
									<span class="shrink-0 rounded px-1 text-[11px] font-bold {gradeTone[s.grade]}" title={gradeMeaning[s.grade]}>Value {s.grade}</span>
								{:else}<span class="text-[11px] text-haze">Model only</span>{/if}
								<span class="truncate">{s.selection}</span>
							</p>
							<p class="mt-0.5 text-xs text-haze">
								Likelihood {likelihoodGrade(s.modelProb*(1-(s.pushProb??0)))} · Model {pct(s.modelProb,1)}, fair <span class="font-semibold text-model">{odds(s.fairOdds)}</span>{#if s.pushProb > 0.005}, refund {pct(s.pushProb)}{/if}{#if s.pricing === 'derived'}<span title="Derived from this bookmaker's headline prices">, derived</span>{/if}
							</p>
						{#each (feed.data?.gradeHistory?.[s.fixtureId]??[]).filter(change=>change.key===s.id.slice(s.fixtureId.length+1)).slice(-3) as change}<p class="mt-1 text-[11px] text-haze">Value {change.from} → {change.to} · {new Date(change.at).toLocaleTimeString('en-NG',{timeZone:'Africa/Lagos',hour:'2-digit',minute:'2-digit'})} WAT</p>{/each}
						</div>
						<div class="shrink-0 text-right">
							<p class="font-display text-lg font-bold leading-none text-book">{s.pricing==='quoted'?odds(s.bestOdds):'—'}</p>
							<p class="mt-0.5 text-[11px] text-haze">{s.pricing==='quoted'?s.bookmaker:'No quoted price'}</p>
							<p class="text-xs font-semibold {s.edgePercent > 0 ? 'text-model' : 'text-loss'}">{s.pricing==='quoted'?`${signed(s.edgePercent,1)}% EV`:'Theoretical'}</p>
						</div>
						<button
							disabled={s.pricing!=='quoted' || app.gameById(s.fixtureId)?.status.state!=='scheduled'}
							onclick={() => app.toggle(s)}
							aria-pressed={inSlip}
							aria-label={inSlip ? `Remove ${s.selection} from slip` : `Add ${s.selection} to slip`}
							class="disabled:opacity-30 grid h-9 w-9 shrink-0 place-items-center rounded-full transition-all active:scale-90 {inSlip ? 'bg-model text-ink' : 'bg-raised text-chalk ring-1 ring-line hover:ring-pop'}"
						>
							{#if inSlip}<Check class="h-4 w-4" strokeWidth={3} />{:else}<Plus class="h-4 w-4" strokeWidth={3} />{/if}
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>
