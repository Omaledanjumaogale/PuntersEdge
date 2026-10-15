<script lang="ts">
	import { anyApi } from 'convex/server';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { app } from '#lib/state.svelte.ts';
	import { auth } from '#lib/auth.svelte.ts';
	import { pwa } from '#lib/pwa.svelte.ts';
	import { theme } from '#lib/theme.svelte.ts';
	import { NAV, isActive, ADMIN_NAV, adminActive } from '#lib/nav.ts';
	import ProfileAvatar from './ProfileAvatar.svelte';
	import Logo from './Logo.svelte';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { toast } from '#lib/toast.svelte.ts';
	import { X, LogOut } from 'lucide-svelte';

	let isSuperAdmin = $state(false);
	$effect(() => {
		const client = auth.client;
		isSuperAdmin = false;
		if (!client) return;
		return client.onUpdate(anyApi.admin.status, {}, (status: { isSuperAdmin: boolean }) => { isSuperAdmin = status.isSuperAdmin === true; });
	});
	let panel = $state<HTMLElement>();
	let busy = $state(false);

	const themes = [
		{ value: 'light', label: 'Light', emoji: '☀️' },
		{ value: 'dark', label: 'Dark', emoji: '🌙' },
		{ value: 'system', label: 'Auto', emoji: '📱' }
	] as const;

	function close() {
		app.menuOpen = false;
	}

	async function logOut() {
		busy = true;
		try {
			if (pwa.pushEnabled) await pwa.disableNotifications();
			await auth.logOut();
			close();
			await goto('/');
			toast.success('You are logged out.');
		} catch { toast.error('Could not log out. Please try again.'); }
		finally { busy = false; }
	}

	// Close on navigation; focus the panel when it opens.
	$effect(() => {
		void page.url.pathname;
		app.menuOpen = false;
	});
	$effect(() => {
		if (!app.menuOpen) return;
		const previous = document.activeElement as HTMLElement | null;
		const overflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		queueMicrotask(() => panel?.focus());
		return () => { document.body.style.overflow = overflow; previous?.focus(); };
	});

	function onkey(e: KeyboardEvent) {
		if (!app.menuOpen) return;
		if (e.key === 'Escape') { e.preventDefault(); close(); }
		if (e.key === 'Tab' && panel) {
			const controls = [...panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex="0"]')];
			const first = controls[0], last = controls.at(-1);
			if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last?.focus(); }
			else if (!e.shiftKey && (document.activeElement === last || document.activeElement === panel)) { e.preventDefault(); first?.focus(); }
		}
	}
</script>

<svelte:window onkeydown={onkey} />

