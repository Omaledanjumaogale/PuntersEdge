<script lang="ts">
	import { app } from '#lib/state.svelte.ts';
	import { feed } from '#lib/feed.svelte.ts';
	import { isConvexConfigured } from '#lib/convex.ts';
	import { SPORTS, SPORT_ORDER } from '#lib/sports.ts';
	import { sportEmoji, odds, signed, ago, gradeTone } from '#lib/format.ts';
	import GameRow from '#lib/components/GameRow.svelte';
	import DataBadge from '#lib/components/DataBadge.svelte';

	const record = $derived(feed.data?.record);
	const all = $derived(record?.summary.all);
	const finished = $derived(
		app.games
			.filter((g) => g.status.state === 'finished')
			.sort((a, b) => b.kickoff.localeCompare(a.kickoff))
			.slice(0, 30)
	);
	const live = $derived(app.games.filter((g) => g.status.state === 'live'));

	const PROVIDERS: Array<{ key: string; label: string; what: string }> = [
		...SPORT_ORDER.map((s) => ({ key: `api-sports:${s}`, label: `API-Sports · ${SPORTS[s].label}`, what: 'fixtures, live scores, results, league tables' })),
		{ key: 'the-odds-api', label: 'The Odds API', what: '1xBet, Pinnacle and other European books' },
		{ key: 'oddspapi', label: 'OddsPapi', what: 'SportyBet, 1xBet, 22Bet' }
	];
	const resultTone: Record<string, string> = { won: 'text-model', 'half-won': 'text-model', lost: 'text-loss', 'half-lost': 'text-loss', push: 'text-haze' };
</script>

<svelte:head><title>Results — PuntersEdge</title></svelte:head>

<header class="max-w-2xl">
	<div class="flex flex-wrap items-center gap-3">
		<h1 class="text-4xl font-extrabold text-chalk">📈 Results</h1>
		<DataBadge />
	</div>
	<p class="mt-2 text-haze">Final scores, how our graded picks actually did, and where the data comes from.</p>
</header>

