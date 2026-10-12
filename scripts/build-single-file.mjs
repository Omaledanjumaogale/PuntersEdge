/**
 * Builds a single self-contained HTML preview of the app from the production
 * client build — same components, engine and Three.js, with every chunk,
 * style and font inlined. Useful for sharing a demo anywhere a single file
 * can be hosted. Not used for the real deployment (no service worker).
 *
 *   npm run build && node scripts/build-single-file.mjs
 *   → dist-preview/index.html
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';

const out = resolve('.svelte-kit/cloudflare');
const html = readFileSync(join(out, 'index.html'), 'utf8');

const globalName = html.match(/(__sveltekit_\w+)\s*=/)?.[1];
const version = html.match(/version:\s*"([^"]+)"/)?.[1];
const start = html.match(/import\("\.\/(_app\/immutable\/entry\/start\.[^"]+)"\)/)?.[1];
const app = html.match(/import\("\.\/(_app\/immutable\/entry\/app\.[^"]+)"\)/)?.[1];
if (!globalName || !version || !start || !app) throw new Error('Could not parse SvelteKit bootstrap from index.html');

const entry = `
import * as kit from ${JSON.stringify(join(out, start))};
import * as app from ${JSON.stringify(join(out, app))};
globalThis.${globalName} = { base: '', version: ${JSON.stringify(version)} };
// The client router matches routes by pathname; start from the board.
try { if (location.pathname !== '/') history.replaceState(history.state, '', '/'); } catch {}
kit.init(globalThis.${globalName});
kit.start(app, document.getElementById('qe-root'));
`;

const result = await build({
	stdin: { contents: entry, resolveDir: out, loader: 'js' },
	bundle: true,
	format: 'esm',
	minify: true,
	write: false,
	target: 'es2022',
	logLevel: 'warning',
	plugins: [
		{
			// Every chunk is inlined, so Vite's preload helper has nothing to
			// fetch: drop its dependency lists so it imports directly.
			name: 'strip-vite-preload',
			setup(b) {
				b.onLoad({ filter: /_app[\\/]immutable[\\/].*\.js$/ }, (args) => ({
					contents: readFileSync(args.path, 'utf8').replace(/__vite__mapDeps\(\[[\d,]*\]\)/g, 'void 0'),
					loader: 'js'
				}));
			}
		}
	]
});
let js = result.outputFiles[0].text;

// Inline the icon used in the header.
const svg = readFileSync('static/icons/icon.svg');
js = js.replaceAll('/icons/icon.svg', `data:image/svg+xml;base64,${svg.toString('base64')}`);
js = js.replaceAll('</script', '<\\/script');

// Inline CSS with latin + latin-ext font subsets as data URIs.
const assets = join(out, '_app/immutable/assets');
const cssFile = readdirSync(assets).find((f) => f.endsWith('.css'));
let css = readFileSync(join(assets, cssFile), 'utf8');
css = css.replace(/@font-face\{[^}]*vietnamese[^}]*\}/g, '');
css = css.replace(/url\(\.?\/?([^)]+\.woff2)\)/g, (_, file) => {
	const name = file.split('/').pop();
	return `url(data:font/woff2;base64,${readFileSync(join(assets, name)).toString('base64')})`;
});

const page = `<title>PuntersEdge</title>
<meta name="theme-color" content="#0c1027">
<style>${css}</style>
<div id="qe-root" style="display:contents"></div>
<script type="module">${js}</script>
`;

mkdirSync('dist-preview', { recursive: true });
writeFileSync('dist-preview/index.html', page);
console.log(`dist-preview/index.html  ${(page.length / 1024).toFixed(0)} kB`);
