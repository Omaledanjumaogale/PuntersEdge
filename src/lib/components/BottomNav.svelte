<script lang="ts">
	import { page } from '$app/state';
	import { app } from '#lib/state.svelte.ts';
	import { NAV, isActive } from '#lib/nav.ts';

	const short: Record<string, string> = { '/value-bets': 'Value', '/bet-machine':'Machine' };
	const tabs = NAV.filter((n) => ['/', '/board', '/sports', '/value-bets', '/bet-machine'].includes(n.href)).map((n) => ({
		...n,
		label: short[n.href] ?? n.label
	}));
</script>

<nav class="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/92 backdrop-blur-xl md:hidden" aria-label="Main">
	<div class="mx-auto grid max-w-lg grid-cols-6 px-1 pt-1.5">
		{#each tabs as t (t.href)}
			{@const active = isActive(page.url.pathname, t.href, t.also)}
			<a href={t.href} aria-current={active ? 'page' : undefined} class="group flex flex-col items-center gap-0.5 py-1 text-[11px] font-semibold {active ? 'text-chalk' : 'text-haze'}">
				<span class="grid h-8 w-11 place-items-center rounded-full text-xl transition-all {active ? 'tint-pop ring-1 ring-pop/60' : 'grayscale-[40%]'}" aria-hidden="true">{t.emoji}</span>
				{t.label}
			</a>
		{/each}
		<button onclick={() => (app.slipOpen = true)} class="relative flex flex-col items-center gap-0.5 py-1 text-[11px] font-semibold text-haze">
			<span class="grid h-8 w-11 place-items-center rounded-full text-xl" aria-hidden="true">🧾</span>
			Slip
			{#if app.slip.length}
				<span class="absolute right-1 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-model px-1 text-[11px] font-bold text-ink" style="animation: pop-in 300ms var(--ease-spring)">{app.slip.length}</span>
			{/if}
		</button>
	</div>
</nav>
