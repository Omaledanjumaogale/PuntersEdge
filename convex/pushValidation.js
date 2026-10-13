/** Restrict delivery destinations to browser push services, never arbitrary URLs. */
/** @param {{endpoint:string,p256dh:string,auth:string}} subscription */
export function validatePushSubscription(subscription) {
 const url = new URL(subscription.endpoint);
 const allowed = url.hostname === 'fcm.googleapis.com' || url.hostname === 'updates.push.services.mozilla.com' || url.hostname === 'web.push.apple.com' || url.hostname.endsWith('.push.apple.com');
 if(url.protocol !== 'https:' || !allowed || url.username || url.password || url.port || url.hash || subscription.endpoint.length>2048) throw new Error('Unsupported push service.');
 if(!/^[A-Za-z0-9_-]{87}$/.test(subscription.p256dh) || !/^[A-Za-z0-9_-]{22}$/.test(subscription.auth)) throw new Error('Invalid subscription encryption keys.');
 return true;
}
