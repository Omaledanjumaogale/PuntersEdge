<script lang="ts">
 import type { SEOConfig } from '#lib/types/seo.ts';
 let { meta }: { meta: SEOConfig } = $props();
</script>
<svelte:head>
 <title>{meta.title}</title>
 <meta name="description" content={meta.description} />
 <meta name="robots" content={meta.robots} />
 <link rel="canonical" href={meta.canonical} />
 <meta property="og:title" content={meta.openGraph.title} />
 <meta property="og:description" content={meta.openGraph.description} />
 <meta property="og:url" content={meta.canonical} />
 <meta property="og:type" content={meta.openGraph.type} />
 <meta property="og:locale" content={meta.openGraph.locale} />
 <meta property="og:site_name" content="PuntersEdge" />
 <meta name="twitter:card" content={meta.twitter.card} />
 <meta name="twitter:title" content={meta.title} />
 <meta name="twitter:description" content={meta.description} />
 {#if meta.image}<meta property="og:image" content={meta.image} /><meta name="twitter:image" content={meta.image} />{/if}
 {@html `<script type="application/ld+json">${meta.jsonLd}</script>`}
</svelte:head>
