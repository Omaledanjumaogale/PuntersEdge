<script lang="ts">
	/** Live / full-time / postponed badge. Renders nothing for scheduled games. */
	import { statusLabel } from '#lib/format.ts';

	let { status }: { status: { state: string; home?: number; away?: number; detail?: string } | undefined } = $props();
	const label = $derived(statusLabel(status));
</script>

{#if label}
	<span
		class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 {status?.state === 'live'
			? 'tint-loss text-loss ring-loss/50'
			: status?.state === 'finished'
				? 'bg-raised text-chalk ring-line'
				: 'tint-book text-book ring-book/50'}"
	>
		{#if status?.state === 'live'}<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-loss" aria-hidden="true"></span>{/if}
		{label}
	</span>
{/if}
