import test from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';
import {validatePushSubscription} from '../convex/pushValidation.js';
const keys={p256dh:'B'.repeat(87),auth:'A'.repeat(22)};
test('push endpoints accept supported HTTPS browser services',()=>{
 for(const endpoint of ['https://fcm.googleapis.com/fcm/send/token','https://updates.push.services.mozilla.com/wpush/v2/token','https://web.push.apple.com/token']) assert.equal(validatePushSubscription({endpoint,...keys}),true);
});
test('push endpoints reject SSRF, deceptive hosts and invalid keys',()=>{
 for(const endpoint of ['http://fcm.googleapis.com/token','https://127.0.0.1/','https://fcm.googleapis.com.attacker.example/token','https://attacker.example/push','https://fcm.googleapis.com:8443/token','https://user:pass@fcm.googleapis.com/token']) assert.throws(()=>validatePushSubscription({endpoint,...keys}));
 assert.throws(()=>validatePushSubscription({endpoint:'https://fcm.googleapis.com/token',...keys,auth:'invalid'}));
});
test('generated VAPID key pair signs a notification without network delivery',()=>{
 const vapid=webpush.generateVAPIDKeys();
 const request=webpush.generateRequestDetails({endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:vapid.publicKey,auth:Buffer.alloc(16).toString('base64url')}},JSON.stringify({title:'Results updated'}),{vapidDetails:{subject:'mailto:puntersedge@ewinproject.org',...vapid}});
 assert.equal(request.method,'POST');
 assert.match(request.headers.Authorization,/^vapid /);
 assert.equal(request.headers['Content-Encoding'],'aes128gcm');
 assert.ok(request.body.length>0);
});
