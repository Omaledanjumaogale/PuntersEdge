<script lang="ts">
 import type { Snippet } from 'svelte';
 import { ChevronDown } from 'lucide-svelte';
 let { title, count, open = false, children }: { title: string; count?: number; open?: boolean; children: Snippet } = $props();
</script>
<details class="surface group mt-5 overflow-hidden" {open}>
 <summary class="flex cursor-pointer list-none items-center justify-between gap-3 p-5 font-bold text-chalk focus-visible:outline-2 focus-visible:outline-pop [&::-webkit-details-marker]:hidden">
  <span class="flex min-w-0 items-center gap-3"><span>{title}</span>{#if count !== undefined}<span class="rounded-full bg-raised px-2.5 py-1 text-xs font-semibold text-haze">{count}</span>{/if}</span>
  <ChevronDown size={20} class="shrink-0 text-haze transition-transform group-open:rotate-180" />
 </summary>
 <div class="border-t border-line p-4 sm:p-5">{@render children()}</div>
</details>
