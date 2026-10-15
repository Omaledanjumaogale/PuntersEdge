<script lang="ts">import {app} from '#lib/state.svelte.ts';</script>
<svg class:still={!app.settings.motion} viewBox="0 0 240 140" fill="none" aria-hidden="true" class="console-art">
 <path d="M25 110H215M25 75H215M25 40H215" stroke="currentColor" opacity=".15"/>
 <path d="M30 100L65 86L100 93L135 56L170 64L210 29" stroke="var(--color-model)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
 <path d="M30 100L65 86L100 93L135 56L170 64L210 29V115H30Z" fill="var(--color-model)" opacity=".08"/>
 <g class="signal"><circle cx="135" cy="56" r="10" stroke="var(--color-model)" opacity=".4"/><circle cx="135" cy="56" r="4" fill="var(--color-model)"/></g>
 <path d="M170 18L183 31L170 44L157 31Z" fill="var(--color-pop)" opacity=".75"/>
 <rect x="28" y="17" width="61" height="20" rx="10" fill="var(--color-raised)"/><circle cx="41" cy="27" r="3" fill="var(--color-model)"/><path d="M51 27H77" stroke="currentColor" opacity=".5"/>
</svg>
<style>.console-art{width:240px;max-width:100%;color:var(--color-haze)}.signal{transform-origin:135px 56px;animation:signal 4s ease-in-out infinite}.still .signal{animation:none}@keyframes signal{50%{opacity:.5;transform:scale(1.15)}}@media(prefers-reduced-motion:reduce){.signal{animation:none}}</style>
