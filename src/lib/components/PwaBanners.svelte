<script lang="ts">
	import { pwa } from '#lib/pwa.svelte.ts';
	import { fly } from 'svelte/transition';
	import { WifiOff, RefreshCw, Share, X, Download } from 'lucide-svelte';
</script>

<div class="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
	{#if pwa.offline}
		<div transition:fly={{ y: 16, duration: 250 }} class="pointer-events-auto flex items-center gap-2 rounded-full bg-raised px-4 py-2 text-sm ring-1 ring-line" role="status">
			<WifiOff class="h-4 w-4 text-book" />
			Offline. Showing the last prices you loaded.
		</div>
	{/if}

	{#if pwa.updateReady}
		<div transition:fly={{ y: 16, duration: 250 }} class="pointer-events-auto flex items-center gap-3 rounded-full bg-chalk py-1.5 pl-4 pr-1.5 text-sm text-ink shadow-xl" role="status">
			A new version is ready.
			<button onclick={() => pwa.applyUpdate()} class="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-chalk">
				<RefreshCw class="h-3.5 w-3.5" /> Update
			</button>
		</div>
	{/if}

	{#if pwa.canInstall}
		<div transition:fly={{ y: 16, duration: 250 }} class="pointer-events-auto flex items-center gap-3 rounded-2xl bg-raised py-2 pl-4 pr-2 text-sm ring-1 ring-line sm:hidden">
			<span>Install PuntersEdge for full-screen, offline use.</span>
			<button onclick={() => pwa.install()} class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-model px-3 py-1.5 font-semibold text-ink">
				<Download class="h-4 w-4" /> Install
			</button>
		</div>
	{/if}

	{#if pwa.showIOSHint}
		<div transition:fly={{ y: 16, duration: 250 }} class="pointer-events-auto relative max-w-sm rounded-2xl bg-raised p-4 pr-10 text-sm ring-1 ring-line">
			<button onclick={() => pwa.dismissIOSHint()} aria-label="Dismiss" class="absolute right-2 top-2 rounded-full p-1.5 text-haze hover:text-chalk">
				<X class="h-4 w-4" />
			</button>
			<p class="font-semibold">Add PuntersEdge to your Home Screen</p>
			<p class="mt-1 text-haze">
				Tap <Share class="inline h-4 w-4 align-text-bottom text-chalk" /> Share in Safari, then <span class="text-chalk">Add to Home Screen</span>.
			</p>
		</div>
	{/if}
</div>
