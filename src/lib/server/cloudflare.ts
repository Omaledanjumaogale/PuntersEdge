import {env} from 'cloudflare:workers';
/** SvelteKit 3 exposes bindings on the native Workers module, not RequestEvent.platform. */
export const runtimeEnv=(platform?:App.Platform):Record<string,unknown>=>platform?.env??env;
