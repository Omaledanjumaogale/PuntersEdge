<script lang="ts">
    import {browser} from '$app/env';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { auth } from '#lib/auth.svelte.ts';
 import {accountReturnPath} from '#lib/auth-redirect.js';
	import AuthShell from '#lib/components/AuthShell.svelte';
	import PasswordField from '#lib/components/PasswordField.svelte';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let busy = $state(false);
 let code=$state(''),backup=$state(false),notice=$state('');
 async function resend(){if(!email.trim()){error='Enter your personal email first.';return;}busy=true;error='';try{await auth.resendVerification(email,next);notice='If this account needs verification, a message has been requested. Check your inbox and spam folder.';}catch(e){error=(e as Error).message;}finally{busy=false;}}
 async function secondFactor(){busy=true;error='';try{await auth.verifyMfa(code,backup);await goto(next);}catch(e){error=(e as Error).message;}finally{busy=false;}}

	const next = $derived(accountReturnPath(browser?page.url.searchParams.get('next'):null));

	$effect(() => {
		if (auth.signedIn && !busy) goto(next, { replaceState: true });
	});

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		busy = true;
		try {
			await auth.logIn({ email, password });
			if(!auth.twoFactorPending)await goto(next);
		} catch (err) {
			error = (err as Error).message;
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Log in — PuntersEdge</title></svelte:head>

<AuthShell title="Welcome back 👋" subtitle="Log in to pick up your slip where you left it.">
 <aside class="mb-5 rounded-xl bg-raised p-4 text-sm"><strong>Have tester invitation credentials?</strong><p class="mt-1 text-haze">Activate them with your own verified personal account. Use your personal email and password in this sign-in form.</p><a class="btn-ghost mt-3 inline-flex" href="/tester">Activate tester invitation →</a></aside>
 {#if auth.twoFactorPending}<form class="grid gap-4" onsubmit={e=>{e.preventDefault();void secondFactor();}}><label for="mfa-code">{backup?'Recovery code':'Authenticator code'}</label><input id="mfa-code" class="field" bind:value={code} autocomplete="one-time-code" inputmode={backup?'text':'numeric'}/><label><input type="checkbox" bind:checked={backup}/> Use a saved recovery code</label><button class="btn-primary" disabled={busy}>Verify and sign in</button>{#if error}<p role="alert" class="text-loss">{error}</p>{/if}</form>{:else}
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
		<a href="/reset-password" class="text-center text-sm text-model">Forgot your password?</a>
<button type="button" class="btn-ghost" disabled={busy} onclick={resend}>Resend verification email</button>{#if notice}<p role="status" class="text-sm text-model">{notice}</p>{/if}
	</form>{/if}
	{#snippet footer()}
		New here? <a href="/signup{next !== '/account' ? `?next=${encodeURIComponent(next)}` : ''}" class="font-semibold text-pop underline underline-offset-4">Create an account</a>
	{/snippet}
</AuthShell>
