export interface ActivityEvent {event:string;at:number;route:string}
const queue:ActivityEvent[]=[];
export function recordActivity(event:string){if(typeof window==='undefined')return;queue.push({event,at:Date.now(),route:window.location.pathname});if(queue.length>20)queue.shift();}
export function pendingActivity(){return queue.slice();}
export function acknowledgeActivity(events:ActivityEvent[]){for(const event of events){const i=queue.indexOf(event);if(i>=0)queue.splice(i,1);}}

export function clearActivity(){queue.length=0;}
