/** Copy injected deployment settings without logging credential values. */
import { spawnSync } from 'node:child_process';
const required = ['BETTER_AUTH_SECRET', 'SITE_URL', 'RESEND_FROM_EMAIL', 'PUNTERSEDGE_RESEND_API_KEY'];
const optional = ['API_SPORTS_KEY', 'API_FOOTBALL_KEY', 'THE_ODDS_API_KEY', 'ODDSPAPI_KEY', 'AGNES_AI_KEY', 'AGNES_AI_MODEL', 'AIHUBMIX_API_KEY', 'AIHUBMIX_BASE_URL', 'FLW_CLIENT_ID', 'FLW_API_VERSION', 'FLW_SECRET_KEY', 'FLW_SECRET_HASH',  'CONVEX_HTTP_ACTIONS_URL', 'SUPER_ADMIN_USER_ID', 'FLW_ENABLED', 'PUBLIC_VAPID_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'];
for (const name of ['CONVEX_DEPLOY_KEY', ...required]) {
 if (!process.env[name]) throw new Error(`Missing ${name}; add it securely in deployment settings.`);
}
if (process.env.BETTER_AUTH_SECRET.length < 32) throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters.');
const site = new URL(process.env.SITE_URL.split(',')[0]);
if (site.protocol !== 'https:') throw new Error('Production SITE_URL must use HTTPS.');
for (const name of [...required, ...optional]) {
 const value = process.env[name];
 if (!value) continue;
 const result = spawnSync('npx', ['convex', 'env', 'set', name, value], { stdio: ['ignore', 'pipe', 'pipe'] });
 if (result.status !== 0) throw new Error(`Setting ${name} failed. Check deployment authorization and network access; provider output withheld to protect credentials.`);
 console.log(`Configured ${name}`);
}
