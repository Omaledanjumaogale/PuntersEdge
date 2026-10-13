<script lang="ts">
	/** A value pick printed as a betting-coupon stub: bookmaker price vs fair price. */
	import { app, type ValueBet } from '#lib/state.svelte.ts';
	import { odds, gradeTone, gradeEmoji, gradeMeaning, signed, ngn } from '#lib/format.ts';
	import { Plus, Check } from 'lucide-svelte';

	let { pick, showMatch = false }: { pick: ValueBet; showMatch?: boolean } = $props();
	const selected = $derived(app.inSlip(pick.id));
	const positive = $derived(pick.edgePercent > 0 && pick.pricing === 'quoted');
</script>

<div class="ticket flex min-w-0 items-stretch">
	<div class="min-w-0 flex-1 px-4 py-3">
		{#if showMatch}
			<a href="/match?id={pick.fixtureId}" class="block truncate text-xs font-medium text-haze hover:text-chalk">{pick.matchTitle}</a>
		{/if}
		<div class="flex items-center gap-2">
			<span class="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold {gradeTone[pick.grade]}" title={gradeMeaning[pick.grade]}><span aria-hidden="true">{gradeEmoji[pick.grade]}</span> {pick.grade}</span>
			<span class="truncate font-display text-base font-bold text-chalk">{pick.selection}</span>
		</div>
		<div class="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
			<span><span class="text-book font-semibold">{odds(pick.bestOdds)}</span> <span class="text-haze">at {pick.bookmaker}</span></span>
			<span><span class="text-model font-semibold">{odds(pick.fairOdds)}</span> <span class="text-haze">fair</span></span>
			<span class={positive ? 'text-model' : 'text-loss'}>{signed(pick.edgePercent, 2)}% edge</span>
		</div>
	</div>
	<div class="ticket-rule flex w-[4.75rem] shrink-0 sm:w-[5.5rem] flex-col items-center justify-center gap-1 px-2 py-3 text-center">
		{#if positive}
			<span class="text-xs leading-tight text-haze">Stake<br /><span class="font-semibold text-chalk">{ngn(app.stakeFor(pick.kellyStakePercent))}</span></span>
			<button
				disabled={!selected && (app.gameById(pick.fixtureId)?.status.state!=='scheduled'||Date.parse(app.gameById(pick.fixtureId)?.kickoff??'')<=Date.now())}
				onclick={() => (selected ? app.toggle(pick) : app.addAndExplore(pick))}
				aria-pressed={selected}
				aria-label={selected ? `Remove ${pick.selection} from slip` : `Add ${pick.selection} to slip`}
				class="disabled:opacity-30 grid h-9 w-9 place-items-center rounded-full transition-all active:scale-90 {selected ? 'bg-model text-ink' : 'bg-chalk text-ink hover:scale-105'}"
			>
				{#if selected}<Check class="h-4 w-4" strokeWidth={3} />{:else}<Plus class="h-4 w-4" strokeWidth={3} />{/if}
			</button>
		{:else}
			<span class="text-xs font-medium text-haze">✋ No bet</span>
		{/if}
	</div>
</div>
