<script lang="ts">
 import {page} from '$app/state';
</script>
<svelte:head><title>Page unavailable — PuntersEdge</title></svelte:head>
<section class="surface mx-auto max-w-xl p-6 sm:p-10">
 <p class="text-sm font-semibold text-model">PuntersEdge · {page.status}</p>
 <h1 class="mt-3 text-3xl font-bold">{page.status===404?'This page could not be found':'This page is temporarily unavailable'}</h1>
 <p class="mt-4 text-haze">Your saved selections remain on this device. Open the board to continue, or reload once if this happened during an update.</p>
 <div class="mt-6 flex flex-wrap gap-3"><a class="btn-primary" href="/board">Open board</a><a class="btn-secondary" href="/">Return home</a></div>
</section>
