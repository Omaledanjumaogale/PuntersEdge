<script lang="ts">
 let { rows, metric = 'roi', title, description }: { rows: {label:string; value:number; n:number}[]; metric?:string; title:string; description:string } = $props();
 const extent = $derived(Math.max(1, ...rows.map(row => Math.abs(row.value))));
 const points = $derived(rows.map((row,index)=>`${rows.length === 1 ? 300 : 40 + index*520/Math.max(1,rows.length-1)},${110-row.value/extent*75}`).join(' '));
</script>
<div class="rounded-2xl bg-ink p-4 ring-1 ring-line">
 <h3 class="font-semibold">{title}</h3><p class="mt-1 text-xs text-haze">{description}</p>
 {#if rows.length}
  <svg viewBox="0 0 600 220" role="img" aria-label={`${title}. ${rows.map(row=>`${row.label}: ${row.value.toFixed(2)}${metric==='roi'?' percent':''}`).join('; ')}`} class="mt-3 w-full">
   <line x1="40" x2="560" y1="110" y2="110" stroke="currentColor" class="text-haze" stroke-opacity=".3" stroke-dasharray="5 5" />
   <text x="8" y="114" fill="currentColor" font-size="12" class="text-haze">0</text>
   <polyline points={points} fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" class="text-pop" />
   {#each rows as row,index}
    {@const x=rows.length===1?300:40+index*520/Math.max(1,rows.length-1)}
    <circle cx={x} cy={110-row.value/extent*75} r="4" fill="currentColor" class={row.value>=0?'text-model':'text-loss'}><title>{row.label}: {row.value.toFixed(2)}%, {row.n} picks</title></circle>
    {#if index===0 || index===rows.length-1}<text x={x} y="210" text-anchor={index===0?'start':'end'} fill="currentColor" font-size="11" class="text-haze">{row.label}</text>{/if}
   {/each}
  </svg>
 {:else}<div class="grid min-h-40 place-items-center text-center text-sm text-haze">Awaiting settled picks.</div>{/if}
</div>
