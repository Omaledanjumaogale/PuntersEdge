<script lang="ts">
	import { app } from '#lib/state.svelte.ts';
	import { pwa } from '#lib/pwa.svelte.ts';
	import { ngn } from '#lib/format.ts';
	import { auth } from '#lib/auth.svelte.ts';
	import { theme } from '#lib/theme.svelte.ts';

	const themes = [
		{ value: 'light', label: 'Light', emoji: '☀️' },
		{ value: 'dark', label: 'Dark', emoji: '🌙' },
		{ value: 'system', label: 'Match my phone', emoji: '📱' }
	] as const;

	const kellyOptions = [
		{ value: 0.125, label: '⅛ Kelly', note: 'Very cautious' },
		{ value: 0.25, label: '¼ Kelly', note: 'Recommended' },
		{ value: 0.5, label: '½ Kelly', note: 'Aggressive' }
	];
</script>

<svelte:head><title>Settings — PuntersEdge</title></svelte:head>

<header class="max-w-2xl">
	<h1 class="text-4xl font-extrabold text-chalk">⚙️ Settings</h1>
	<p class="mt-2 text-haze">Saved on this device. Changes reprice every fixture instantly.</p>
</header>

<div class="mt-8 grid max-w-2xl gap-5">
	<section class="surface flex flex-wrap items-center justify-between gap-4 p-5" aria-labelledby="acct-title">
		<div class="flex items-center gap-3">
			<span class="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-pop to-model font-display text-xl font-bold text-ink" aria-hidden="true">{auth.signedIn ? auth.initial : '👤'}</span>
			<div>
				<h2 id="acct-title" class="text-lg font-bold text-chalk">{auth.signedIn ? auth.displayName : 'Not logged in'}</h2>
				<p class="text-sm text-haze">{auth.signedIn ? auth.viewer?.email : 'Log in to sync your slip across devices.'}</p>
			</div>
		</div>
		{#if auth.signedIn}
			<a href="/account" class="btn-ghost text-sm">Manage account</a>
		{:else}
			<div class="flex gap-2"><a href="/login" class="btn-ghost text-sm">Log in</a><a href="/signup" class="btn-primary text-sm">Sign up</a></div>
		{/if}
	</section>

	<section class="surface p-5" aria-labelledby="theme-title">
		<h2 id="theme-title" class="text-lg font-bold text-chalk">🎨 Theme</h2>
		<div class="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="theme-title">
			{#each themes as t (t.value)}
				<button
					role="radio"
					aria-checked={app.settings.theme === t.value}
					onclick={() => (app.settings.theme = t.value)}
					class="flex flex-col items-start gap-1 rounded-xl px-3 py-3 text-left ring-1 transition-colors {app.settings.theme === t.value ? 'tint-pop ring-pop' : 'bg-ink ring-line hover:ring-haze'}"
				>
					<span class="text-xl" aria-hidden="true">{t.emoji}</span>
					<span class="text-sm font-semibold text-chalk">{t.label}</span>
				</button>
			{/each}
		</div>
		<p class="mt-2 text-sm text-haze">Currently {theme.resolved}.</p>
	</section>

	<section class="surface p-5" aria-labelledby="bankroll-title">
		<h2 id="bankroll-title" class="text-lg font-bold text-chalk">💰 Bankroll</h2>
		<p class="mt-1 text-sm text-haze">Money set aside for betting only. Stakes are sized as a share of it.</p>
		<div class="field mt-3">
			<span class="font-semibold text-haze">₦</span>
			<input type="number" inputmode="numeric" min="0" step="1000" bind:value={app.settings.bankroll} aria-labelledby="bankroll-title" class="text-lg" />
		</div>
		<p class="mt-2 text-sm text-haze">A 2% stake is {ngn(app.stakeFor(2))}.</p>
	</section>

	<section class="surface p-5" aria-labelledby="kelly-title">
		<h2 id="kelly-title" class="text-lg font-bold text-chalk">📏 Stake sizing</h2>
		<p class="mt-1 text-sm text-haze">Fraction of the Kelly criterion. Smaller fractions grow slower but survive model error. Single stakes are capped at 3.5%.</p>
		<div class="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="kelly-title">
			{#each kellyOptions as k}
				<button
					role="radio"
					aria-checked={app.settings.kellyFraction === k.value}
					onclick={() => (app.settings.kellyFraction = k.value)}
					class="rounded-xl px-3 py-3 text-left ring-1 transition-colors {app.settings.kellyFraction === k.value ? 'tint-pop ring-pop' : 'bg-ink ring-line hover:ring-haze'}"
				>
					<span class="block font-semibold text-chalk">{k.label}</span>
					<span class="text-xs text-haze">{k.note}</span>
				</button>
			{/each}
		</div>
	</section>

	<section class="surface p-5" aria-labelledby="weight-title">
		<h2 id="weight-title" class="text-lg font-bold text-chalk">⚖️ Model vs market</h2>
		<p class="mt-1 text-sm text-haze">
			How much to trust the model over the de-vigged bookmaker consensus. At 0% you'd find no edges; at 100% every model error looks like value.
		</p>
		<input type="range" min="0" max="1" step="0.05" bind:value={app.settings.modelWeight} aria-labelledby="weight-title" class="mt-4 w-full accent-[var(--color-model)]" />
		<div class="mt-1 flex justify-between text-sm">
			<span class="text-haze">Market</span>
			<span><span class="text-model">{Math.round(app.settings.modelWeight * 100)}%</span> model, {app.valueBets.length} value bets</span>
			<span class="text-haze">Model</span>
		</div>
	</section>

	<section class="surface p-5" aria-labelledby="motion-title">
		<div class="flex items-center justify-between gap-4">
			<div>
				<h2 id="motion-title" class="text-lg font-bold text-chalk">✨ 3D and motion</h2>
				<p class="mt-1 text-sm text-haze">Animated score surface, card tilt and page transitions.</p>
			</div>
			<button
				role="switch"
				aria-checked={app.settings.motion}
				aria-labelledby="motion-title"
				onclick={() => (app.settings.motion = !app.settings.motion)}
				class="relative h-7 w-12 shrink-0 rounded-full transition-colors {app.settings.motion ? 'bg-pop' : 'bg-line'}"
			>
				<span class="absolute top-1 h-5 w-5 rounded-full bg-chalk transition-[left] {app.settings.motion ? 'left-6' : 'left-1'}"></span>
			</button>
		</div>
	</section>

	<section class="surface p-5" aria-labelledby="app-title">
		<h2 id="app-title" class="text-lg font-bold text-chalk">📲 App</h2>
		{#if pwa.installed}
			<p class="mt-1 text-sm text-haze">Installed. PuntersEdge works offline with the last prices it loaded.</p>
		{:else if pwa.canInstall}
			<p class="mt-1 text-sm text-haze">Install for a full-screen app that opens from your home screen and works offline.</p>
			<button onclick={() => pwa.install()} class="btn-primary mt-3">📲 Install PuntersEdge</button>
		{:else if pwa.isIOS}
			<p class="mt-1 text-sm text-haze">In Safari, tap Share, then Add to Home Screen.</p>
		{:else}
			<p class="mt-1 text-sm text-haze">Use your browser's menu to install this app.</p>
		{/if}
	</section>

	<button onclick={() => app.resetSettings()} class="justify-self-start text-sm text-haze underline underline-offset-4 hover:text-chalk">Restore defaults</button>
</div>
