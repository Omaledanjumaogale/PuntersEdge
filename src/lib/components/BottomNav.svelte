<script lang="ts">
	import { page } from '$app/state';
	import { app } from '#lib/state.svelte.ts';
	import { LayoutGrid, Goal, Volleyball, BadgePercent, ReceiptText } from 'lucide-svelte';

	const tabs = [
		{ href: '/', label: 'Board', icon: LayoutGrid },
		{ href: '/football', label: 'Football', icon: Goal },
		{ href: '/basketball', label: 'Basketball', icon: Volleyball },
		{ href: '/value-bets', label: 'Value', icon: BadgePercent }
	];
	const isActive = (href: string) => (href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href));
</script>

<nav class="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-ink/90 backdrop-blur-xl md:hidden" aria-label="Main">
	<div class="mx-auto grid max-w-md grid-cols-5 px-2 pt-1.5">
		{#each tabs as t}
			<a
				href={t.href}
				aria-current={isActive(t.href) ? 'page' : undefined}
				class="flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] transition-colors {isActive(t.href) ? 'text-model' : 'text-haze'}"
			>
				<t.icon class="h-5 w-5" strokeWidth={isActive(t.href) ? 2.4 : 1.8} />
				{t.label}
			</a>
		{/each}
		<button onclick={() => (app.slipOpen = true)} class="relative flex flex-col items-center gap-0.5 py-1.5 text-[11px] text-chalk">
			<ReceiptText class="h-5 w-5" />
			Slip
			{#if app.slip.length}
				<span class="absolute right-3 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-model px-1 text-[10px] font-bold text-ink">{app.slip.length}</span>
			{/if}
		</button>
	</div>
</nav>
