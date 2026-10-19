import type {MutationCtx} from '../_generated/server';
import type {Id} from '../_generated/dataModel';
export async function accountEvent(ctx:MutationCtx,userId:Id<'users'>,event:string,details:{reference?:string;provider?:string}={}) {
 await ctx.db.insert('account_events',{userId,event,...details,createdAt:Date.now()});
}
/** Keyed to immutable auth subject, including pending email verification. No password/session data. */
export async function syncAuthAccount(ctx:MutationCtx,doc:{_id:string;name?:string|null;email?:string|null;image?:string|null;emailVerified?:boolean;createdAt?:number;_creationTime?:number},created=false){
 const row=await ctx.db.query('users').withIndex('by_auth_subject',q=>q.eq('authSubject',doc._id)).unique();
 const values={authSubject:doc._id,registeredAt:doc.createdAt??doc._creationTime??row?.registeredAt??Date.now(),name:doc.name??undefined,email:doc.email??undefined,image:doc.image??undefined,emailVerificationTime:doc.emailVerified?(row?.emailVerificationTime??Date.now()):undefined};
 const userId=row?row._id:await ctx.db.insert('users',values);
 if(row&&Object.entries(values).some(([key,value])=>row[key as keyof typeof row]!==value))await ctx.db.patch(row._id,values);
 if(!row)await accountEvent(ctx,userId,created?'signup_created':'signup_imported');
 if(doc.emailVerified&&!row?.emailVerificationTime)await accountEvent(ctx,userId,'email_verified');
 return userId;
}
