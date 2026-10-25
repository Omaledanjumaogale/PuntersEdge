/** Refresh private evidence independently of the main feed, without page reloads.
 * @param {{refresh:()=>Promise<void>,canRefresh:()=>boolean,onTick?:()=>void,now?:()=>number,target?:any,doc?:any,timers?:any}} options
 */
export function startEvidenceRefresh({refresh,canRefresh,onTick=()=>{},now=Date.now,target=window,doc=document,timers=globalThis}){
 let stopped=false,pending=false,lastAttempt=now();
 const request=async(minInterval=300000)=>{
  if(stopped||pending||doc.hidden||!canRefresh()||now()-lastAttempt<minInterval)return;
  lastAttempt=now();pending=true;
  try{await refresh();}catch{/* The page reports errors; the next scheduled attempt must still run. */}finally{pending=false;}
 };
 const tick=()=>{onTick();void request();};
 const wake=()=>{onTick();void request(60000);};
 const timer=timers.setInterval(tick,30000);
 target.addEventListener('focus',wake);target.addEventListener('online',wake);doc.addEventListener('visibilitychange',wake);
 return ()=>{stopped=true;timers.clearInterval(timer);target.removeEventListener('focus',wake);target.removeEventListener('online',wake);doc.removeEventListener('visibilitychange',wake);};
}
