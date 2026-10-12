<script lang="ts">
	/** Swipeable strip of the five sport dashboards. */
	import { page } from '$app/state';
	import { app } from '#lib/state.svelte.ts';
	import { SPORTS, SPORT_ORDER } from '#lib/sports.ts';
</script>

<nav aria-label="Sports" class="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
	<ul class="flex w-max gap-2">
		{#each SPORT_ORDER as key (key)}
			{@const s = SPORTS[key]}
			{@const active = page.url.pathname === s.href}
			{@const n = app.bySport(key).filter((p) => p.status.state !== 'finished').length}
			<li>
				<a
					href={s.href}
					aria-current={active ? 'page' : undefined}
					class="flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold ring-1 transition-colors {active ? 'tint-pop text-chalk ring-pop' : 'bg-deep text-chalk ring-line hover:ring-pop'}"
				>
					<span aria-hidden="true" class="text-lg leading-none">{s.emoji}</span>
					{s.label}
					<span class="rounded-full bg-raised px-1.5 text-xs text-haze ring-1 ring-line">{n}</span>
				</a>
			</li>
		{/each}
	</ul>
</nav>
