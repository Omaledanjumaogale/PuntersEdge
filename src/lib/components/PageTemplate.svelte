<script lang="ts">
 import type { Snippet } from 'svelte';
 import TLDRBlock from './TLDRBlock.svelte';import AuthorCard from './AuthorCard.svelte';import RelatedLinks from './RelatedLinks.svelte';
 let { title, answer, modified, children, sources = [] }: { title: string; answer: string; modified?: string; children: Snippet; sources?: {title: string;href: string}[] } = $props();
</script>
<article><h1 class="text-3xl font-bold text-chalk">{title}</h1><TLDRBlock {answer} />{#if modified}<p class="text-sm text-haze">Last updated <time datetime={modified}>{modified}</time></p>{/if}{@render children()}<AuthorCard /><RelatedLinks />{#if sources.length}<section aria-labelledby="sources-heading"><h2 id="sources-heading" class="text-xl font-bold">What are the sources?</h2><ul>{#each sources as source}<li><cite><a class="underline" href={source.href}>{source.title}</a></cite></li>{/each}</ul></section>{/if}</article>
