<script lang="ts">
	import { page } from '$app/state';
	import { app } from '#lib/state.svelte.ts';
	import { pwa } from '#lib/pwa.svelte.ts';
	import { Settings2, ReceiptText, Download } from 'lucide-svelte';

	const links = [
		{ href: '/', label: 'Board' },
		{ href: '/football', label: 'Football' },
		{ href: '/basketball', label: 'Basketball' },
		{ href: '/value-bets', label: 'Value bets' },
		{ href: '/bookmakers', label: 'Bookmakers' }
	];
	const isActive = (href: string) => (href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href));
</script>

<header class="safe-top sticky top-0 z-40 border-b border-line/70 bg-ink/80 backdrop-blur-xl">
	<div class="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
		<a href="/" class="flex items-center gap-2" aria-label="QuantEdge home">
			<img src="/icons/icon.svg" alt="" class="h-8 w-8 rounded-lg" width="32" height="32" />
			<span class="font-display text-lg font-bold tracking-tight">QuantEdge</span>
		</a>

		<nav class="ml-4 hidden items-center gap-1 text-sm md:flex" aria-label="Main">
			{#each links as l}
				<a
					href={l.href}
					aria-current={isActive(l.href) ? 'page' : undefined}
					class="rounded-full px-3 py-1.5 transition-colors {isActive(l.href) ? 'bg-raised text-chalk' : 'text-haze hover:text-chalk'}"
				>
					{l.label}
				</a>
			{/each}
		</nav>

		<div class="ml-auto flex items-center gap-2">
			{#if pwa.canInstall}
				<button
					onclick={() => pwa.install()}
					class="hidden items-center gap-1.5 rounded-full bg-model/15 px-3 py-1.5 text-sm text-model hover:bg-model/25 sm:inline-flex"
				>
					<Download class="h-4 w-4" /> Install app
				</button>
			{/if}
			<a
				href="/settings"
				aria-label="Settings"
				aria-current={isActive('/settings') ? 'page' : undefined}
				class="grid h-9 w-9 place-items-center rounded-full text-haze hover:bg-raised hover:text-chalk"
			>
				<Settings2 class="h-[18px] w-[18px]" />
			</a>
			<button
				onclick={() => (app.slipOpen = true)}
				class="hidden items-center gap-2 rounded-full bg-chalk px-3.5 py-1.5 text-sm font-semibold text-ink hover:bg-white md:inline-flex"
			>
				<ReceiptText class="h-4 w-4" />
				Slip
				{#if app.slip.length}<span class="rounded-full bg-ink px-1.5 text-xs text-chalk">{app.slip.length}</span>{/if}
			</button>
		</div>
	</div>
</header>
