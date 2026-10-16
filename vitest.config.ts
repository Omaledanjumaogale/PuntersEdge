import { defineConfig } from 'vitest/config';
import {fileURLToPath} from 'node:url';
export default defineConfig({
 resolve:{alias:{'cloudflare:workers':fileURLToPath(new URL('./test/backend/worker-env.mock.ts',import.meta.url))}},
 test: { include: ['test/backend/**/*.test.ts'], environment: 'node', maxWorkers: 2 },
});
