<script lang="ts">
 import type { Snippet } from 'svelte';
 let { text, children }: { text: string; children: Snippet } = $props();
 const id = $props.id();
 let visible = $state(false);
</script>
<svelte:window onkeydown={(event) => { if (event.key === 'Escape') visible = false; }} />
<span role="group" class="relative inline-flex" onpointerenter={() => visible = true} onpointerleave={() => visible = false} onfocusin={() => visible = true} onfocusout={() => visible = false}>
 <span aria-describedby={visible ? id : undefined}>{@render children()}</span>
 {#if visible}<span {id} role="tooltip" class="pointer-events-none absolute bottom-full left-1/2 z-[80] mb-2 w-max max-w-56 -translate-x-1/2 rounded-xl bg-chalk px-3 py-2 text-xs text-ink shadow-lg">{text}</span>{/if}
</span>
