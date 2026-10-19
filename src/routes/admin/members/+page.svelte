<script lang="ts">
 import {auth} from '#lib/auth.svelte.ts';
 import {anyApi} from 'convex/server';
 import {untrack} from 'svelte';
 let inviteEnabled=$state(true),rows=$state<any[]>([]),cursor=$state<string|null>(null),done=$state(false),busy=$state(false),error=$state('');
 let drafts=$state<Record<string,{status:string;period:string}>>({}),saving=$state<Record<string,boolean>>({}),messages=$state<Record<string,string>>({}),failed=$state<Record<string,boolean>>({});
 let histories=$state<Record<string,any>>({}),historyErrors=$state<Record<string,string>>({});
 let gateways=$state<any>(null);
 const periods=[['keep','Keep current access'],['week','1 week from now'],['fortnight','2 weeks from now'],['month','1 month from now'],['quarter','3 months from now'],['halfyear','6 months from now'],['free','Permanent free'],['none','Remove complimentary access']];
 const date=(value:number)=>new Date(value).toLocaleString('en-NG',{timeZone:'Africa/Lagos',dateStyle:'medium',timeStyle:'short'});
 async function toggleInvite(){if(!auth.client)return;try{await auth.client.mutation(anyApi.testers.setInvitation,{enabled:!inviteEnabled});inviteEnabled=!inviteEnabled;}catch(e){error=(e as Error).message;}}
 async function load(reset=false){if(!auth.client||busy)return;busy=true;error='';try{
  if(reset){inviteEnabled=(await auth.client.query(anyApi.testers.invitation,{})).enabled;gateways=await auth.client.query(anyApi.payments.configuration,{});}
  const r=await auth.client.query(anyApi.testers.members,{paginationOpts:{numItems:25,cursor:reset?null:cursor}});
  rows=reset?r.page:[...rows,...r.page];for(const user of r.page)if(!drafts[user.id])drafts[user.id]={status:user.access?.status??'active',period:'keep'};
  cursor=r.continueCursor;done=r.isDone;
 }catch(e){error=(e as Error).message;}finally{busy=false;}}
 $effect(()=>{const client=auth.client;if(client)untrack(()=>{void load(true);});});
 async function update(id:string){if(!auth.client||saving[id])return;saving[id]=true;messages[id]='';failed[id]=false;try{
  const access=await auth.client.mutation(anyApi.testers.setAccess,{userId:id,...drafts[id]});
  rows=rows.map(user=>user.id===id?{...user,access}:user);drafts[id].period='keep';delete histories[id];messages[id]='This account was updated. Other members were not changed.';
 }catch(e){failed[id]=true;messages[id]=(e as Error).message;}finally{saving[id]=false;}}
 async function history(id:string){if(!auth.client||histories[id])return;historyErrors[id]='';try{histories[id]=await auth.client.query(anyApi.testers.history,{userId:id});}catch(e){historyErrors[id]=(e as Error).message;}}
