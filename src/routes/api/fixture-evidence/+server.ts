import type {RequestHandler} from './$types';
/** Retired member endpoint: recurrence proof is available only in the admin workspace. */
export const GET:RequestHandler=async()=>new Response('Administrator evidence workspace required',{status:403,headers:{'Cache-Control':'private, no-store'}});
