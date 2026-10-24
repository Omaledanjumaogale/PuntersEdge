<script lang="ts">
 import {fixtureMetadataLines} from '#lib/fixture-metadata.js';
	import { app } from '#lib/state.svelte.ts';
	import { auth } from '#lib/auth.svelte.ts';
	import { toast } from '#lib/toast.svelte.ts';
	import {hasQuotedOdds} from '#lib/slip-pricing.js';
	import SlipEvidence from '#lib/components/SlipEvidence.svelte';
 import {itemOutcome,shareSlipText} from '#lib/slips.js';
 import { downloadSlipPdf } from '#lib/slip-export.ts';
	import { api } from '../../../convex/_generated/api.js';
	import { odds, pct, ngn, signed } from '#lib/format.ts';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { X, Trash2, Copy, Check } from 'lucide-svelte';

	let mode = $state<'singles' | 'acca'>('acca');
	let stake = $state(1000);
	let copied = $state(false);
	let reviewed = $state(false);
	$effect(()=>{app.slip.map(i=>`${i.id}:${i.odds}`).join('|'); reviewed=false;});
	let slipName = $state('');
	let savingHistory = $state(false);
	let exporting = $state(false);
	async function pdf(){exporting=true;try{await downloadSlipPdf(exportSlip);}catch{toast.error('PDF download failed.');}finally{exporting=false;}}

	const items = $derived(app.resolvedSlip);
	const econ = $derived(app.slipEconomics);
	const exportSlip = $derived({name:slipName.trim()||'My betslip',betType:mode,stake,potentialReturn:mode==='acca'?stake*econ.combinedOdds:items.filter(hasQuotedOdds).reduce((sum,item)=>sum+stake*item.odds,0),items:items.map(item=>{const game=app.gameById(item.fixtureId);return {...item,league:item.league??game?.league,tournament:item.tournament??game?.tournament,country:item.country??game?.country,kickoff:item.kickoff??(game?Date.parse(game.kickoff):undefined),fixtureStatus:item.fixtureStatus,score:item.score};})});
	const isAcca = $derived(mode === 'acca' && items.length > 1);

	const singlesEv = $derived(items.filter(hasQuotedOdds).reduce((acc, i) => acc + stake * (i.modelProb * i.odds - 1), 0));
	const accaReturn = $derived(stake * econ.combinedOdds);
	const expected = $derived(isAcca ? stake * (econ.evPercent / 100) : singlesEv);

	function close() {
		app.slipOpen = false;
	}

	async function share(){try{if(navigator.share)await navigator.share({title:exportSlip.name,text:shareSlipText(exportSlip)});else await copySlip();}catch(reason){if((reason as Error).name!=='AbortError')toast.error('Sharing could not open. Use Copy slip instead.');}}
	async function copySlip() {
		try {
			await navigator.clipboard.writeText(shareSlipText(exportSlip));
			copied = true;
			setTimeout(() => (copied = false), 1800);
		} catch {
			/* clipboard blocked */
		}
	}

	async function saveHistory() {
		if (!auth.client) { toast.error('Log in to save a named slip.'); return; }
		savingHistory = true;
		try {
			const selections = items.map(({ fixtureId, sport, matchTitle, league, tournament, country, market, selection, bookmaker, odds, modelProb, pushProb, edgePercent, marketKey, evidence }) => ({ fixtureId, sport, matchTitle, league, tournament, country, market, selection, bookmaker, odds, modelProb, pushProb, edgePercent, marketKey, evidence }));
			await auth.client.mutation(api.betslip.saveHistory, { name: slipName.trim() || `My slip ${new Date().toLocaleDateString('en-NG')}`, items: selections, stake, betType: mode });
			toast.success('Named slip saved to your history.'); slipName = '';
		} catch (reason) { toast.error((reason as Error).message); }
		finally { savingHistory = false; }
	}

	function onkey(e: KeyboardEvent) {
		if (e.key === 'Escape' && app.slipOpen) close();
	}
</script>

<svelte:window onkeydown={onkey} />

