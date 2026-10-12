<script lang="ts">
	import { GLOSSARY, CATEGORIES, GRADES, type GlossaryCategory } from '#lib/glossary.ts';
	import { slide } from 'svelte/transition';
	import { ChevronDown, Search } from 'lucide-svelte';

	let { limit = 0 }: { limit?: number } = $props();

	let query = $state('');
	let category = $state<GlossaryCategory | 'All'>('All');
	let open = $state<string | null>(null);

	const results = $derived(
		GLOSSARY.filter((t) => {
			if (category !== 'All' && t.category !== category) return false;
			const q = query.trim().toLowerCase();
			return !q || `${t.term} ${t.short} ${t.long}`.toLowerCase().includes(q);
		})
	);
	const shown = $derived(limit && !query && category === 'All' ? results.slice(0, limit) : results);

	// Open a term linked as #term-<id>.
	$effect(() => {
		const hash = typeof location !== 'undefined' ? location.hash : '';
		if (hash.startsWith('#term-')) open = hash.slice(6);
	});
</script>

<div class="grid gap-4">
	<!-- Grade ladder -->
	<div class="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="What the grades mean">
		{#each GRADES as g (g.grade)}
			<div class="surface flex flex-col gap-1 p-3">
				<span class="w-fit rounded-md px-2 py-0.5 text-sm font-bold {g.tone}"><span aria-hidden="true">{g.emoji}</span> {g.grade}</span>
				<span class="font-semibold text-chalk">{g.name}</span>
				<span class="text-xs text-haze">{g.rule}</span>
			</div>
		{/each}
	</div>

	<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
		<label class="field flex-1" for="glossary-search">
			<Search class="h-4 w-4 text-haze" />
			<input id="glossary-search" type="search" bind:value={query} placeholder="Search terms, e.g. edge, handicap, Kelly" autocomplete="off" />
		</label>
	</div>
	<div class="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Glossary categories">
		{#each [{ name: 'All' as const, emoji: '✨' }, ...CATEGORIES] as c (c.name)}
			<button
				role="tab"
				aria-selected={category === c.name}
				onclick={() => (category = c.name)}
				class="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition-colors {category === c.name ? 'tint-pop text-chalk ring-pop' : 'bg-deep text-haze ring-line hover:text-chalk'}"
			>
				<span aria-hidden="true">{c.emoji}</span> {c.name}
			</button>
		{/each}
	</div>

	<ul class="grid gap-2 md:grid-cols-2">
		{#each shown as t (t.id)}
			{@const isOpen = open === t.id}
			<li id="term-{t.id}" class="surface scroll-mt-24 overflow-hidden {isOpen ? 'ring-1 ring-pop' : ''}">
				<button
					onclick={() => (open = isOpen ? null : t.id)}
					aria-expanded={isOpen}
					aria-controls="term-body-{t.id}"
					class="flex w-full items-start gap-3 p-4 text-left"
				>
					<span class="text-2xl leading-none" aria-hidden="true">{t.emoji}</span>
					<span class="min-w-0 flex-1">
						<span class="block font-bold text-chalk">{t.term}</span>
						<span class="mt-0.5 block text-sm text-haze">{t.short}</span>
					</span>
					<ChevronDown class="mt-1 h-4 w-4 shrink-0 text-haze transition-transform {isOpen ? 'rotate-180' : ''}" />
				</button>
				{#if isOpen}
					<div id="term-body-{t.id}" class="px-4 pb-4 pl-[3.25rem] text-[15px] leading-relaxed text-chalk" transition:slide={{ duration: 200 }}>
						<p>{t.long}</p>
						{#if t.example}<p class="mt-2 rounded-xl bg-ink px-3 py-2 text-sm ring-1 ring-line">💬 {t.example}</p>{/if}
					</div>
				{/if}
			</li>
		{:else}
			<li class="surface p-6 text-center text-chalk md:col-span-2">No term matches “{query}”. Try another word.</li>
		{/each}
	</ul>
	{#if limit && shown.length < results.length}
		<a href="/glossary" class="btn-ghost justify-self-center">📖 See all {GLOSSARY.length} terms</a>
	{/if}
</div>
