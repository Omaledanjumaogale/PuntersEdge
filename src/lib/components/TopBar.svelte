<script lang="ts">
	import { page } from '$app/state';
	import { app } from '#lib/state.svelte.ts';
	import { auth } from '#lib/auth.svelte.ts';
	import { theme } from '#lib/theme.svelte.ts';
	import { NAV, isActive } from '#lib/nav.ts';
	import Logo from './Logo.svelte';
	import { Menu, ReceiptText } from 'lucide-svelte';

	const desktopLinks = NAV.filter((n) => ['/board', '/sports', '/value-bets', '/results', '/bookmakers'].includes(n.href));
</script>

<header class="safe-top sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur-xl">
	<div class="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
		<a href="/" aria-label="PuntersEdge home" class="rounded-xl"><Logo size={34} /></a>

		<nav class="ml-4 hidden items-center gap-1 text-sm xl:flex" aria-label="Main">
			{#each desktopLinks as l (l.href)}
				{@const active = isActive(page.url.pathname, l.href, l.also)}
				<a
					href={l.href}
					aria-current={active ? 'page' : undefined}
					class="rounded-full px-3 py-1.5 font-medium transition-colors {active ? 'bg-raised text-chalk ring-1 ring-line' : 'text-haze hover:text-chalk'}"
				>
					<span aria-hidden="true">{l.emoji}</span> {l.label}
				</a>
			{/each}
		</nav>

		<div class="ml-auto flex items-center gap-2">
			<button
				onclick={() => theme.toggle()}
				class="grid h-10 w-10 place-items-center rounded-full bg-raised text-lg ring-1 ring-line transition-transform hover:ring-pop active:scale-90"
				aria-label="Switch to {theme.resolved === 'dark' ? 'light' : 'dark'} mode"
				title="Switch to {theme.resolved === 'dark' ? 'light' : 'dark'} mode"
			>
				<span aria-hidden="true">{theme.resolved === 'dark' ? '☀️' : '🌙'}</span>
			</button>

			{#if auth.signedIn}
				<a href="/account" class="hidden h-10 items-center gap-2 rounded-full bg-raised pl-1 pr-3 ring-1 ring-line hover:ring-pop sm:inline-flex" aria-label="Your account">
					<span class="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-pop to-model font-display font-bold text-ink">{auth.initial}</span>
					<span class="max-w-[8rem] truncate text-sm font-medium text-chalk">{auth.displayName}</span>
				</a>
			{:else if auth.status === 'signedOut'}
				<a href="/login" class="hidden h-10 items-center rounded-full px-4 text-sm font-semibold text-chalk ring-1 ring-line hover:ring-pop sm:inline-flex">Log in</a>
			{/if}

			<button onclick={() => (app.slipOpen = true)} class="hidden h-10 items-center gap-2 rounded-full bg-chalk px-4 text-sm font-semibold text-ink md:inline-flex">
				<ReceiptText class="h-4 w-4" /> Slip
				{#if app.slip.length}<span class="grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-xs text-chalk">{app.slip.length}</span>{/if}
			</button>

			<button
				onclick={() => (app.menuOpen = true)}
				class="grid h-10 w-10 place-items-center rounded-full bg-raised text-chalk ring-1 ring-line hover:ring-pop"
				aria-label="Open menu"
				aria-expanded={app.menuOpen}
				aria-haspopup="dialog"
			>
				<Menu class="h-5 w-5" />
			</button>
		</div>
	</div>
</header>
