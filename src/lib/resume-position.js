/** Scroll position only: no credentials, entitlement or premium content is cached here. */
export const RESUME_KEY='pe:resume-position:v1';
/** @param {any} win @param {any} doc */
export function resumePosition(win,doc){
 const route=()=>win.location.pathname+win.location.search;let saved=null;
 try{saved=JSON.parse(win.sessionStorage.getItem(RESUME_KEY)??'null');}catch{}
 const reload=win.performance.getEntriesByType('navigation')[0]?.type==='reload'||doc.wasDiscarded;
 let pending=!!(reload&&saved?.route===route()&&Number.isFinite(saved.y)&&saved.y>0&&Date.now()-saved.at<86400000);
 let timer=0,timeout=0;
 /** @type {any} */ let observer=null;
 const save=()=>{if(pending)return;try{win.sessionStorage.setItem(RESUME_KEY,JSON.stringify({route:route(),y:win.scrollY,at:Date.now()}));}catch{}};
 const stopRestore=()=>{pending=false;observer?.disconnect();win.clearTimeout(timeout);};
 const restore=()=>{if(!pending)return;if(doc.documentElement.scrollHeight-win.innerHeight>=saved.y){stopRestore();win.scrollTo({top:saved.y,behavior:'instant'});}};
 const interact=()=>{if(pending)stopRestore();};
 const scroll=()=>{win.clearTimeout(timer);timer=win.setTimeout(save,300);};
 const hidden=()=>{if(doc.visibilityState==='hidden')save();};
 win.addEventListener('scroll',scroll,{passive:true});win.addEventListener('pagehide',save);doc.addEventListener('visibilitychange',hidden);
 for(const name of ['pointerdown','touchstart','keydown','wheel'])win.addEventListener(name,interact,{passive:true});
 if(pending){observer=new win.MutationObserver(restore);observer.observe(doc.documentElement,{childList:true,subtree:true});timeout=win.setTimeout(()=>{if(pending){stopRestore();win.scrollTo({top:saved.y,behavior:'instant'});}},15000);restore();}
 return ()=>{save();stopRestore();win.clearTimeout(timer);win.removeEventListener('scroll',scroll);win.removeEventListener('pagehide',save);doc.removeEventListener('visibilitychange',hidden);for(const name of ['pointerdown','touchstart','keydown','wheel'])win.removeEventListener(name,interact);};
}
