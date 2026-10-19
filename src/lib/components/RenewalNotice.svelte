<script lang="ts">
 import {auth} from '#lib/auth.svelte.ts';import {app} from '#lib/state.svelte.ts';
 const expiry=$derived(auth.viewer?.accessExpiresAt??null);
 const expired=$derived(!!expiry&&expiry<=app.now);
 const due=$derived(!!expiry&&expiry>app.now&&expiry-app.now<=3*86400000);
</script>
{#if auth.signedIn&&!auth.viewer?.superAdmin&&auth.viewer?.accountStatus==='active'&&(expired||due)}
<aside class="mb-5 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-line tint-book p-4" aria-label="Membership renewal"><div class="min-w-0"><p class="font-semibold text-book">{expired?'Your access has expired':'Your access expires soon'}</p><p class="mt-1 text-sm text-haze">{expired?'Renew your membership to restore full analysis and saved-ticket tools.':`Access ends ${new Date(expiry!).toLocaleString('en-NG',{timeZone:'Africa/Lagos',dateStyle:'medium',timeStyle:'short'})} WAT. Renew before expiry.`} Paid subscription renewals preserve remaining paid time.</p></div><a class="btn-primary" href="/subscribe">Renew membership</a></aside>
{/if}
