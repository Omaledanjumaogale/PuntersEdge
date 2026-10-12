<script lang="ts">
	/** Segmented probability bar with labels; segments animate when values change. */
	interface Segment {
		label: string;
		value: number;
		tone: 'model' | 'neutral' | 'away';
	}
	let { segments }: { segments: Segment[] } = $props();
	const tone = { model: 'bg-model', neutral: 'bg-haze/50', away: 'bg-chalk/80' };
</script>

<div>
	<div class="flex h-2 gap-0.5 overflow-hidden rounded-full">
		{#each segments as s (s.label)}
			<div class="{tone[s.tone]} transition-[flex-grow] duration-700 ease-out" style="flex-grow: {s.value}"></div>
		{/each}
	</div>
	<div class="mt-1.5 flex justify-between gap-2 text-xs text-haze">
		{#each segments as s (s.label)}
			<span><span class="text-chalk">{(s.value * 100).toFixed(0)}%</span> {s.label}</span>
		{/each}
	</div>
</div>