{#if app.slipOpen}
	<div class="fixed inset-0 z-50 bg-ink/70 backdrop-blur-sm" transition:fade={{ duration: 180 }} onclick={close} aria-hidden="true"></div>
	<div
		role="dialog"
		aria-modal="true"
		aria-labelledby="slip-title"
		transition:fly={{ y: 40, duration: 320, easing: cubicOut }}
		class="safe-bottom fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-[1.75rem] border-t border-line bg-deep md:inset-y-4 md:left-auto md:right-4 md:w-[30rem] md:max-h-none md:rounded-[1.75rem] md:border"
	>
		<div class="mx-auto mt-2 h-1 w-10 rounded-full bg-line md:hidden"></div>
		<header class="flex flex-wrap items-center gap-2 px-5 pb-3 pt-3">
			<h2 id="slip-title" class="text-xl font-bold text-chalk">{reviewed?'Ticket preview':'🧾 Betslip'}</h2>
			<a href="/betslips" onclick={close} class="text-xs font-semibold text-model underline">History</a>
			<span class="text-sm text-haze">{items.length} selection{items.length === 1 ? '' : 's'}</span>
			<div class="ml-auto flex gap-1">
				{#if items.length}
					<button onclick={() => app.clearSlip()} class="rounded-full p-2 text-haze hover:text-loss" aria-label="Clear slip"><Trash2 class="h-4 w-4" /></button>
				{/if}
				<button onclick={close} class="rounded-full p-2 text-haze hover:text-chalk" aria-label="Close slip"><X class="h-5 w-5" /></button>
			</div>
		</header>

		<div class="compact-picks flex-1 space-y-2 overflow-y-auto px-3">
			{#each items as i (i.id)}
				<div class="ticket option-card block min-w-0 px-4 py-4" transition:fly={{ x: 24, duration: 200 }}>
					<div class="min-w-0 flex-1">
						<a class="fixture-name block min-h-9 break-words text-xs hover:underline" href={i.sport==='tennis'?`/tennis#${encodeURIComponent(i.fixtureId)}`:`/match?id=${encodeURIComponent(i.fixtureId)}`} onclick={close}>{i.matchTitle}<span class="sr-only"> · View full analysis</span></a><p class="mt-1 break-words text-xs text-haze">{fixtureMetadataLines(i).join(' · ')}</p>
						{#if app.gameById(i.fixtureId)}<p class="mt-1 text-xs text-haze">{new Date(app.gameById(i.fixtureId)!.kickoff).toLocaleString('en-NG',{timeZone:'Africa/Lagos',dateStyle:'medium',timeStyle:'short'})} WAT</p>{/if}
						<p class="break-words font-semibold text-chalk">{i.selection}</p>
						<p class="text-xs text-haze">{i.market}, {i.bookmaker}, model {pct(i.modelProb, 1)}{#if (i.pushProb??0)>0}, refund {pct(i.pushProb??0,1)}{/if}</p>
						{#if app.sameGameFixtures.has(i.fixtureId)}<p class="mt-0.5 text-xs font-semibold text-book">🔗 Same match as another pick</p>{/if}
					</div>
					<div class="mt-3 flex items-center justify-between gap-3"><span class="font-display text-lg font-semibold text-book">{i.odds>1?odds(i.odds):'Unpriced'}</span>
					<button onclick={() => app.remove(i.id)} class="grid min-h-11 min-w-11 place-items-center rounded-full p-2 text-haze hover:text-loss" aria-label="Remove {i.selection}"><X class="h-4 w-4" /></button></div>
<p class="mt-2 text-xs font-semibold text-model">{i.fixtureStatus??'Scheduled'} · {itemOutcome(i)}{#if i.score} · Score {i.score.home}–{i.score.away}{/if}</p><SlipEvidence evidence={i.evidence} />
				</div>
			{:else}
				<div class="py-8 text-center">
					<svg viewBox="0 0 160 110" class="mx-auto h-28 w-auto" aria-hidden="true">
						<g transform="rotate(-8 80 55)">
							<rect x="30" y="18" width="100" height="74" rx="12" style="fill: var(--color-raised); stroke: var(--color-line); stroke-width: 2" />
							<circle cx="30" cy="55" r="8" style="fill: var(--color-deep)" />
							<circle cx="130" cy="55" r="8" style="fill: var(--color-deep)" />
							<line x1="96" y1="26" x2="96" y2="84" style="stroke: var(--color-line); stroke-width: 2; stroke-dasharray: 4 4" />
							<rect x="42" y="34" width="44" height="8" rx="4" style="fill: var(--color-pop); opacity: 0.8" />
							<rect x="42" y="50" width="30" height="6" rx="3" style="fill: var(--color-haze); opacity: 0.6" />
							<rect x="42" y="64" width="38" height="6" rx="3" style="fill: var(--color-book); opacity: 0.8" />
							<text x="113" y="62" text-anchor="middle" font-size="22" style="fill: var(--color-model)">+</text>
						</g>
					</svg>
					<p class="mt-2 text-lg font-bold text-chalk">Your slip is empty</p>
					<p class="mt-1 text-sm text-haze">Tap + on any ticket to add a pick.</p>
					<a href="/value-bets" onclick={close} class="btn-primary mt-4 text-sm">🔥 Browse value bets</a>
				</div>
			{/each}
		</div>

		{#if items.length}
			<footer class="max-h-[50dvh] space-y-3 overflow-y-auto border-t border-line px-5 pb-3 pt-4">
				{#if !reviewed}<button class="btn-primary w-full" onclick={()=>reviewed=true}>Preview full ticket & set stake</button><p class="text-center text-xs text-haze">Review every selection before saving or sharing.</p>{:else}
				{#if items.length > 1}
					<div class="grid grid-cols-2 gap-1 rounded-full bg-ink p-1 text-sm" role="tablist">
						{#each [['acca', 'Accumulator'], ['singles', 'Singles']] as [m, label]}
							<button role="tab" aria-selected={mode === m} onclick={() => (mode = m as typeof mode)} class="rounded-full py-1.5 {mode === m ? 'bg-raised text-chalk' : 'text-haze'}">{label}</button>
						{/each}
					</div>
				{/if}

				<label class="block">
					<span class="text-sm text-haze">Stake {isAcca ? '' : 'per selection'}</span>
					<div class="mt-1 flex items-center gap-2 rounded-xl bg-ink px-3 ring-1 ring-line focus-within:ring-model">
						<span class="text-haze">₦</span>
						<input type="number" inputmode="numeric" min="0" step="100" bind:value={stake} class="w-full bg-transparent py-2.5 text-lg outline-none" />
					</div>
				</label>

				{#if econ.unpricedCount}<p class="rounded-xl bg-raised p-3 text-xs text-haze">{econ.unpricedCount} unpriced selection{econ.unpricedCount===1?'':'s'} included. Combined odds and returns below cover only the {econ.quotedCount} quoted selection{econ.quotedCount===1?'':'s'}; the full ticket return is unknown.</p>{/if}
				<dl class="grid grid-cols-2 gap-y-1.5 text-sm">
					{#if isAcca}
						<dt class="text-haze">{econ.unpricedCount?'Quoted selections odds':'Combined odds'}</dt><dd class="text-right text-book">{econ.quotedCount?odds(econ.combinedOdds):'No quotes'}</dd>
						<dt class="text-haze">{econ.unpricedCount?'Quoted subset chance':'Model win chance'}</dt><dd class="text-right">{econ.quotedCount?pct(econ.combinedProb, 1):'Unavailable'}</dd>
						<dt class="text-haze">{econ.unpricedCount?'Quoted subset return':'Return if it lands'}</dt><dd class="text-right">{ngn(accaReturn)}</dd>
					{:else}
						<dt class="text-haze">Total staked</dt><dd class="text-right">{ngn(stake * items.length)}</dd>
					{/if}
					<dt class="text-haze">Expected profit</dt>
					<dd class="text-right font-semibold {expected >= 0 ? 'text-model' : 'text-loss'}">{econ.unpricedCount?'Unavailable with unpriced selections':(expected>=0?'+':'−')+ngn(Math.abs(expected))}</dd>
				</dl>

				{#if isAcca && app.sameGameFixtures.size > 0}
					<p class="rounded-xl tint-book px-3 py-2 text-xs font-medium text-chalk ring-1 ring-book/50">🔗 Some picks are from the same match. Their results are linked, so the combined chance above is only a rough guide, and many bookmakers won't accept them in one accumulator. Singles are safer.</p>
				{/if}
				{#if isAcca && !econ.unpricedCount && econ.evPercent < 0}
					<p class="rounded-xl tint-loss px-3 py-2 text-xs text-loss">This combination has negative expected value ({signed(econ.evPercent)}%). Singles keep each edge intact.</p>
				{/if}

				{#if auth.signedIn}

					<label class="grid gap-1 text-sm text-haze">Name this slip<input class="rounded-xl bg-ink px-3 py-2 text-chalk ring-1 ring-line" maxlength="80" bind:value={slipName} placeholder="Weekend picks" /></label>
					<button onclick={saveHistory} class="btn-primary w-full" disabled={savingHistory}>{savingHistory ? 'Saving…' : 'Save to history'}</button>
				{/if}
				<button class="btn-secondary w-full" onclick={share}>Share ticket · WhatsApp & more</button><div class="grid gap-2"><button class="btn-secondary" disabled={exporting} onclick={pdf}>{exporting?'Preparing…':'Download PDF'}</button></div>
				<button onclick={copySlip} class="flex w-full items-center justify-center gap-2 rounded-full bg-chalk py-3 font-semibold text-ink hover:bg-white">
					{#if copied}<Check class="h-4 w-4" /> Copied{:else}<Copy class="h-4 w-4" /> Copy slip for your bookmaker{/if}
				</button>
				<p class="text-center text-xs text-haze">
					{#if auth.signedIn && auth.mode === 'convex'}☁️ Synced to your account. {:else if !auth.signedIn}<a href="/login" onclick={close} class="font-semibold text-pop underline">Log in</a> to sync this slip. {/if}PuntersEdge doesn't place bets. 18+, bet within your means.
				</p>
			<button class="btn-secondary w-full" onclick={()=>reviewed=false}>Back to editing selections</button>
				{/if}
			</footer>
		{/if}
	</div>
{/if}