{#if app.menuOpen}
	<div class="fixed inset-0 z-[55] bg-ink/70 backdrop-blur-sm" transition:fade={{ duration: 160 }} onclick={close} aria-hidden="true"></div>
	<div
		bind:this={panel}
		tabindex="-1"
		role="dialog"
		aria-modal="true"
		aria-label="Menu"
		transition:fly={{ x: 320, duration: 320, easing: cubicOut }}
		class="safe-top safe-bottom fixed inset-y-0 right-0 z-[60] flex w-[min(22rem,92vw)] flex-col gap-5 overflow-y-auto border-l border-line bg-deep p-5 outline-none"
	>
		<div class="flex items-center justify-between">
			<Logo size={30} />
			<button onclick={close} class="grid h-10 w-10 place-items-center rounded-full bg-raised text-chalk ring-1 ring-line hover:ring-pop" aria-label="Close menu">
				<X class="h-5 w-5" />
			</button>
		</div>

		<!-- Account -->
		<section class="rounded-[var(--radius-card)] bg-raised p-4 ring-1 ring-line" aria-label="Account">
			{#if auth.signedIn}
				<a href="/account" class="flex items-center gap-3">
					<ProfileAvatar size={48}/>
					<span class="min-w-0">
						<span class="block truncate font-semibold text-chalk">{auth.displayName}</span>
						<span class="block truncate text-sm text-haze">{auth.viewer?.email}</span>
					</span>
				</a>
			{:else}
				<p class="font-semibold text-chalk">👋 Join the squad</p>
				<p class="mt-1 text-sm text-haze">Save your slip and settings across devices.</p>
				<div class="mt-3 grid grid-cols-2 gap-2">
					<a href="/login" class="btn-ghost text-sm">Log in</a>
					<a href="/signup" class="btn-primary text-sm">Sign up</a>
				</div>
			{/if}
		</section>

		{#if isSuperAdmin}
			<a href={page.url.pathname.startsWith('/admin') ? '/board' : '/admin'} class="btn-primary">{page.url.pathname.startsWith('/admin') ? 'Switch to user view' : 'Open admin console'}</a>
			<nav class="drawer-admin" aria-label="Administration"><p class="text-xs font-semibold uppercase tracking-widest text-haze">Administration</p>{#each ADMIN_NAV as item}<a href={item.href} aria-current={adminActive(page.url.pathname,page.url.search,item.section)?'page':undefined}><span aria-hidden="true">{item.emoji}</span><span><strong>{item.label}</strong><small>{item.hint}</small></span></a>{/each}</nav>
		{/if}
		<!-- Navigation -->
		<nav aria-label="Main" class="grid gap-3">
			<ul class="grid grid-cols-5 gap-1.5" aria-label="Sports">
				{#each NAV.filter((n) => n.group === 'sport') as item (item.href)}
					{@const active = isActive(page.url.pathname, item.href)}
					<li>
						<a
							href={item.href}
							aria-current={active ? 'page' : undefined}
							class="flex flex-col items-center gap-1 rounded-2xl px-1 py-2.5 text-center ring-1 transition-colors {active ? 'tint-pop ring-pop' : 'bg-ink ring-line hover:ring-pop'}"
						>
							<span class="text-2xl leading-none" aria-hidden="true">{item.emoji}</span>
							<span class="text-[11px] font-semibold leading-tight text-chalk">{item.label}</span>
						</a>
					</li>
				{/each}
			</ul>
			<ul class="grid grid-cols-2 gap-2">
				{#each NAV.filter((n) => n.group !== 'sport') as item (item.href)}
					{@const active = isActive(page.url.pathname, item.href, item.also)}
					<li>
						<a
							href={item.href}
							aria-current={active ? 'page' : undefined}
							class="flex h-full flex-col gap-1 rounded-2xl p-3 ring-1 transition-colors {active ? 'tint-pop ring-pop' : 'bg-ink ring-line hover:ring-pop'}"
						>
							<span class="text-2xl leading-none" aria-hidden="true">{item.emoji}</span>
							<span class="font-semibold text-chalk">{item.label}</span>
							<span class="text-xs text-haze">{item.hint}</span>
						</a>
					</li>
				{/each}
				<li class="col-span-2">
					<button onclick={() => ((app.slipOpen = true), close())} class="flex w-full items-center justify-between rounded-2xl bg-ink p-3 ring-1 ring-line hover:ring-pop">
						<span class="flex items-center gap-2 font-semibold text-chalk"><span class="text-2xl" aria-hidden="true">🧾</span> Betslip</span>
						<span class="rounded-full bg-raised px-2.5 py-0.5 text-sm text-chalk ring-1 ring-line">{app.slip.length} {app.slip.length === 1 ? "pick" : "picks"}</span>
					</button>
				</li>
			</ul>
		</nav>

		<!-- Theme -->
		<section aria-labelledby="menu-theme">
			<h2 id="menu-theme" class="text-sm font-semibold text-haze">Theme</h2>
			<div class="mt-2 grid grid-cols-3 gap-1 rounded-full bg-ink p-1 ring-1 ring-line" role="radiogroup" aria-labelledby="menu-theme">
				{#each themes as t (t.value)}
					<button
						role="radio"
						aria-checked={app.settings.theme === t.value}
						onclick={() => (app.settings.theme = t.value)}
						class="rounded-full py-2 text-sm font-medium transition-colors {app.settings.theme === t.value ? 'bg-raised text-chalk ring-1 ring-pop' : 'text-haze hover:text-chalk'}"
					>
						<span aria-hidden="true">{t.emoji}</span> {t.label}
					</button>
				{/each}
			</div>
			<p class="mt-1.5 text-xs text-haze">Showing {theme.resolved} mode.</p>
		</section>

		<section class="rounded-2xl bg-raised p-4 ring-1 ring-line" aria-labelledby="menu-notifications">
			<h2 id="menu-notifications" class="text-sm font-semibold">Device notifications</h2>
			<p class="mt-1 text-xs text-haze">Get result updates even when the app is closed. An active subscription is required.</p>
			{#if pwa.pushEnabled}
				<button class="btn-ghost mt-3 w-full" disabled={pwa.pushBusy} onclick={() => pwa.disableNotifications()}>Disable background alerts</button>
			{/if}
			{#if pwa.notificationPermission === 'granted'}
				<button class="btn-ghost mt-3 w-full" onclick={() => pwa.notify('PuntersEdge test alert', 'Your device notifications are working.').catch(() => toast.error('Could not show the test alert.'))}>Send test alert</button>
			{/if}
			{#if !pwa.pushEnabled && (pwa.notificationPermission === 'default' || pwa.notificationPermission === 'granted')}
				<button class="btn-ghost mt-3 w-full" disabled={pwa.pushBusy || !auth.signedIn} onclick={() => pwa.enableNotifications()}>{pwa.pushBusy ? 'Enabling…' : 'Enable background alerts'}</button>
				{#if !auth.signedIn}<p class="mt-2 text-xs text-haze">Log in to enable background notifications.</p>{/if}
			{:else if pwa.notificationPermission === 'denied'}<p class="mt-2 text-xs text-haze">Blocked in browser settings. Allow notifications there to enable alerts.</p>
			{:else if pwa.notificationPermission === 'unsupported'}<p class="mt-2 text-xs text-haze">Your browser does not support device notifications here.</p>{/if}
		</section>

		<div class="mt-auto grid gap-2">
			{#if pwa.canInstall}
				<button onclick={() => pwa.install()} class="btn-ghost w-full">📲 Install the app</button>
			{/if}
			{#if auth.signedIn}
				<button onclick={logOut} disabled={busy} class="btn-ghost w-full text-loss">
					<LogOut class="h-4 w-4" /> {busy ? 'Logging out…' : 'Log out'}
				</button>
			{/if}
			<p class="text-center text-xs text-haze">18+ only. Bet with your head, not over it.</p>
		</div>
	</div>
{/if}
