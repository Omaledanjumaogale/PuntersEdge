/** Realtime, user-scoped betslip synchronization with visible failure feedback. */
import { app, DEFAULT_SETTINGS, type SlipItem } from '#lib/state.svelte.ts';
import { auth } from '#lib/auth.svelte.ts';
import { toast } from '#lib/toast.svelte.ts';
import { api } from '../../convex/_generated/api.js';

const ownerGet = (key:string) => { try { return localStorage.getItem(key); } catch { return null; } };
const ownerSet = (key:string,value:string) => { try { localStorage.setItem(key,value); } catch { /* session-only state */ } };
const payload = (items: SlipItem[]) => items.map(({ fixtureId, sport, matchTitle, market, selection, bookmaker, odds, modelProb, pushProb, edgePercent, marketKey }) => ({ fixtureId, sport, matchTitle, market, selection, bookmaker, odds, modelProb, pushProb, edgePercent, marketKey }));
export function startSlipSync(): () => void {
 if (typeof window === 'undefined' || auth.mode !== 'convex') return () => {};
 let timer: ReturnType<typeof setTimeout> | undefined;
 let unsubscribe: (() => void) | undefined;
 let owner: string | null = null;
 let ready = $state(false);
 let remoteJson = '';
 const dispose = $effect.root(() => {
  $effect(() => {
   const client = auth.client, userId = auth.viewer?.id;
   unsubscribe?.(); unsubscribe = undefined; clearTimeout(timer); ready = false;
   if (!client || !userId || !auth.viewer?.activeSubscription) {
    if (owner) { app.slip = []; owner = null; }
    return;
   }
   const priorOwner = ownerGet('pe:slip:owner');
   if (priorOwner && priorOwner !== userId) app.slip = [];
   ownerSet('pe:slip:owner', userId); owner = userId;
   unsubscribe = client.onUpdate(api.betslip.mine, {}, saved => {
    if (owner !== userId) return;
    const incoming: SlipItem[] = (saved?.items ?? []).map(i => ({ ...i, id: i.marketKey ? `${i.fixtureId}:${i.marketKey}` : `${i.fixtureId}:saved:${i.selection}`, sport: i.sport as SlipItem['sport'], modelProb: i.modelProb ?? 1 / i.odds }));
    remoteJson = JSON.stringify(payload(incoming));
    if (saved || ready) {
     if (JSON.stringify(payload(app.slip)) !== remoteJson) app.slip = incoming;
    }
    ready = true;
   }, () => { ready = false; toast.error('Your betslip could not synchronize. Check your connection.'); });
  });
  $effect(() => {
   const client = auth.client, userId = auth.viewer?.id;
   const items = payload($state.snapshot(app.slip));
   clearTimeout(timer);
   if (!client || !userId || !ready || JSON.stringify(items) === remoteJson) return;
   timer = setTimeout(() => {
    if (owner !== userId) return;
    void client.mutation(api.betslip.save, { items, stake: 1000, betType: items.length > 1 ? 'accumulator' : 'single' }).catch(() => toast.error('Your betslip is saved on this device, but cloud sync failed.'));
   }, 600);
  });
 });
 return () => { dispose(); unsubscribe?.(); clearTimeout(timer); };
}

/** Profiles subscribe through auth.viewer; unchanged preferences never write. */
export function startSettingsSync(): () => void {
 if(typeof window==='undefined')return ()=>{};
 let owner:string|null=null,remoteJson='',ready=$state(false);
 let timer:ReturnType<typeof setTimeout>|undefined;
 const dispose=$effect.root(()=>{
  $effect(()=>{
   const viewer=auth.viewer;
   clearTimeout(timer);
   if(!viewer){if(owner){app.settings={...DEFAULT_SETTINGS};owner=null;}ready=false;return;}
   if(owner!==viewer.id){
    const prior=ownerGet('pe:settings:owner');
    if(prior&&prior!==viewer.id)app.settings={...DEFAULT_SETTINGS};
    ownerSet('pe:settings:owner',viewer.id);owner=viewer.id;
   }
   remoteJson=JSON.stringify(viewer.settings);
   if(viewer.settings)app.settings={...viewer.settings};
   ready=true;
  });
  $effect(()=>{
   const client=auth.client,userId=auth.viewer?.id,settings=$state.snapshot(app.settings);
   clearTimeout(timer);
   if(!client||!userId||!ready||JSON.stringify(settings)===remoteJson)return;
   timer=setTimeout(()=>{if(owner===userId)void client.mutation(api.users.updateSettings,{settings}).catch(()=>toast.error('Settings saved on this device; cloud synchronization failed.'));},700);
  });
 });
 return()=>{dispose();clearTimeout(timer);};
}
