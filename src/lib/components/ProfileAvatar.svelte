<script lang="ts">
 import {auth} from '#lib/auth.svelte.ts';
 let {size=40}:{size?:number}=$props();
 let failed=$state(false);
 const image=$derived(auth.viewer?.image);
 $effect(()=>{image;failed=false;});
</script>
<span class="profile-avatar" style:width="{size}px" style:height="{size}px" aria-hidden="true">
 {#if image&&!failed}<img src={image} alt="" referrerpolicy="no-referrer" onerror={()=>failed=true}/>{:else}{auth.initial}{/if}
</span>
<style>.profile-avatar{display:inline-grid;place-items:center;flex-shrink:0;border-radius:50%;background:var(--color-raised);color:var(--color-chalk);border:1px solid var(--color-line);font-weight:700;overflow:hidden}.profile-avatar img{width:100%;height:100%;object-fit:cover}</style>
