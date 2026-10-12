<script lang="ts">
	import { app, type ValueBet } from '#lib/state.svelte.ts';
	import { odds, pct, signed, gradeTone } from '#lib/format.ts';
	import { Plus, Check } from 'lucide-svelte';

	let { rows }: { rows: ValueBet[] } = $props();
	const grouped = $derived(
		Object.entries(
			rows.reduce<Record<string, ValueBet[]>>((acc, r) => {
				(acc[r.market] ??= []).push(r);
				return acc;
			}, {})
		)
	);
</script>

<div class="space-y-4">
	{#each grouped as [market, list] (market)}
		<div class="overflow-hidden rounded-[var(--radius-card)] border border-line">
			<h3 class="bg-deep px-4 py-2.5 text-sm font-semibold">{market}</h3>
			<div class="overflow-x-auto">
				<table class="w-full text-sm sm:min-w-[34rem]">
					<thead class="text-left text-xs text-haze">
						<tr>
							<th class="py-2 pl-3 pr-1 font-normal sm:px-4">Selection</th>
							<th class="px-2 py-2 font-normal">Model</th>
							<th class="hidden px-2 py-2 font-normal sm:table-cell">Market</th>
							<th class="px-2 py-2 font-normal">Fair</th>
							<th class="px-2 py-2 font-normal">Price</th>
							<th class="px-2 py-2 font-normal">Edge</th>
							<th class="py-2 pr-3 sm:px-4"><span class="sr-only">Add</span></th>
						</tr>
					</thead>
					<tbody>
						{#each list.toSorted((a, b) => b.modelProb - a.modelProb) as r (r.id)}
							<tr class="border-t border-line/70">
								<td class="py-2.5 pl-3 pr-1 sm:px-4">
									<span class="mr-1.5 hidden rounded px-1.5 py-0.5 text-[11px] sm:inline {gradeTone[r.grade]}">{r.grade}</span>{r.selection}
								</td>
								<td class="px-2 py-2.5">{pct(r.modelProb, 1)}</td>
								<td class="hidden px-2 py-2.5 text-haze sm:table-cell">{pct(r.marketProb, 1)}</td>
								<td class="px-2 py-2.5 text-model">{odds(r.fairOdds)}</td>
								<td class="px-2 py-2.5"><span class="text-book">{odds(r.bestOdds)}</span> <span class="hidden text-xs text-haze sm:inline">{r.bookmaker}</span></td>
								<td class="px-2 py-2.5 {r.edgePercent > 0 ? 'text-model' : 'text-loss'}">{signed(r.edgePercent, 2)}%</td>
								<td class="py-2.5 pr-3 text-right sm:px-4">
									{#if r.edgePercent > 0}
										<button
											onclick={() => app.toggle(r)}
											aria-label={app.inSlip(r.id) ? `Remove ${r.selection}` : `Add ${r.selection}`}
											class="grid h-7 w-7 place-items-center rounded-full {app.inSlip(r.id) ? 'bg-model text-ink' : 'bg-line hover:bg-model/30'}"
										>
											{#if app.inSlip(r.id)}<Check class="h-3.5 w-3.5" strokeWidth={3} />{:else}<Plus class="h-3.5 w-3.5" strokeWidth={3} />{/if}
										</button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/each}
</div>
