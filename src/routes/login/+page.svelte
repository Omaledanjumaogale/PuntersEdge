<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { auth } from '#lib/auth.svelte.ts';
	import AuthShell from '#lib/components/AuthShell.svelte';
	import PasswordField from '#lib/components/PasswordField.svelte';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let busy = $state(false);

	const next = $derived(page.url.searchParams.get('next')?.startsWith('/') ? page.url.searchParams.get('next')! : '/account');

	$effect(() => {
		if (auth.signedIn && !busy) goto(next, { replaceState: true });
	});

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		busy = true;
		try {
			await auth.logIn({ email, password });
			await goto(next);
		} catch (err) {
			error = (err as Error).message;
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Log in — PuntersEdge</title></svelte:head>

<AuthShell title="Welcome back 👋" subtitle="Log in to pick up your slip where you left it.">
	<form onsubmit={submit} class="grid gap-4" novalidate>
		<label class="grid gap-1.5" for="login-email">
			<span class="text-sm font-semibold text-chalk">Email</span>
			<div class="field">
				<span aria-hidden="true">📧</span>
				<input id="login-email" type="email" bind:value={email} autocomplete="email" inputmode="email" required placeholder="you@example.com" />
			</div>
		</label>
		<div class="grid gap-1.5">
			<label for="login-password" class="text-sm font-semibold text-chalk">Password</label>
			<PasswordField id="login-password" bind:value={password} autocomplete="current-password" />
		</div>

		{#if error}
			<p class="rounded-xl tint-loss px-3 py-2 text-sm font-medium text-chalk ring-1 ring-loss/60" role="alert">⚠️ {error}</p>
		{/if}

		<button type="submit" class="btn-primary w-full text-base" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
	</form>
	{#snippet footer()}
		New here? <a href="/signup{next !== '/account' ? `?next=${encodeURIComponent(next)}` : ''}" class="font-semibold text-pop underline underline-offset-4">Create an account</a>
	{/snippet}
</AuthShell>
