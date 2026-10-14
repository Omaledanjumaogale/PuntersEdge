<script lang="ts">
 let {selection,compact=false}:{selection:any;compact?:boolean}=$props();
 const o=$derived(selection?.opportunity);
</script>
{#if o}
 <div class="mt-2 min-w-0 max-w-full break-words text-xs">
  <p class="flex flex-wrap items-center gap-2 font-semibold">
   <span class="h-2.5 w-2.5 shrink-0 rounded-full {o.green?'bg-emerald-400 shadow-[0_0_8px_#34d399]':'bg-slate-500'}" aria-hidden="true"></span>
   <span>{o.green?(o.kind==='projection'?'Projection lean':o.validated?'Validated value':'Estimated value'):'No favourable price established'}{#if o.green} · screening {o.grade} · #{o.rank}{/if}</span>
  </p>
  {#if !compact}<details class="mt-1 text-haze"><summary class="cursor-pointer">Choice note · {o.compared} options reviewed</summary><p class="mt-2 leading-relaxed">{o.note}</p><p class="mt-2 leading-relaxed">{o.gradeBasis}</p></details>{/if}
 </div>
{/if}
