<script lang="ts">
 import {identityParts,selectionSide} from '#lib/selection-identity.js';
 let {selection,home='',away='',neutral=false,showTag=true}:{selection:{id?:string;market?:string;selection:string};home?:string;away?:string;neutral?:boolean;showTag?:boolean}=$props();
 const parts=$derived(identityParts(selection.selection,home,away));const side=$derived(selectionSide(selection,home,away));const named=$derived(parts.some(p=>p.side));
</script>
{#if side&&showTag}<small class:side-home={side==='home'} class:side-away={side==='away'} class="side-tag">{neutral?(side==='home'?'Player 1':'Player 2'):(side==='home'?'Home':'Away')}{#if !named} · {side==='home'?home:away}{/if}</small>{/if}
<span>{#each parts as part,i(i)}<span class:side-home={part.side==='home'} class:side-away={part.side==='away'}>{part.text}</span>{/each}</span>
<style>.side-tag{display:block;font-size:10px;font-weight:650;line-height:1.5;margin-bottom:2px;overflow-wrap:anywhere}</style>
