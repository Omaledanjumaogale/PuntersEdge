<script lang="ts">
	import { app } from '#lib/state.svelte.ts';
	import { pwa } from '#lib/pwa.svelte.ts';
	import { ngn } from '#lib/format.ts';

	const kellyOptions = [
		{ value: 0.125, label: '⅛ Kelly', note: 'Very cautious' },
		{ value: 0.25, label: '¼ Kelly', note: 'Recommended' },
		{ value: 0.5, label: '½ Kelly', note: 'Aggressive' }
	];
</script>

<svelte:head><title>Settings — QuantEdge</title></svelte:head>

<header class="max-w-2xl">
	<h1 class="text-4xl font-bold">Settings</h1>
	<p class="mt-2 text-haze">Saved on this device. Changes reprice every fixture instantly.</p>
</header>

<div class="mt-8 grid max-w-2xl gap-5">
	<section class="surface p-5" aria-labelledby="bankroll-title">
		<h2 id="bankroll-title" class="text-lg font-semibold">Bankroll</h2>
		<p class="mt-1 text-sm text-haze">Money set aside for betting only. Stakes are sized as a share of it.</p>
		<div class="mt-3 flex items-center gap-2 rounded-xl bg-ink px-3 ring-1 ring-line focus-within:ring-model">
			<span class="text-haze">₦</span>
			<input type="number" inputmode="numeric" min="0" step="1000" bind:value={app.settings.bankroll} aria-labelledby="bankroll-title" class="w-full bg-transparent py-2.5 text-lg outline-none" />
		</div>
		<p class="mt-2 text-sm text-haze">A 2% stake is {ngn(app.stakeFor(2))}.</p>
	</section>

	<section class="surface p-5" aria-labelledby="kelly-title">
		<h2 id="kelly-title" class="text-lg font-semibold">Stake sizing</h2>
		<p class="mt-1 text-sm text-haze">Fraction of the Kelly criterion. Smaller fractions grow slower but survive model error. Single stakes are capped at 3.5%.</p>
		<div class="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="kelly-title">
			{#each kellyOptions as k}
				<button
					role="radio"
					aria-checked={app.settings.kellyFraction === k.value}
					onclick={() => (app.settings.kellyFraction = k.value)}
					class="rounded-xl px-3 py-3 text-left ring-1 transition-colors {app.settings.kellyFraction === k.value ? 'bg-model/10 ring-model' : 'bg-ink ring-line hover:ring-haze'}"
				>
					<span class="block font-semibold">{k.label}</span>
					<span class="text-xs text-haze">{k.note}</span>
				</button>
			{/each}
		</div>
	</section>

	<section class="surface p-5" aria-labelledby="weight-title">
		<h2 id="weight-title" class="text-lg font-semibold">Model vs market</h2>
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
				<h2 id="motion-title" class="text-lg font-semibold">3D and motion</h2>
				<p class="mt-1 text-sm text-haze">Animated score surface, card tilt and page transitions.</p>
			</div>
			<button
				role="switch"
				aria-checked={app.settings.motion}
				aria-labelledby="motion-title"
				onclick={() => (app.settings.motion = !app.settings.motion)}
				class="relative h-7 w-12 shrink-0 rounded-full transition-colors {app.settings.motion ? 'bg-model' : 'bg-line'}"
			>
				<span class="absolute top-1 h-5 w-5 rounded-full bg-chalk transition-[left] {app.settings.motion ? 'left-6' : 'left-1'}"></span>
			</button>
		</div>
	</section>

	<section class="surface p-5" aria-labelledby="app-title">
		<h2 id="app-title" class="text-lg font-semibold">App</h2>
		{#if pwa.installed}
			<p class="mt-1 text-sm text-haze">Installed. QuantEdge works offline with the last prices it loaded.</p>
		{:else if pwa.canInstall}
			<p class="mt-1 text-sm text-haze">Install for a full-screen app that opens from your home screen and works offline.</p>
			<button onclick={() => pwa.install()} class="mt-3 rounded-full bg-model px-4 py-2 font-semibold text-ink">Install QuantEdge</button>
		{:else if pwa.isIOS}
			<p class="mt-1 text-sm text-haze">In Safari, tap Share, then Add to Home Screen.</p>
		{:else}
			<p class="mt-1 text-sm text-haze">Use your browser's menu to install this app.</p>
		{/if}
	</section>

	<button onclick={() => app.resetSettings()} class="justify-self-start text-sm text-haze underline underline-offset-4 hover:text-chalk">Restore defaults</button>
</div>
