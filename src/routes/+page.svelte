<script lang="ts">
	import FAQSection from '#lib/components/FAQSection.svelte';
	import TLDRBlock from '#lib/components/TLDRBlock.svelte';
	import { app } from '#lib/state.svelte.ts';
	import { auth } from '#lib/auth.svelte.ts';
	import { pwa } from '#lib/pwa.svelte.ts';
	import { signed, gradeEmoji, odds, pct } from '#lib/format.ts';
	import Glossary from '#lib/components/Glossary.svelte';
	import Logo from '#lib/components/Logo.svelte';
 import SportsPhotography from '#lib/components/SportsPhotography.svelte';
	import DataBadge from '#lib/components/DataBadge.svelte';
	import { feed } from '#lib/feed.svelte.ts';
	import { SPORTS, SPORT_ORDER } from '#lib/sports.ts';
	import { sportEmoji } from '#lib/format.ts';

	const top = $derived.by(() => {
 const rows=app.all.filter(p=>p.status.state==='scheduled').slice(0,3).flatMap(p=>{const pick=p.markets.flatMap(g=>g.selections).sort((a,b)=>b.modelProb-a.modelProb)[0];return pick?[{id:pick.id,fixtureId:p.fixtureId,sport:p.sport,matchTitle:p.matchTitle,selection:pick.selection,modelProb:pick.modelProb,bestOdds:pick.pricing==='quoted'?pick.bestOdds:null}]:[];});
 return rows.length?rows:(feed.data?.previewFixtures??[]).slice(0,3).map(p=>({id:p.id,fixtureId:p.id,sport:p.sport,matchTitle:p.home+' vs '+p.away,selection:p.headline?.selection??'Open published analysis',modelProb:p.headline?.modelProb??null,bestOdds:p.headline?.odds??null}));
 });
	const best = $derived(app.valueBets[0]);
	const marketsPriced = $derived(app.all.reduce((a, p) => a + p.markets.reduce((b, g) => b + g.selections.length, 0), 0));
	const valueBySport = $derived(Object.fromEntries(SPORT_ORDER.map((s) => [s, app.valueBets.filter((v) => v.sport === s).length])));
	const liveCount = $derived(app.games.filter((g) => g.status.state === 'live').length);
	const record = $derived(feed.data?.record.summary.all);

	let stackOpen = $state(false);

	const features = [
		{ emoji: '📊', title: 'Understand each choice', text: 'Compare estimated probabilities, projected scores and choice notes in compact, ranked markets.', href: '/board' },
		{ emoji: '🎯', title: 'Build from your rules', text: 'Choose sports, markets, kickoff window and a combined odds target. Save your rules for next time.', href: '/bet-machine' },
		{ emoji: '🧾', title: 'Tickets to keep and share', text: 'Add priced or unpriced choices, save tickets and share a PDF with competition details. Combined odds use quoted selections only.', href: '/betslips' },
		{ emoji: '🏦', title: 'Bookmaker check', text: 'See which book keeps the biggest cut and where the best price sits.', href: '/bookmakers' },
		{ emoji: '🔒', title: 'Your account', text: 'Log in to keep your slip and settings on every device.', href: '/signup' },
		{ emoji: '📲', title: 'Install the app', text: 'Keep PuntersEdge on your home screen. Saved screens help on weak connections; fresh fixtures and account services need internet.', href: '/settings' },
  { emoji: '🎾', title: 'Explore tennis forecasts', text: 'Compare experimental ATP and WTA match-winner and first-set estimates, with evaluation and coverage notes.', href: '/tennis' },
  { emoji: '📈', title: 'Review published results', text: 'Check settled picks and recorded performance. Model estimates are assessed as new match results become available.', href: '/results' },
  { emoji: '🔑', title: 'Invited to test?', text: 'Activate your invitation through a verified personal account and keep your own profile and tickets.', href: '/tester' }
	];
</script>

<svelte:head>
	<title>PuntersEdge — sports forecasts, market analysis and smarter tickets</title>
</svelte:head>

