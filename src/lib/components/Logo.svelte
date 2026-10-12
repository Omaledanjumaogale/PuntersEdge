<script lang="ts">
	/** QuantEdge mark: three rising towers (the score surface) and a spark. */
	let { size = 32, wordmark = true }: { size?: number; wordmark?: boolean } = $props();
	const id = `qe-${Math.random().toString(36).slice(2, 8)}`;
</script>

<span class="inline-flex items-center gap-2">
	<svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" class="shrink-0 drop-shadow-[0_6px_14px_rgb(124_77_255/0.35)]">
		<defs>
			<linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
				<stop offset="0" stop-color="#7c4dff" />
				<stop offset="0.55" stop-color="#4f6bff" />
				<stop offset="1" stop-color="#1fd1b2" />
			</linearGradient>
		</defs>
		<rect width="512" height="512" rx="120" fill="url(#{id})" />
		<g transform="translate(256 300) skewY(-14)" fill="#ffffff">
			<rect x="-156" y="-10" width="80" height="104" rx="18" fill-opacity="0.55" />
			<rect x="-40" y="-108" width="80" height="202" rx="18" fill-opacity="0.8" />
			<rect x="76" y="-210" width="80" height="304" rx="18" />
		</g>
		<path d="M170 92l16 38 38 16-38 16-16 38-16-38-38-16 38-16z" fill="#ffe08a" />
	</svg>
	{#if wordmark}
		<span class="font-display text-[1.15rem] font-extrabold tracking-tight text-chalk">Quant<span class="brand-text">Edge</span></span>
	{/if}
</span>
