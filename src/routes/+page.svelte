<script lang="ts">
	import { app } from '#lib/state.svelte.ts';
	import { auth } from '#lib/auth.svelte.ts';
	import { pwa } from '#lib/pwa.svelte.ts';
	import { signed, gradeEmoji, odds, pct } from '#lib/format.ts';
	import Glossary from '#lib/components/Glossary.svelte';
	import Logo from '#lib/components/Logo.svelte';

	const top = $derived(app.valueBets.slice(0, 3));
	const best = $derived(app.valueBets[0]);
	const marketsPriced = $derived(app.all.reduce((a, p) => a + p.markets.reduce((b, g) => b + g.selections.length, 0), 0));
	const footballValue = $derived(app.valueBets.filter((v) => v.sport === 'football').length);
	const basketballValue = $derived(app.valueBets.filter((v) => v.sport === 'basketball').length);

	let stackOpen = $state(false);

	const features = [
		{ emoji: '📊', title: 'Why this pick?', text: 'Every tip shows what the odds need, what our model says and the reasons behind it.', href: '/board' },
		{ emoji: '🎯', title: 'Every market', text: 'Tap + and pick from double chance, handicaps, totals, BTTS and more.', href: '/football' },
		{ emoji: '🧾', title: 'Smart slip', text: 'Stakes from your bankroll, win chance and expected profit for singles or accas.', href: '/value-bets' },
		{ emoji: '🏦', title: 'Bookmaker check', text: 'See which book keeps the biggest cut and where the best price sits.', href: '/bookmakers' },
		{ emoji: '🔒', title: 'Your account', text: 'Log in to keep your slip and settings on every device.', href: '/signup' },
		{ emoji: '📲', title: 'Works offline', text: 'Install it like an app. Opens instantly, even with bad network.', href: '/settings' }
	];
</script>

<svelte:head>
	<title>PuntersEdge — bet smarter on football and basketball</title>
</svelte:head>

