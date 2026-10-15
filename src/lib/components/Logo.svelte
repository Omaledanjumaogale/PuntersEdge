<script lang="ts">
 /** Shared diamond/key mark across navigation, browser identity and install assets. */
 let {size=32,wordmark=true}:{size?:number;wordmark?:boolean}=$props();
</script>
<span class="inline-flex min-w-0 items-center gap-2">
 <img src="/icons/icon.svg" width={size} height={size} alt="" aria-hidden="true" class="shrink-0 rounded-xl"/>
 {#if wordmark}<span class="font-display text-[1.15rem] font-extrabold tracking-tight text-chalk">Punters<span class="brand-text">Edge</span></span>{/if}
</span>
