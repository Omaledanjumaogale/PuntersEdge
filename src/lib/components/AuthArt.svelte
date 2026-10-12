<script lang="ts">
	/** Illustration for the auth screens: a pitch and a court meeting under rising value bars. */
</script>

<svg viewBox="0 0 360 260" class="h-auto w-full" role="img" aria-label="A football pitch and a basketball court with rising bars">
	<defs>
		<linearGradient id="aa-bar" x1="0" y1="1" x2="0" y2="0">
			<stop offset="0" style="stop-color: var(--color-pop)" />
			<stop offset="1" style="stop-color: var(--color-model)" />
		</linearGradient>
	</defs>
	<!-- pitch half -->
	<g transform="translate(20 120) skewX(-18)">
		<rect width="160" height="110" rx="14" style="fill: var(--color-model); opacity: 0.16" />
		<rect x="8" y="8" width="144" height="94" rx="8" fill="none" style="stroke: var(--color-model); stroke-width: 2; opacity: 0.7" />
		<line x1="80" y1="8" x2="80" y2="102" style="stroke: var(--color-model); stroke-width: 2; opacity: 0.7" />
		<circle cx="80" cy="55" r="18" fill="none" style="stroke: var(--color-model); stroke-width: 2; opacity: 0.7" />
	</g>
	<!-- court half -->
	<g transform="translate(180 120) skewX(-18)">
		<rect width="160" height="110" rx="14" style="fill: var(--color-book); opacity: 0.16" />
		<rect x="8" y="8" width="144" height="94" rx="8" fill="none" style="stroke: var(--color-book); stroke-width: 2; opacity: 0.75" />
		<path d="M152 30 a40 40 0 0 0 0 50" fill="none" style="stroke: var(--color-book); stroke-width: 2; opacity: 0.75" />
		<circle cx="80" cy="55" r="14" fill="none" style="stroke: var(--color-book); stroke-width: 2; opacity: 0.75" />
	</g>
	<!-- rising bars -->
	<g>
		<rect x="118" y="132" width="28" height="44" rx="7" fill="url(#aa-bar)" opacity="0.55" />
		<rect x="158" y="96" width="28" height="80" rx="7" fill="url(#aa-bar)" opacity="0.8" />
		<rect x="198" y="52" width="28" height="124" rx="7" fill="url(#aa-bar)" />
	</g>
	<!-- ball and spark -->
	<circle cx="86" cy="104" r="15" style="fill: var(--color-deep); stroke: var(--color-chalk); stroke-width: 2.5" />
	<path d="M86 92 l7 6 -3 9 h-8 l-3 -9z" style="fill: var(--color-chalk)" />
	<circle cx="276" cy="96" r="16" style="fill: var(--color-book)" />
	<path d="M260 96 h32 M276 80 v32" style="stroke: var(--color-deep); stroke-width: 2" />
	<path d="M250 40 l6 14 14 6 -14 6 -6 14 -6 -14 -14 -6 14 -6z" style="fill: var(--color-pop)" />
	<path d="M96 46 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4z" style="fill: var(--color-model)" />
</svg>
