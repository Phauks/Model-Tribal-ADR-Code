/**
 * The Worker's bindings and secrets. With @sveltejs/adapter-cloudflare 9 they
 * come from the "cloudflare:workers" module rather than from SvelteKit's
 * platform object. Only pages the Worker renders on request may call this:
 * prerendered pages are built without a Worker.
 */
import { env, waitUntil } from 'cloudflare:workers';

export function workerEnvironment(): WorkerEnvironment {
	return env;
}

/**
 * Keeps work going after the page has answered, such as sending a message
 * when the pause before it goes has ended. A Worker may keep working for up
 * to 30 seconds after answering (Cloudflare, "Context (ctx)", waitUntil).
 * A problem is logged, since nobody is waiting for the answer.
 */
export function afterResponse(work: Promise<unknown>): void {
	waitUntil(work.catch((problem) => console.error('Work after the response failed', problem)));
}