<!-- Hero -->
<section class="relative grid items-center gap-10 py-4 md:grid-cols-[1.1fr_1fr] md:py-10" aria-labelledby="home-title">
	<div>
		<p class="inline-flex items-center gap-2 rounded-full bg-raised px-3 py-1 text-sm font-semibold text-chalk ring-1 ring-line">
			<span aria-hidden="true">⚽</span> Football <span aria-hidden="true">🏀</span> Basketball <span class="text-haze">value finder</span>
		</p>
		<h1 id="home-title" class="mt-4 text-[clamp(2.6rem,8vw,4.75rem)] font-extrabold leading-[0.92] text-chalk">
			Bet smarter,<br /><span class="brand-text">not harder.</span>
		</h1>
		<p class="mt-5 max-w-xl text-lg leading-relaxed text-chalk">
			PuntersEdge prices every match, compares SportyBet, 1xBet and 22Bet, and shows you where the odds are wrong. Then it tells you why, and how much to stake.
		</p>
		<div class="mt-6 flex flex-wrap gap-3">
			<a href="/board" class="btn-primary text-base">🔥 See today's picks</a>
			{#if auth.signedIn}
				<a href="/account" class="btn-ghost text-base">👋 Hey, {auth.displayName}</a>
			{:else}
				<a href="/signup" class="btn-ghost text-base">Join free</a>
			{/if}
		</div>
		<dl class="mt-8 grid max-w-lg grid-cols-3 gap-3">
			<a href="/board" class="surface block p-3 hover:ring-1 hover:ring-pop">
				<dt class="text-xs text-haze">Matches</dt>
				<dd class="font-display text-2xl font-bold text-chalk">{app.all.length}</dd>
			</a>
			<a href="/value-bets" class="surface block p-3 hover:ring-1 hover:ring-pop">
				<dt class="text-xs text-haze">Value bets</dt>
				<dd class="font-display text-2xl font-bold text-chalk">{app.valueBets.length}</dd>
			</a>
			<a href="/value-bets" class="surface block p-3 hover:ring-1 hover:ring-pop">
				<dt class="text-xs text-haze">Best edge</dt>
				<dd class="font-display text-2xl font-bold text-model">{best ? `${signed(best.edgePercent, 1)}%` : '—'}</dd>
			</a>
		</dl>
	</div>

	<!-- 3D stack of today's real top picks -->
	<div class="relative mx-auto w-full max-w-sm transition-[height] duration-700 [perspective:1200px]" style="height: {stackOpen ? 27 : 21}rem">
		{#each top as v, i (v.id)}
			<a
				href="/match/{v.fixtureId}"
				class="surface absolute inset-x-0 z-20 block p-4 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.6)] transition-transform duration-700 ease-[var(--ease-spring)]"
				style="top: {stackOpen ? i * 7.6 : 2.5 + i * 1.1}rem; transform: rotateX({stackOpen ? 0 : 18}deg) rotateZ({stackOpen ? 0 : (i - 1) * -5}deg) translateZ({(3 - i) * 20}px); z-index: {30 - i}"
			>
				<p class="truncate text-xs font-medium text-haze">{v.sport === 'football' ? '⚽' : '🏀'} {v.matchTitle}</p>
				<p class="mt-1 truncate font-display text-lg font-bold text-chalk">{gradeEmoji[v.grade]} {v.selection}</p>
				<p class="mt-1 text-sm">
					<span class="font-semibold text-book">{odds(v.bestOdds)}</span> <span class="text-haze">at {v.bookmaker}, needs {pct(1 / v.bestOdds)}</span>
				</p>
				<p class="mt-0.5 text-sm"><span class="font-semibold text-model">{signed(v.edgePercent, 1)}% edge</span> <span class="text-haze">model {pct(v.modelProb)}</span></p>
			</a>
		{/each}
		<div class="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3">
			<button onclick={() => (stackOpen = !stackOpen)} aria-pressed={stackOpen} class="btn-ghost px-4 py-2 text-sm">
				{stackOpen ? '🗂️ Stack picks' : '🃏 Fan out picks'}
			</button>
			<span class="text-xs text-haze">Live from today's board</span>
		</div>
	</div>
</section>

<!-- Sports -->
<section class="mt-8 grid gap-4 sm:grid-cols-2" aria-label="Sports">
	<a href="/football" class="surface group relative block overflow-hidden p-6 hover:ring-1 hover:ring-model">
		<svg class="pointer-events-none absolute -right-16 -top-8 h-48 w-72 opacity-20 transition-transform duration-500 group-hover:scale-105" viewBox="0 0 240 150" aria-hidden="true">
			<rect x="4" y="4" width="232" height="142" rx="14" fill="none" style="stroke: var(--color-model); stroke-width: 2.5" />
			<line x1="120" y1="4" x2="120" y2="146" style="stroke: var(--color-model); stroke-width: 2.5" />
			<circle cx="120" cy="75" r="26" fill="none" style="stroke: var(--color-model); stroke-width: 2.5" />
			<rect x="4" y="45" width="34" height="60" fill="none" style="stroke: var(--color-model); stroke-width: 2.5" />
			<rect x="202" y="45" width="34" height="60" fill="none" style="stroke: var(--color-model); stroke-width: 2.5" />
		</svg>
		<p class="relative text-4xl" aria-hidden="true">⚽</p>
		<h2 class="relative mt-3 text-2xl font-extrabold text-chalk">Football</h2>
		<p class="relative mt-1 text-haze">{app.football.length} matches, {footballValue} value bets. Premier League to the NPFL.</p>
		<span class="relative mt-4 inline-block font-semibold text-model">Open football</span>
	</a>
	<a href="/basketball" class="surface group relative block overflow-hidden p-6 hover:ring-1 hover:ring-book">
		<svg class="pointer-events-none absolute -right-16 -top-8 h-48 w-72 opacity-20 transition-transform duration-500 group-hover:scale-105" viewBox="0 0 240 150" aria-hidden="true">
			<rect x="4" y="4" width="232" height="142" rx="14" fill="none" style="stroke: var(--color-book); stroke-width: 2.5" />
			<line x1="120" y1="4" x2="120" y2="146" style="stroke: var(--color-book); stroke-width: 2.5" />
			<circle cx="120" cy="75" r="20" fill="none" style="stroke: var(--color-book); stroke-width: 2.5" />
			<path d="M4 30 h40 a45 45 0 0 1 0 90 h-40" fill="none" style="stroke: var(--color-book); stroke-width: 2.5" />
			<path d="M236 30 h-40 a45 45 0 0 0 0 90 h40" fill="none" style="stroke: var(--color-book); stroke-width: 2.5" />
		</svg>
		<p class="relative text-4xl" aria-hidden="true">🏀</p>
		<h2 class="relative mt-3 text-2xl font-extrabold text-chalk">Basketball</h2>
		<p class="relative mt-1 text-haze">{app.basketball.length} games, {basketballValue} value bets. NBA and EuroLeague.</p>
		<span class="relative mt-4 inline-block font-semibold text-book">Open basketball</span>
	</a>
</section>

<!-- How it works: a real sequence -->
<section class="mt-14" aria-labelledby="how-title">
	<h2 id="how-title" class="text-3xl font-extrabold text-chalk">How it works</h2>
	<ol class="mt-5 grid gap-3 sm:grid-cols-3">
		{#each [
			{ emoji: '🔍', title: 'Spot the value', text: 'We price every match and flag odds better than fair.', href: '/board', cta: 'Open the board' },
			{ emoji: '📊', title: 'Check the why', text: 'Open “Why this pick?” to see the numbers behind each tip.', href: '/board', cta: 'See an example' },
			{ emoji: '🧾', title: 'Build your slip', text: 'Tap + to add picks and explore every other market on the match.', href: '/value-bets', cta: 'Browse value bets' }
		] as step, i (step.title)}
			<li>
				<a href={step.href} class="surface flex h-full flex-col gap-2 p-5 transition-colors hover:ring-1 hover:ring-pop">
					<span class="flex items-center gap-3">
						<span class="grid h-12 w-12 place-items-center rounded-2xl bg-raised text-2xl ring-1 ring-line" aria-hidden="true">{step.emoji}</span>
						<span class="font-display text-3xl font-extrabold text-pop">{i + 1}</span>
					</span>
					<span class="text-lg font-bold text-chalk">{step.title}</span>
					<span class="text-haze">{step.text}</span>
					<span class="mt-auto pt-2 text-sm font-semibold text-pop">{step.cta}</span>
				</a>
			</li>
		{/each}
	</ol>
</section>

<!-- Features -->
<section class="mt-14" aria-labelledby="features-title">
	<h2 id="features-title" class="text-3xl font-extrabold text-chalk">What's inside</h2>
	<p class="mt-1 text-haze">{marketsPriced} selections priced across {app.all.length} matches right now.</p>
	<ul class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each features as f (f.title)}
			<li>
				{#if f.title === 'Works offline' && pwa.canInstall}
					<button onclick={() => pwa.install()} class="surface flex h-full w-full flex-col gap-1 p-5 text-left hover:ring-1 hover:ring-pop">
						<span class="text-3xl" aria-hidden="true">{f.emoji}</span>
						<span class="mt-1 text-lg font-bold text-chalk">{f.title}</span>
						<span class="text-haze">{f.text}</span>
						<span class="mt-2 text-sm font-semibold text-pop">Install now</span>
					</button>
				{:else}
					<a href={f.href} class="surface flex h-full flex-col gap-1 p-5 hover:ring-1 hover:ring-pop">
						<span class="text-3xl" aria-hidden="true">{f.emoji}</span>
						<span class="mt-1 text-lg font-bold text-chalk">{f.title}</span>
						<span class="text-haze">{f.text}</span>
					</a>
				{/if}
			</li>
		{/each}
	</ul>
</section>

<!-- Glossary -->
<section id="glossary" class="mt-14 scroll-mt-24" aria-labelledby="glossary-title">
	<h2 id="glossary-title" class="text-3xl font-extrabold text-chalk">📖 Glossary</h2>
	<p class="mt-1 max-w-2xl text-haze">What A+ means, what an edge is, and every other term you'll see. Tap a term to expand it.</p>
	<div class="mt-5"><Glossary limit={8} /></div>
</section>

<!-- Closing CTA + responsible play -->
<section class="mt-14 overflow-hidden rounded-[var(--radius-sheet)] bg-gradient-to-br from-pop/25 via-deep to-model/20 p-6 ring-1 ring-line sm:p-10" aria-labelledby="cta-title">
	<div class="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
		<div>
			<Logo size={40} />
			<h2 id="cta-title" class="mt-4 text-3xl font-extrabold text-chalk">Find the edge before kickoff.</h2>
			<p class="mt-2 max-w-lg text-chalk">Free to use. 18+ only. PuntersEdge never places bets, and a good price still loses sometimes, so stake what you can afford.</p>
		</div>
		<div class="flex flex-wrap gap-3">
			<a href="/board" class="btn-primary text-base">🔥 Today's picks</a>
			{#if !auth.signedIn}<a href="/signup" class="btn-ghost text-base">Create account</a>{/if}
		</div>
	</div>
</section>
