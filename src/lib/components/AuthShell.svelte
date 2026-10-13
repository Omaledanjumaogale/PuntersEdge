<script lang="ts">
	import type { Snippet } from 'svelte';
	import { auth } from '#lib/auth.svelte.ts';
	import AuthArt from './AuthArt.svelte';

	let { title, subtitle, children, footer }: { title: string; subtitle: string; children: Snippet; footer: Snippet } = $props();
</script>

<div class="mx-auto grid max-w-5xl items-center gap-8 md:grid-cols-[1fr_1.05fr]">
	<aside class="order-2 hidden md:order-1 md:block">
		<AuthArt />
		<ul class="mt-6 grid gap-3 text-[15px] text-chalk">
			<li class="flex gap-3"><span aria-hidden="true">🧾</span> Your slip follows you to every device.</li>
			<li class="flex gap-3"><span aria-hidden="true">💰</span> Bankroll and stake settings saved to your account.</li>
			<li class="flex gap-3"><span aria-hidden="true">🔒</span> Passwords are hashed; we never see them.</li>
		</ul>
	</aside>

	<section class="surface order-1 p-6 sm:p-8 md:order-2">
		<div class="mx-auto mb-4 w-40 md:hidden"><AuthArt /></div>
		<h1 class="text-3xl font-extrabold text-chalk sm:text-4xl">{title}</h1>
		<p class="mt-2 text-haze">{subtitle}</p>

		{#if auth.mode === 'demo'}
			<p class="mt-4 rounded-xl tint-book px-3 py-2 text-sm text-chalk ring-1 ring-book/50" role="note">
				Account services are unavailable until the backend is configured.
			</p>
		{/if}

		<div class="mt-6">{@render children()}</div>
		<div class="mt-6 border-t border-line pt-4 text-center text-sm text-haze">{@render footer()}</div>
	</section>
</div>
