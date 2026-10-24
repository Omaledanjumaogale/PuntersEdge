<script lang="ts">
 import {pct,odds} from '#lib/format.ts';
 let {evidence}:{evidence?:any}=$props();
</script>
<details class="mt-1 rounded-xl border border-line bg-ink/40 text-xs">
 <summary class="min-h-9 cursor-pointer px-2 py-2 font-semibold text-model">Selection evidence & alternatives</summary>
 <div class="space-y-2 border-t border-line p-3 leading-relaxed">
 {#if evidence}
 <p class="font-semibold">Saved pre-match evidence · model {pct(evidence.modelProbability,1)}</p>
 <p>{evidence.basis}</p><p>{evidence.verdict?'Passed the published value screen':'Model projection; no confirmed value verdict'}. Likelihood band {evidence.likelihoodBand}.</p>
 {#if evidence.observedAt}<p class="text-haze">Quote observed {new Date(evidence.observedAt).toLocaleString('en-NG')}</p>{/if}
 <ul class="grid gap-2">{#each evidence.alternatives as other}<li class="rounded-lg border border-line p-2"><strong>{other.selection}</strong><br />{other.market} · Model {pct(other.modelProb,1)} · {other.odds>1?odds(other.odds):'Unpriced'}</li>{:else}<li>No alternatives were recorded.</li>{/each}</ul>
 <p class="text-haze">Historical snapshot, not a new recommendation or measured selection accuracy.</p>
 {:else}<p class="text-haze">No pre-match evidence snapshot was saved for this legacy selection. The recorded pick and result remain available; retrospective evidence is not invented.</p>{/if}
 </div>
</details>
