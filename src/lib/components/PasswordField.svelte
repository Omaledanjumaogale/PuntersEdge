<script lang="ts">
	import { Eye, EyeOff } from 'lucide-svelte';
	let {
		value = $bindable(''),
		id,
		autocomplete,
		describedby
	}: { value?: string; id: string; autocomplete: 'current-password' | 'new-password'; describedby?: string } = $props();
	let show = $state(false);
</script>

<div class="field">
	<span aria-hidden="true">🔑</span>
	<input {id} type={show ? 'text' : 'password'} bind:value {autocomplete} required minlength="8" aria-describedby={describedby} placeholder="••••••••" />
	<button type="button" onclick={() => (show = !show)} class="rounded-lg p-1.5 text-haze hover:text-chalk" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
		{#if show}<EyeOff class="h-4 w-4" />{:else}<Eye class="h-4 w-4" />{/if}
	</button>
</div>
