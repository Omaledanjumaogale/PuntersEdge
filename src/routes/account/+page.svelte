<script lang="ts">
	import { goto } from '$app/navigation';
	import { app } from '#lib/state.svelte.ts';
	import { auth } from '#lib/auth.svelte.ts';
	import { ngn } from '#lib/format.ts';

	let name = $state('');
	let saved = $state(false);
	let busy = $state(false);

	$effect(() => {
		if (auth.status === 'signedOut') goto('/login?next=/account', { replaceState: true });
	});
	$effect(() => {
		if (auth.viewer && !name) name = auth.viewer.name ?? '';
	});

	const joined = $derived(auth.viewer ? new Date(auth.viewer.joined).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

	async function saveName(e: SubmitEvent) {
		e.preventDefault();
		await auth.updateName(name);
		saved = true;
		setTimeout(() => (saved = false), 1800);
	}

	async function logOut() {
		busy = true;
		await auth.logOut();
		await goto('/');
	}
</script>

<svelte:head><title>Your account — PuntersEdge</title></svelte:head>

{#if auth.status === 'loading'}
	<p class="py-20 text-center text-haze">Loading your account…</p>
{:else if auth.signedIn}
	<div class="mx-auto grid max-w-2xl gap-5">
		<header class="flex items-center gap-4">
			<span class="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-pop to-model font-display text-3xl font-extrabold text-ink" style="animation: pop-in 400ms var(--ease-spring)">{auth.initial}</span>
			<div class="min-w-0">
				<h1 class="truncate text-3xl font-extrabold text-chalk">Hey, {auth.displayName} 👋</h1>
				<p class="truncate text-haze">{auth.viewer?.email}</p>
				<p class="text-sm text-haze">Joined {joined}</p>
			</div>
		</header>

		<section class="grid grid-cols-3 gap-3" aria-label="Your numbers">
			<div class="surface p-4"><p class="text-sm text-haze">🧾 In slip</p><p class="font-display text-2xl font-bold text-chalk">{app.slip.length}</p></div>
			<div class="surface p-4"><p class="text-sm text-haze">💰 Bankroll</p><p class="font-display text-2xl font-bold text-chalk">{ngn(app.settings.bankroll)}</p></div>
			<div class="surface p-4"><p class="text-sm text-haze">🔥 Value bets</p><p class="font-display text-2xl font-bold text-chalk">{app.valueBets.length}</p></div>
		</section>

		<form class="surface grid gap-3 p-5" onsubmit={saveName}>
			<label for="acct-name" class="text-lg font-semibold text-chalk">Display name</label>
			<div class="flex gap-2">
				<div class="field flex-1"><span aria-hidden="true">😎</span><input id="acct-name" bind:value={name} maxlength="40" autocomplete="nickname" /></div>
				<button class="btn-primary shrink-0" type="submit">{saved ? 'Saved ✓' : 'Save'}</button>
			</div>
		</form>

		<section class="surface flex flex-wrap items-center justify-between gap-3 p-5">
			<div>
				<h2 class="text-lg font-semibold text-chalk">Preferences</h2>
				<p class="text-sm text-haze">Bankroll, stake sizing, theme and motion.</p>
			</div>
			<a href="/settings" class="btn-ghost">⚙️ Open settings</a>
		</section>

		<button onclick={logOut} disabled={busy} class="btn-ghost justify-self-start text-loss">🚪 {busy ? 'Logging out…' : 'Log out'}</button>
		{#if auth.mode === 'demo'}
			<p class="text-sm text-haze">🧪 Preview mode: this account exists on this device only.</p>
		{/if}
	</div>
{/if}
