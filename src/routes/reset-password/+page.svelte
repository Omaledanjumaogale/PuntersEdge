<script lang="ts">
  import {browser} from '$app/env';
  import { page } from '$app/state';
  import { auth, PASSWORD_RULE } from '#lib/auth.svelte.ts';
  import AuthShell from '#lib/components/AuthShell.svelte';
  import PasswordField from '#lib/components/PasswordField.svelte';
  let email = $state('');
  let password = $state('');
  let busy = $state(false);
  let message = $state('');
  let error = $state('');
  const token = $derived(browser?page.url.searchParams.get('token'):null);
  async function submit(event: SubmitEvent) {
    event.preventDefault(); busy = true; error = ''; message = '';
    try {
      if (token) { await auth.resetPassword(token, password); message = 'Password updated. You can log in now.'; }
      else { await auth.requestPasswordReset(email); message = 'If an account exists, a reset link will arrive in your email.'; }
    } catch (reason) { error = (reason as Error).message; }
    finally { busy = false; }
  }
</script>
<svelte:head><title>Reset password — PuntersEdge</title><meta name="robots" content="noindex" /></svelte:head>
<AuthShell title="Reset your password" subtitle="Recover access securely through your email.">
  <form onsubmit={submit} class="grid gap-4">
    {#if token}
      <label for="reset-password">New password</label>
      <PasswordField id="reset-password" bind:value={password} autocomplete="new-password" />
      <p class="text-sm text-muted">{PASSWORD_RULE}</p>
    {:else}
      <label for="reset-email">Email address</label>
      <input class="field" id="reset-email" type="email" bind:value={email} autocomplete="email" required />
    {/if}
    {#if message}<p role="status">{message}</p>{/if}
    {#if error}<p role="alert" class="text-loss">{error}</p>{/if}
    <button class="btn-primary" disabled={busy}>{busy ? 'Please wait…' : token ? 'Update password' : 'Send reset link'}</button>
    <a href="/login" class="text-model">Back to login</a>
  </form>
{#snippet footer()}Keep your reset link private.{/snippet}
</AuthShell>
