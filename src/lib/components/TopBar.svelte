<script lang="ts">
	import { anyApi } from 'convex/server';
	import { page } from '$app/state';
	import { app } from '#lib/state.svelte.ts';
	import { auth } from '#lib/auth.svelte.ts';
	import { theme } from '#lib/theme.svelte.ts';
	import Logo from './Logo.svelte';
	import ProfileAvatar from './ProfileAvatar.svelte';
	import { Menu, ReceiptText } from 'lucide-svelte';

	let isSuperAdmin = $state(false);
	$effect(() => {
		const client = auth.client;
		isSuperAdmin = false;
		if (!client) return;
		return client.onUpdate(anyApi.admin.status, {}, (status: { isSuperAdmin: boolean }) => { isSuperAdmin = status.isSuperAdmin === true; });
	});

</script>

<header class="safe-top sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur-xl">
	<div class="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
		<a href="/" aria-label="PuntersEdge home" class="rounded-xl"><Logo size={34} /></a>


		<div class="ml-auto flex items-center gap-2">
			{#if isSuperAdmin}
				<a href={page.url.pathname.startsWith('/admin') ? '/board' : '/admin'} class="inline-flex min-h-10 items-center rounded-full bg-pop px-3 text-xs font-semibold text-ink">{page.url.pathname.startsWith('/admin') ? 'User view' : 'Admin'}</a>
			{/if}
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
					<ProfileAvatar size={32}/>
					<span class="max-w-[8rem] truncate text-sm font-medium text-chalk">{auth.displayName}</span>
				</a>
			{:else if auth.status === 'signedOut'}
				<a href="/login" class="hidden h-10 items-center rounded-full px-4 text-sm font-semibold text-chalk ring-1 ring-line hover:ring-pop sm:inline-flex">Log in</a>
			{/if}

			{#if !page.url.pathname.startsWith('/admin')}<button onclick={() => (app.slipOpen = true)} class="hidden h-10 items-center gap-2 rounded-full bg-chalk px-4 text-sm font-semibold text-ink md:inline-flex">
				<ReceiptText class="h-4 w-4" /> Slip
				{#if app.slip.length}<span class="grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-xs text-chalk">{app.slip.length}</span>{/if}
			</button>{/if}

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
