<script lang="ts">
	import { page } from '$app/state';
	import { app } from '#lib/state.svelte.ts';
	import { NAV, isActive } from '#lib/nav.ts';

	const tabs = NAV.filter((n) => ['/', '/football', '/basketball', '/value-bets'].includes(n.href)).map((n) =>
		n.href === '/value-bets' ? { ...n, label: 'Value' } : n
	);
</script>

<nav class="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/92 backdrop-blur-xl md:hidden" aria-label="Main">
	<div class="mx-auto grid max-w-md grid-cols-5 px-2 pt-1.5">
		{#each tabs as t (t.href)}
			{@const active = isActive(page.url.pathname, t.href)}
			<a href={t.href} aria-current={active ? 'page' : undefined} class="group flex flex-col items-center gap-0.5 py-1 text-[11px] font-semibold {active ? 'text-chalk' : 'text-haze'}">
				<span class="grid h-8 w-12 place-items-center rounded-full text-xl transition-all {active ? 'bg-pop/20 ring-1 ring-pop/60' : 'grayscale-[40%]'}" aria-hidden="true">{t.emoji}</span>
				{t.label}
			</a>
		{/each}
		<button onclick={() => (app.slipOpen = true)} class="relative flex flex-col items-center gap-0.5 py-1 text-[11px] font-semibold text-haze">
			<span class="grid h-8 w-12 place-items-center rounded-full text-xl" aria-hidden="true">🧾</span>
			Slip
			{#if app.slip.length}
				<span class="absolute right-2 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-model px-1 text-[11px] font-bold text-ink" style="animation: pop-in 300ms var(--ease-spring)">{app.slip.length}</span>
			{/if}
		</button>
	</div>
</nav>
