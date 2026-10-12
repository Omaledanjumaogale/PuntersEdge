/**
 * Generates the RS256 key pair Convex Auth signs session tokens with and
 * prints the two environment variables to set on your Convex deployment.
 *
 *   node scripts/generate-auth-keys.mjs
 *   npx convex env set JWT_PRIVATE_KEY "<value>"
 *   npx convex env set JWKS '<value>'
 *   npx convex env set SITE_URL https://your-app.pages.dev
 *
 * Pass --apply to set JWT_PRIVATE_KEY and JWKS directly with the Convex CLI.
 */
import { generateKeyPairSync } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

// Convex env values are single-line: newlines become spaces (Convex Auth expects this).
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().trimEnd().replace(/\n/g, ' ');
const jwk = publicKey.export({ format: 'jwk' });
const jwks = JSON.stringify({ keys: [{ use: 'sig', alg: 'RS256', ...jwk }] });

if (process.argv.includes('--apply')) {
	const run = (name, value) => execFileSync('npx', ['convex', 'env', 'set', name, '--', value], { stdio: 'inherit' });
	run('JWT_PRIVATE_KEY', pem);
	run('JWKS', jwks);
	console.log('JWT_PRIVATE_KEY and JWKS set. Remember SITE_URL.');
} else {
	console.log(`JWT_PRIVATE_KEY="${pem}"`);
	console.log(`JWKS=${jwks}`);
}
