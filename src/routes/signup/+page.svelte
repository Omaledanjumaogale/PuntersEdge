<script lang="ts">
    import {browser} from '$app/env';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { auth, passwordStrength, PASSWORD_RULE } from '#lib/auth.svelte.ts';
 import {accountReturnPath} from '#lib/auth-redirect.js';
	import AuthShell from '#lib/components/AuthShell.svelte';
	import PasswordField from '#lib/components/PasswordField.svelte';

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let adult = $state(false);
	let error = $state('');
	let busy = $state(false);
	let verificationSent = $state(false);

	const next = $derived(accountReturnPath(browser?page.url.searchParams.get('next'):null));
	const strength = $derived(passwordStrength(password));
	const strengthLabel = ['Too short', 'Okay', 'Good', 'Strong', 'Excellent'];
	const strengthTone = ['bg-loss', 'bg-book', 'bg-model', 'bg-model', 'bg-pop'];

	$effect(() => {
		if (auth.signedIn && !busy) goto(next, { replaceState: true });
	});

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		if (!adult) {
			error = 'You need to be 18 or older to use PuntersEdge.';
			return;
		}
		busy = true;
		try {
			await auth.signUp({ name, email, password },next);
			verificationSent = true;
		} catch (err) {
			error = (err as Error).message;
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Sign up — PuntersEdge</title></svelte:head>

<AuthShell title="Join PuntersEdge ⚡" subtitle="Free account. Save your slip, bankroll and settings everywhere.">
	{#if verificationSent}<p class="rounded-xl tint-model p-4" role="status">Check your email to verify your account before logging in.</p>{/if}
	<form onsubmit={submit} class="grid gap-4" novalidate>
		<label class="grid gap-1.5" for="signup-name">
			<span class="text-sm font-semibold text-chalk">What should we call you?</span>
			<div class="field">
				<span aria-hidden="true">😎</span>
				<input id="signup-name" type="text" bind:value={name} autocomplete="nickname" maxlength="40" placeholder="Nickname" />
			</div>
		</label>
		<label class="grid gap-1.5" for="signup-email">
			<span class="text-sm font-semibold text-chalk">Email</span>
			<div class="field">
				<span aria-hidden="true">📧</span>
				<input id="signup-email" type="email" bind:value={email} autocomplete="email" inputmode="email" required placeholder="you@example.com" />
			</div>
		</label>
		<div class="grid gap-1.5">
			<label for="signup-password" class="text-sm font-semibold text-chalk">Password</label>
			<PasswordField id="signup-password" bind:value={password} autocomplete="new-password" describedby="pw-rule" />
			<div class="flex items-center gap-2" aria-live="polite">
				<div class="flex flex-1 gap-1" aria-hidden="true">
					{#each Array(4) as _, i}
						<span class="h-1.5 flex-1 rounded-full transition-colors {password && i < Math.max(1, strength) ? strengthTone[strength] : 'bg-line'}"></span>
					{/each}
				</div>
				{#if password}<span class="text-xs font-semibold text-chalk">{strengthLabel[strength]}</span>{/if}
			</div>
			<p id="pw-rule" class="text-xs text-haze">{PASSWORD_RULE}</p>
		</div>

		<label class="flex items-start gap-3 text-sm text-chalk">
			<input type="checkbox" bind:checked={adult} class="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-pop)]" />
			<span>I'm 18 or older and understand betting carries risk.</span>
		</label>

		{#if error}
			<p class="rounded-xl tint-loss px-3 py-2 text-sm font-medium text-chalk ring-1 ring-loss/60" role="alert">⚠️ {error}</p>
		{/if}

		<p class="text-xs text-haze">We use account details as described in our <a href="/privacy" class="text-model underline">privacy and retention policy</a>.</p>
		<button type="submit" class="btn-primary w-full text-base" disabled={busy}>{busy ? 'Creating your account…' : 'Create account'}</button>
	</form>
	{#snippet footer()}
		Already have an account? <a href="/login{next !== '/account' ? `?next=${encodeURIComponent(next)}` : ''}" class="font-semibold text-pop underline underline-offset-4">Log in</a>
	{/snippet}
</AuthShell>
