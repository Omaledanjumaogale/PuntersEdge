import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Guards the E-WIN single sign-on wiring that a previous copy of this file got
// wrong in every platform repository: Convex names a function
// "module:function" on /api/action, while the "/" form belongs to /api/run.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the SSO callback redeems through the Convex module:function path form', () => {
  const callback = read('src/routes/auth/ewin/callback/+page.server.ts');
  assert.match(callback, /path: 'ewin:redeem'/);
  assert.doesNotMatch(callback, /path: 'ewin\/redeem'/);
});

test('the SSO callback never hardcodes a secure cookie', () => {
  const callback = read('src/routes/auth/ewin/callback/+page.server.ts');
  assert.doesNotMatch(callback, /secure:\s*true/);
});

test('the start route targets the configured platform and the hub', () => {
  const start = read('src/routes/auth/ewin/start/+server.ts');
  assert.match(start, /https:\/\/ewinproject\.org/);
  assert.match(start, /\/api\/sso\/start/);
  assert.match(start, /PLATFORM = 'puntersedge'/);
});

test('the platform contract declares the SSO integration', () => {
  const contract = JSON.parse(read('ewin.platform.json'));
  assert.equal(contract.platformId, 'puntersedge');
  assert.equal(contract.sso.status, 'ready');
  assert.equal(contract.contractVersion, '1.0.0');
});
