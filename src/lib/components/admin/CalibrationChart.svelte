<script lang="ts">
 let { rows }: {rows:{label:string;n:number;modelMean:number|null;strikeRate:number|null}[]}=$props();
 const usable=$derived(rows.filter(row=>row.n>0&&row.modelMean!==null&&row.strikeRate!==null));
</script>
<div class="rounded-2xl bg-ink p-4 ring-1 ring-line">
 <h3 class="font-semibold">Probability calibration</h3><p class="mt-1 text-xs text-haze">Forecast probability against observed win rate. The diagonal is perfect calibration.</p>
 {#if usable.length}
  <svg viewBox="0 0 320 260" role="img" aria-label={`Calibration by forecast band. ${usable.map(row=>`${row.label}: forecast ${row.modelMean?.toFixed(1)} percent, observed ${row.strikeRate?.toFixed(1)} percent, ${row.n} binary outcomes`).join('; ')}`} class="mx-auto mt-3 w-full max-w-sm">
   {#each [0,25,50,75,100] as tick}
    <line x1="40" x2="280" y1={220-tick*2} y2={220-tick*2} stroke="currentColor" stroke-opacity=".12" />
    <text x="32" y={224-tick*2} text-anchor="end" fill="currentColor" font-size="10" class="text-haze">{tick}%</text>
    <text x={40+tick*2.4} y="238" text-anchor="middle" fill="currentColor" font-size="10" class="text-haze">{tick}</text>
   {/each}
   <line x1="40" y1="220" x2="280" y2="20" stroke="currentColor" stroke-dasharray="5 5" class="text-haze" />
   {#each usable as row}
    <circle cx={40+Math.max(0,Math.min(100,row.modelMean??0))*2.4} cy={220-Math.max(0,Math.min(100,row.strikeRate??0))*2} r={Math.min(12,4+Math.sqrt(row.n))} fill="currentColor" fill-opacity=".8" class="text-model"><title>{row.label}: forecast {row.modelMean?.toFixed(1)}%, observed {row.strikeRate?.toFixed(1)}%, {row.n} picks</title></circle>
   {/each}
   <text x="160" y="258" text-anchor="middle" fill="currentColor" font-size="11" class="text-haze">Forecast probability (%)</text>
  </svg>
 {:else}<div class="grid min-h-40 place-items-center text-center text-sm text-haze">Calibration appears after forecast picks settle.</div>{/if}
</div>