</script>
<svelte:head><title>Member access — PuntersEdge</title></svelte:head>
<header><p class="text-sm font-semibold uppercase tracking-widest text-model">Account operations</p><h1 class="mt-2 text-3xl font-bold">Members & tester access</h1><p class="mt-3 max-w-3xl text-haze">Manage each person's status and access independently. Signup, billing and server-recorded access events appear alongside sampled client activity.</p><div class="mt-4 flex flex-wrap gap-3"><button class="btn-ghost" onclick={toggleInvite}>{inviteEnabled?'Pause new tester invitations':'Enable tester invitations'}</button><button class="btn-ghost" onclick={()=>load(true)} disabled={busy}>Refresh members</button></div></header>
{#if gateways}<details class="surface mt-5 p-4"><summary class="min-h-11 cursor-pointer font-semibold">Payment gateway configuration</summary><div class="mt-3 grid gap-3 sm:grid-cols-2">{#each ['flutterwave','korapay'] as provider}<div class="rounded-xl border border-line p-4"><h2 class="font-semibold capitalize">{provider}</h2><p class="mt-1 text-sm text-haze">{gateways[provider].ready?'Enabled and configured':'Not ready for checkout'}</p><p class="mt-2 break-all text-xs text-haze">Webhook: {gateways[provider].webhook}</p><p class="mt-2 text-xs text-haze">{gateways[provider].detail}</p></div>{/each}</div><p class="mt-3 text-xs text-haze">Configuration alone does not prove a successful live payment. Verify provider delivery and a real settled transaction before treating acceptance as complete.</p></details>{/if}
{#if error}<p role="alert" class="mt-4 rounded-xl tint-loss p-4 text-loss">{error}</p>{/if}
<div class="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
{#each rows as user(user.id)}
<article class="surface min-w-0 break-words p-5" aria-label="Member {user.email}">
 <div class="flex flex-wrap items-start justify-between gap-3"><h2 class="font-bold">{user.profile?.fullName??user.name??'Member'}</h2><span class="rounded-full bg-raised px-3 py-1 text-xs text-haze">{user.emailVerified?'Email verified':'Awaiting verification'}</span></div>
 <p class="mt-1 text-sm text-haze">{user.email}</p><p class="mt-1 break-all text-xs text-haze">User ID {user.id}</p><p class="mt-2 text-xs text-haze">Registered {date(user.joined)} WAT</p>
 {#if user.profile}<p class="mt-3 text-sm">{user.profile.whatsapp} · {user.profile.sex}<br/>{user.profile.state} / {user.profile.lga}<br/>Date of birth: {user.profile.dob}</p>{/if}
 <p class="mt-3 text-sm">{user.access?.status??'active'} · {user.access?.kind??'member'} · {user.access?.grant??'No complimentary access'}{user.access?.expiresAt?' · Until '+date(user.access.expiresAt)+' WAT':''}</p>
 <p class="mt-2 text-xs text-haze">Paid subscription: {user.subscription?`valid until ${date(user.subscription.expiresAt)} WAT`:'No paid subscription recorded'}</p>
 {#if user.latestPayment}<p class="mt-2 text-sm text-book">{user.latestPayment.diagnostic?'Unpaid integration check':'Latest payment attempt'}: {user.latestPayment.provider} · {user.latestPayment.status.replaceAll('_',' ')} · ₦{user.latestPayment.amount.toLocaleString('en-NG')}</p>{/if}
 <p class="mt-2 text-xs text-haze">{user.presence?((Date.now()-user.presence.lastSeen<360000?'🟢 Recently active':'⚪ Last seen')+' · '+date(user.presence.lastSeen)+' WAT · '+user.presence.route):'No sampled activity recorded'}</p>
 <fieldset class="mt-5 rounded-xl border border-line bg-ink p-4" disabled={saving[user.id]}><legend class="px-1 text-sm font-semibold">Change this account only</legend><div class="grid gap-3 sm:grid-cols-2"><label class="text-sm" for={'status-'+user.id}>Account status<select aria-label="Account status" id={'status-'+user.id} bind:value={drafts[user.id].status} class="mt-1 block min-h-11 w-full rounded-xl border border-line bg-deep p-3"><option value="active">Active</option><option value="suspended">Suspended</option><option value="deactivated">Deactivated</option></select></label><label class="text-sm" for={'period-'+user.id}>Complimentary access<select aria-label="Complimentary access" id={'period-'+user.id} bind:value={drafts[user.id].period} class="mt-1 block min-h-11 w-full rounded-xl border border-line bg-deep p-3">{#each periods as [key,label]}<option value={key}>{label}</option>{/each}</select></label></div><p class="mt-3 text-xs text-haze">A status change with “Keep current access” preserves the existing trial dates. Removing complimentary access does not cancel paid subscription time. Suspension blocks access.</p><button class="btn-primary mt-4 w-full" onclick={()=>update(user.id)} disabled={saving[user.id]}>{saving[user.id]?'Saving this account…':'Apply status & access to this user'}</button></fieldset>
 {#if messages[user.id]}<p role="status" class="mt-3 text-sm" class:text-loss={failed[user.id]} class:text-model={!failed[user.id]}>{messages[user.id]}</p>{/if}
 <details class="mt-4 text-sm" ontoggle={e=>{if(e.currentTarget.open)void history(user.id);}}><summary class="min-h-11 cursor-pointer font-semibold text-pop">Signup, payments & access history</summary>
 {#if historyErrors[user.id]}<p role="alert" class="mt-2 text-loss">{historyErrors[user.id]}</p>{:else if histories[user.id]}
 <h3 class="mt-3 font-semibold">Payment attempts</h3><ul class="mt-2 space-y-3">{#each histories[user.id].payments as payment}<li class="rounded-xl border border-line p-3"><p>{payment.diagnostic?'Integration check · ':''}{payment.provider} · {payment.status.replaceAll('_',' ')} · ₦{payment.amount.toLocaleString('en-NG')}</p><p class="mt-1 break-all text-xs text-haze">{payment.reference}</p><p class="mt-1 text-xs text-haze">{date(payment.createdAt)} WAT{payment.paidAt?' · Verified '+date(payment.paidAt):''}</p></li>{:else}<li class="text-haze">No payment attempts recorded.</li>{/each}</ul>
 <h3 class="mt-4 font-semibold">Server-recorded account events</h3><ul class="mt-2 space-y-2 text-xs text-haze">{#each histories[user.id].events as event}<li>{date(event.createdAt)} WAT · {event.event.replaceAll('_',' ')}{event.provider?' · '+event.provider:''}</li>{:else}<li>No server events retained for this account yet.</li>{/each}</ul>
 <h3 class="mt-4 font-semibold">Administrator changes</h3><ul class="mt-2 space-y-2 text-xs text-haze">{#each histories[user.id].accessChanges as event}<li>{date(event.createdAt)} WAT · {event.operation}</li>{:else}<li>No administrator changes recorded.</li>{/each}</ul>
 {:else}<p role="status" class="mt-2 text-haze">Loading this member's history…</p>{/if}</details>
 <details class="mt-3 text-xs"><summary class="min-h-11 cursor-pointer text-pop">Recent client-reported activity</summary><ul class="mt-2 space-y-2 text-haze">{#each user.presence?.events??[] as event}<li>{date(event.at)} WAT · {event.event.replaceAll('_',' ')} · {event.route}</li>{:else}<li>No action history reported yet.</li>{/each}</ul></details>
</article>
{:else}<p class="surface p-6 text-haze">{busy?'Loading members…':'No members loaded.'}</p>{/each}
</div>{#if !done}<button class="btn-ghost mt-4" disabled={busy} onclick={()=>load()}>Load more members</button>{/if}