<TLDRBlock answer="PuntersEdge compares sports model probabilities with bookmaker prices across football, NBA, basketball, ice hockey and baseball. Check the provider data badge and its refresh timestamp. Predictions are estimates, and no outcome or return is guaranteed." />
<!-- Hero -->
<section class="hero-section relative grid items-center gap-10 py-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:py-10" aria-labelledby="home-title">
	<div>
		<div class="flex flex-wrap items-center gap-2">
			<p class="inline-flex items-center gap-1.5 rounded-full bg-raised px-3 py-1 text-sm font-semibold text-chalk ring-1 ring-line">
				<span aria-hidden="true">⚽⛹️🏀🏒⚾</span> <span class="text-haze">value finder</span>
			</p>
			<DataBadge />
		</div>
		<h1 id="home-title" class="mt-4 text-[clamp(2.6rem,8vw,4.75rem)] font-extrabold leading-[0.92] text-chalk">
			Bet smarter,<br /><span class="brand-text">not harder.</span>
		</h1>
		<p class="mt-5 max-w-xl text-lg leading-relaxed text-chalk">
			Understand the match before you choose. Compare ranked market probabilities and projected scores, build tickets from saved rules, and review published results across five sports. Explore experimental tennis forecasts in a separate workspace.
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
				<dt class="text-xs text-haze">{liveCount ? 'Live now' : 'Games'}</dt>
				<dd class="font-display text-2xl font-bold {liveCount ? 'text-loss' : 'text-chalk'}">{liveCount || app.all.length || feed.data?.previewFixtures?.length || 0}</dd>
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
		<div class="hero-orbit" aria-hidden="true"></div>
{#if !top.length}<p class="surface relative p-6 text-haze">The published board is loading. <a href="/board" class="text-pop">Open fixtures ↗</a></p>{/if}
{#each top as v, i (v.id)}
			<a
				href="/match?id={v.fixtureId}"
				class="surface absolute inset-x-0 z-20 block p-4 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.6)] transition-transform duration-700 ease-[var(--ease-spring)]"
				style="top: {stackOpen ? i * 7.6 : 2.5 + i * 1.1}rem; transform: rotateX({stackOpen ? 0 : 18}deg) rotateZ({stackOpen ? 0 : (i - 1) * -5}deg) translateZ({(3 - i) * 20}px); z-index: {30 - i}"
			>
				<p class="fixture-name truncate text-xs font-medium">{sportEmoji[v.sport]} {v.matchTitle}</p>
				<p class="mt-1 truncate font-display text-lg font-bold text-chalk">{v.selection}</p>
				<p class="mt-1 text-sm">
					<span class="font-semibold text-book">{v.bestOdds?odds(v.bestOdds):'Price unavailable'}</span> <span class="text-haze">Published board projection</span>
				</p>
				<p class="mt-0.5 text-sm"><span class="font-semibold text-model">{v.modelProb===null?'Probability unavailable':'Model '+pct(v.modelProb)}</span></p>
			</a>
		{/each}
		<div class="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-3">
			<button onclick={() => (stackOpen = !stackOpen)} disabled={!top.length} aria-pressed={stackOpen} class="btn-ghost px-4 py-2 text-sm">
				{stackOpen ? '🗂️ Stack picks' : '🃏 Fan out picks'}
			</button>
			<span class="text-xs text-haze">Live from today's board</span>
		</div>
	</div>
</section>
<SportsPhotography/>

<!-- Sports -->
<section class="mt-8" aria-labelledby="sports-title">
	<div class="flex items-baseline justify-between gap-3">
		<h2 id="sports-title" class="text-3xl font-extrabold text-chalk">Your sports, one clear board</h2>
		<a href="/sports" class="text-sm font-semibold text-pop hover:underline">All sports</a>
	</div>
	<ul class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
		{#each SPORT_ORDER as key (key)}
			{@const s = SPORTS[key]}
			<li>
				<a href={s.href} class="surface group relative flex h-full flex-col gap-1 overflow-hidden p-4 transition-colors hover:ring-1 hover:ring-pop">
					<span class="pointer-events-none absolute -right-4 -top-4 text-7xl leading-none opacity-15 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110" aria-hidden="true">{s.emoji}</span>
					<span class="text-3xl leading-none" aria-hidden="true">{s.emoji}</span>
					<span class="mt-2 text-lg font-bold text-chalk">{s.label}</span>
					<span class="text-sm text-haze">{app.bySport(key).length} games{valueBySport[key] ? `, ${valueBySport[key]} value` : ''}</span>
				</a>
			</li>
		{/each}
	</ul>
	{#if record && record.picks > 0}
		<a href="/results" class="surface mt-3 flex flex-wrap items-center justify-between gap-2 p-4 hover:ring-1 hover:ring-pop">
			<span class="font-semibold text-chalk">📈 Track record: {record.picks} graded picks settled</span>
			<span class="font-display text-lg font-bold {record.profit >= 0 ? 'text-model' : 'text-loss'}">{signed(record.profit, 2)}u ({signed(record.roi)}%)</span>
		</a>
	{/if}
</section>

<!-- How it works: a real sequence -->
<section class="mt-14" aria-labelledby="how-title">
	<h2 id="how-title" class="text-3xl font-extrabold text-chalk">How it works</h2>
	<ol class="mt-5 grid gap-3 sm:grid-cols-3">
		{#each [
			{ emoji: '🔍', title: 'Compare the choices', text: 'Open a fixture to compare ranked estimates and available bookmaker prices.', href: '/board', cta: 'Open the board' },
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
	<p class="mt-1 text-haze">{marketsPriced} market options across {app.all.length} published matches in your current board. Coverage depends on available data and account access.</p>
	<ul class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each features as f (f.title)}
			<li>
				{#if f.title === 'Install the app' && pwa.canInstall}
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
			<p class="mt-2 max-w-lg text-chalk">The landing page and board preview are free. Full analytical access is Exclusive VIP. 18+ only. PuntersEdge never places bets, and a good price still loses sometimes, so stake what you can afford.</p>
		</div>
		<div class="flex flex-wrap gap-3">
			<a href="/board" class="btn-primary text-base">🔥 Today's picks</a>
			{#if !auth.signedIn}<a href="/signup" class="btn-ghost text-base">Create account</a>{/if}
		</div>
	</div>
</section>

<FAQSection items={[
 { question: 'Are sports predictions guaranteed?', answer: 'No. Model probabilities describe uncertain outcomes. An estimated edge does not guarantee a winning bet.' },
 { question: 'How do I know whether the data is live?', answer: 'Check the provider data badge and its refresh timestamp. Provider limits and outages may delay updates.' },
 { question: 'Which sports does PuntersEdge cover?', answer: 'PuntersEdge supports football, NBA, basketball, ice hockey and baseball, with sport-specific scoring models.' }
]} />
<section aria-labelledby="analysis-sources" class="mt-8 text-sm text-haze"><h2 id="analysis-sources" class="font-bold text-chalk">Where does the sports data come from?</h2><p class="mt-2">Available live feeds use <cite><a class="underline" href="https://api-sports.io/">API-Sports</a></cite>, <cite><a class="underline" href="https://oddspapi.io/">OddsPapi</a></cite> and <cite><a class="underline" href="https://the-odds-api.com/">The Odds API</a></cite>. Coverage depends on provider plans and quotas. <a class="underline" href="/results">Review freshness and usage</a>.</p><p class="mt-2"><a href="https://ewinproject.org" class="underline">Explore the E-WIN Project Ecosystem</a>.</p></section>

<section id="vip-pricing" class="surface mt-14 grid gap-8 overflow-hidden p-6 sm:p-10 lg:grid-cols-[1fr_1.2fr]" aria-labelledby="vip-plan-title"><div><p class="text-sm font-bold uppercase tracking-widest text-model">Exclusive VIP Punter</p><h2 id="vip-plan-title" class="mt-3 text-3xl font-extrabold">Executive VIP Punter subscription</h2><p class="mt-5 text-5xl font-extrabold">₦10,000<span class="ml-2 text-base font-normal text-haze">/ month</span></p><p class="mt-3 text-sm text-haze">One monthly plan for every member feature. Administrative tools remain exclusive to the super-admin.</p><a href="/subscribe" class="btn-primary mt-6 inline-flex">Unlock Exclusive VIP</a></div><div><h3 class="text-xl font-bold">Everything you need to examine your picks</h3><ul class="mt-5 grid gap-4 sm:grid-cols-2">{#each ['Football, NBA, basketball, hockey and baseball dashboards','Full match projections, confidence and all supported markets','Advanced bet machine with automatic ticket sizing','Results, latest scores and published performance record','Named betslip history, ticket previews and editing','Branded PDF downloads','Bookmaker comparison, glossary and model settings','Agnes AI explanations within daily limits','Selectable mobile alerts for fixtures, scores and activities'] as benefit}<li class="flex items-start gap-2 text-sm"><span class="font-bold text-model" aria-hidden="true">✓</span>{benefit}</li>{/each}</ul><p class="mt-5 text-xs text-haze">A verified payment adds one calendar month. No automatic debit. Model estimates do not guarantee wins or returns.</p></div></section>

<style>.hero-section{min-width:0;overflow-x:clip}.hero-orbit{position:absolute;inset:12% -3% 15%;border:1px solid #7c66df66;border-radius:50%;transform:rotate(-18deg);box-shadow:0 0 70px #6650cc24,inset 0 0 60px #34d39912;pointer-events:none}@media(prefers-reduced-motion:reduce){:global(a){transition:none!important}}</style>
