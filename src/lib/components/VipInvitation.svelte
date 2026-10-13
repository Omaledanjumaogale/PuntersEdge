<script lang="ts">
 import {onMount} from 'svelte';
 import {vip} from '#lib/vip.svelte.ts';
 import {auth} from '#lib/auth.svelte.ts';
 import {premiumPath} from '#lib/access-routes.ts';
 import {page} from '$app/state';
 import {X,ShieldCheck} from 'lucide-svelte';
 let panel=$state<HTMLElement>();let previousFocus:HTMLElement|null=null;
 $effect(()=>{if(auth.viewer?.activeSubscription)vip.close();});
 $effect(()=>{if(page.url.searchParams.get('upgrade')==='1'&&!auth.viewer?.activeSubscription)vip.show();});
 $effect(()=>{if(vip.open){previousFocus=document.activeElement as HTMLElement;queueMicrotask(()=>panel?.focus());}else previousFocus?.focus();});
 function clicks(event:MouseEvent){if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||auth.viewer?.activeSubscription)return;const anchor=(event.target as Element)?.closest('a');if(!anchor)return;const url=new URL(anchor.href,location.href);if(url.origin===location.origin&&premiumPath(url.pathname)){event.preventDefault();vip.show();}}
 onMount(()=>{document.addEventListener('click',clicks,true);return()=>document.removeEventListener('click',clicks,true);});
 function key(event:KeyboardEvent){if(!vip.open)return;if(event.key==='Escape')vip.close();if(event.key==='Tab'){const elements=[...panel!.querySelectorAll<HTMLElement>('a,button')];const first=elements[0],last=elements.at(-1);if(event.shiftKey&&(document.activeElement===first||document.activeElement===panel)){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}}
</script>
<svelte:window onkeydown={key}/>
{#if vip.open}<div class="fixed inset-0 z-[70] flex items-center justify-center bg-ink/80 p-4 backdrop-blur-md"><div bind:this={panel} role="dialog" aria-modal="true" aria-labelledby="vip-title" tabindex="-1" class="relative w-full max-w-md rounded-3xl border border-line bg-deep p-6 shadow-2xl outline-none sm:p-8"><button onclick={()=>vip.close()} class="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-raised text-haze hover:text-chalk" aria-label="Close VIP invitation"><X size={20}/></button><ShieldCheck class="h-10 w-10 text-model"/><p class="mt-5 text-xs font-bold uppercase tracking-widest text-model">Exclusive VIP Punter</p><h2 id="vip-title" class="mt-2 text-3xl font-extrabold">Go beyond the preview.</h2><p class="mt-3 text-sm leading-relaxed text-haze">Subscribe to unlock full match analysis, more model projections, confidence percentages and predictions across all five sports, plus the advanced bet machine and saved tickets.</p><p class="mt-5 text-4xl font-extrabold">₦10,000<span class="ml-2 text-sm font-normal text-haze">per month</span></p><a href="/subscribe" onclick={()=>vip.close()} class="btn-primary mt-6 block text-center">Subscribe to Exclusive VIP</a><button class="mt-4 w-full text-sm font-semibold text-haze" onclick={()=>vip.close()}>Continue viewing the free board</button></div></div>{/if}
