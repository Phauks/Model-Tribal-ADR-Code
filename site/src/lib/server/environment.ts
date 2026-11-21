/**
 * The Worker's bindings and secrets. With @sveltejs/adapter-cloudflare 9 they
 * come from the "cloudflare:workers" module rather than from SvelteKit's
 * platform object. Only pages the Worker renders on request may call this:
 * prerendered pages are built without a Worker.
 */
import { env } from 'cloudflare:workers';

export function workerEnvironment(): WorkerEnvironment {
	return env;
}
