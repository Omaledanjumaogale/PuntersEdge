<script lang="ts">
 import {page} from '$app/state';
 import {auth} from '#lib/auth.svelte.ts';
 import {ADMIN_NAV,adminActive,NAV} from '#lib/nav.ts';
 import ProfileAvatar from '#lib/components/ProfileAvatar.svelte';
 let {children}=$props();
</script>
<div class="admin-shell">
 <aside class="admin-rail" aria-label="Administration workspaces">
  <div class="rail-brand"><span aria-hidden="true">💎</span><div><strong>PuntersEdge</strong><p>Administration</p></div></div>
  <p class="rail-label">Workspace</p>
  <nav>{#each ADMIN_NAV as item}<a href={item.href} aria-current={adminActive(page.url.pathname,page.url.search,item.section)?'page':undefined}><span aria-hidden="true">{item.emoji}</span><span><strong>{item.label}</strong><small>{item.hint}</small></span></a>{/each}</nav>
  <p class="rail-label">Application</p>
  <nav>{#each NAV.filter(n=>['/board','/value-bets','/results','/settings'].includes(n.href)) as item}<a href={item.href}><span aria-hidden="true">{item.emoji}</span><span><strong>{item.label}</strong><small>{item.hint}</small></span></a>{/each}</nav>
  <a class="rail-profile" href="/account"><ProfileAvatar/><span><strong>{auth.displayName}</strong><small>Account & security</small></span></a>
 </aside>
 <div class="admin-content">
  <div class="workspace-bar"><span>Private workspace <span aria-hidden="true">/</span> <strong>{ADMIN_NAV.find(n=>adminActive(page.url.pathname,page.url.search,n.section))?.label??'Administration'}</strong></span><a href="/board">Open application ↗</a></div>
  <nav class="mobile-workspaces" aria-label="Admin workspaces">{#each ADMIN_NAV as item}<a href={item.href} aria-current={adminActive(page.url.pathname,page.url.search,item.section)?'page':undefined}><span aria-hidden="true">{item.emoji}</span> {item.label}</a>{/each}</nav>
  {#if auth.viewer?.adminMfaRequired&&!auth.viewer.twoFactorEnabled}<section class="surface p-6"><h1 class="text-2xl font-bold">Secure your administrator account</h1><p class="mt-3 text-haze">Set up an authenticator and save recovery codes to continue. Application membership remains available.</p><a class="btn-primary mt-4 inline-flex" href="/account/security">Set up authenticator</a></section>{:else}{@render children()}{/if}
 </div>
</div>