<section class="mt-8" aria-labelledby="record-title">
	<h2 id="record-title" class="text-2xl font-bold text-chalk">🧾 Track record</h2>
	{#if all && all.picks > 0}
		<p class="mt-1 text-sm text-haze">Every game's best graded pick (A+, A or B) is recorded shortly before kickoff at the best quoted price, then settled from the final score. 1 unit per pick.</p>
		<div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
			<div class="surface p-4"><p class="text-sm text-haze">Picks settled</p><p class="font-display text-3xl font-bold">{all.picks}</p></div>
			<div class="surface p-4"><p class="text-sm text-haze">Won · lost · void</p><p class="font-display text-3xl font-bold">{all.won}<span class="text-haze">·</span>{all.lost}<span class="text-haze">·</span>{all.push}</p></div>
			<div class="surface p-4"><p class="text-sm text-haze">Profit</p><p class="font-display text-3xl font-bold {all.profit >= 0 ? 'text-model' : 'text-loss'}">{signed(all.profit, 2)}u</p></div>
			<div class="surface p-4"><p class="text-sm text-haze">Return on stake</p><p class="font-display text-3xl font-bold {all.roi >= 0 ? 'text-model' : 'text-loss'}">{signed(all.roi)}%</p></div>
		</div>
		<div class="mt-4 grid gap-4 md:grid-cols-2">
			<div class="surface p-4">
				<h3 class="font-semibold text-chalk">By grade</h3>
				<ul class="mt-2 space-y-1.5 text-sm">
					{#each Object.entries(record?.summary.grades ?? {}) as [g, r] (g)}
						<li class="flex items-center justify-between gap-2"><span class="rounded-md px-2 py-0.5 text-xs font-bold {gradeTone[g]}">{g}</span><span class="text-haze">{r.picks} picks · <span class={r.profit >= 0 ? 'text-model' : 'text-loss'}>{signed(r.profit, 2)}u ({signed(r.roi)}%)</span></span></li>
					{/each}
				</ul>
			</div>
			<div class="surface p-4">
				<h3 class="font-semibold text-chalk">By sport</h3>
				<ul class="mt-2 space-y-1.5 text-sm">
					{#each SPORT_ORDER as s (s)}
						{@const r = record?.summary.sports[s]}
						{#if r && r.picks}
							<li class="flex items-center justify-between gap-2"><span>{sportEmoji[s]} {SPORTS[s].label}</span><span class="text-haze">{r.picks} picks · <span class={r.profit >= 0 ? 'text-model' : 'text-loss'}>{signed(r.profit, 2)}u</span></span></li>
						{/if}
					{/each}
				</ul>
			</div>
		</div>
		<ul class="mt-4 grid gap-2">
			{#each record?.recent.slice(0, 20) ?? [] as r (r.uid)}
				<li class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-deep px-3.5 py-2.5 ring-1 ring-line">
					<span class="min-w-0">
						<span class="block truncate text-xs text-haze">{sportEmoji[r.sport]} {r.match} · {r.score}</span>
						<span class="block truncate font-semibold text-chalk">{r.selection} <span class="font-normal text-book">@ {odds(r.odds)}</span> <span class="text-xs font-normal text-haze">{r.bookmaker}, {r.grade}</span></span>
					</span>
					<span class="text-right font-display font-bold {resultTone[r.result] ?? 'text-haze'}">{r.result.replace('-', ' ')}<span class="block text-xs font-normal">{signed(r.profit, 2)}u</span></span>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="surface mt-4 p-5 text-haze">
			{#if feed.mode === 'live'}No graded picks have settled yet. They appear here as games finish{record?.pending ? ` (${record.pending} waiting on a result)` : ''}.{:else}The track record is built from live games, so it starts once the live feed is running.{/if}
		</p>
	{/if}
</section>

{#if live.length}
	<section class="mt-10" aria-labelledby="live-title">
		<h2 id="live-title" class="text-2xl font-bold text-chalk">🔴 Live now</h2>
		<div class="mt-3 grid gap-2 md:grid-cols-2">{#each live as g (g.id)}<GameRow {g} showSport />{/each}</div>
	</section>
{/if}

<section class="mt-10" aria-labelledby="scores-title">
	<h2 id="scores-title" class="text-2xl font-bold text-chalk">✅ Latest scores</h2>
	{#if finished.length}
		<div class="mt-3 grid gap-2 md:grid-cols-2">{#each finished as g (g.id)}<GameRow {g} showSport />{/each}</div>
	{:else}
		<p class="surface mt-4 p-5 text-haze">{feed.mode === 'live' ? 'No finished games in the last three days.' : 'Final scores appear here once the live feed is running.'}</p>
	{/if}
</section>

<section id="data" class="mt-10 scroll-mt-24" aria-labelledby="data-title">
	<h2 id="data-title" class="text-2xl font-bold text-chalk">📡 Data &amp; quotas</h2>
	{#if feed.mode === 'live' && feed.data}
		<p class="mt-1 text-sm text-haze">
			Feed built {ago(feed.data.generatedAt)}{feed.checkedAt ? `, checked ${ago(feed.checkedAt)}` : ''}. The backend refreshes every 30 minutes but only calls a provider when something is due and the budget allows: API-Sports up to 90 of its 100 daily requests per sport, OddsPapi and The Odds API paced so every day of the month gets an equal share.
		</p>
	{:else}
		<p class="mt-1 text-sm text-haze">
			{#if isConvexConfigured()}Waiting for the backend's first live feed. Until then you're seeing built-in sample games.{:else}This build has no backend configured, so it runs on built-in sample games.{/if}
		</p>
	{/if}

	{#if feed.usage}
		<ul class="mt-4 grid gap-3 md:grid-cols-2">
			{#each PROVIDERS as pr (pr.key)}
				{@const u = feed.usage[pr.key]}
				{#if u}
					{@const share = Math.min(1, u.used / u.limit)}
					<li class="surface p-4">
						<div class="flex items-baseline justify-between gap-2">
							<span class="font-semibold text-chalk">{pr.label}</span>
							<span class="text-sm text-haze">{u.used} / {u.limit} {u.window === 'day' ? 'today' : 'this month'}</span>
						</div>
						<div class="mt-2 h-2 overflow-hidden rounded-full bg-ink ring-1 ring-line" role="img" aria-label="{Math.round(share * 100)}% used">
							<div class="h-full rounded-full {share > 0.9 ? 'bg-loss' : share > 0.7 ? 'bg-book' : 'bg-model'}" style="width: {share * 100}%"></div>
						</div>
						<p class="mt-2 text-xs text-haze">{pr.what}. {u.window === 'month' ? `${u.today} used today, ${u.leftToday} left in today's share.` : `${u.leftToday} left today (cap ${u.cap}).`}</p>
					</li>
				{/if}
			{/each}
		</ul>
	{/if}

	{#if feed.data?.sources && Object.keys(feed.data.sources).length}
		<details class="surface mt-4 p-4">
			<summary class="cursor-pointer font-semibold text-chalk">Source log</summary>
			<ul class="mt-3 space-y-1 text-sm">
				{#each Object.entries(feed.data.sources).sort((a, b) => b[1].at - a[1].at) as [k, d] (k)}
					<li class="flex flex-wrap gap-x-2"><span aria-hidden="true">{d.ok ? '✅' : '⚠️'}</span><span class="font-medium text-chalk">{k}</span><span class="text-haze">{d.msg} · {ago(d.at)}</span></li>
				{/each}
			</ul>
		</details>
	{/if}

	<p class="mt-4 text-sm text-haze">
		Why no scraping of SportyBet, 1xBet, 22Bet, RedScore or 24live? Their terms forbid it and they block automated traffic, so scraped data breaks without warning. We use licensed APIs that carry the same bookmakers' prices instead.
	</p>
</section>
