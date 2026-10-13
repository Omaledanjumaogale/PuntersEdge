<script lang="ts">
 import { toast } from '#lib/toast.svelte.ts';
 import { X, CircleCheck, CircleAlert, Info } from 'lucide-svelte';
</script>
<div class="pointer-events-none fixed inset-x-0 top-[calc(4.75rem+env(safe-area-inset-top))] z-[90] mx-auto flex max-w-md flex-col gap-2 px-4" aria-label="Notifications">
 {#each toast.items as item (item.id)}
  <div role={item.kind === 'error' ? 'alert' : 'status'} class="pointer-events-auto flex items-center gap-3 rounded-2xl bg-raised p-3 text-sm text-chalk shadow-xl ring-1 ring-line">
   {#if item.kind === 'error'}<CircleAlert class="h-5 w-5 shrink-0 text-loss" />{:else if item.kind === 'success'}<CircleCheck class="h-5 w-5 shrink-0 text-model" />{:else}<Info class="h-5 w-5 shrink-0 text-pop" />{/if}
   <p class="min-w-0 flex-1 break-words">{item.message}</p>
   <button onclick={() => toast.dismiss(item.id)} aria-label="Dismiss notification" class="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-ink"><X class="h-4 w-4" /></button>
  </div>
 {/each}
</div>
