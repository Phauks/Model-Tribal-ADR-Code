/**
 * The site's own keys, kept in Cloudflare Secrets Store and reached through
 * bindings (wrangler.jsonc, "secrets_store_secrets"; decision record 0053).
 * Nobody types these keys: each is a random value made once in the account's
 * Secrets Store, and the Worker reads it with get(). Keys from other
 * services, such as Stripe's and Lulu's, stay Worker secrets, because those
 * services give them out and no binding replaces them.
 *
 * A binding whose secret cannot be read counts as not set, so the feature it
 * guards stays off rather than the page failing.
 */

/** A Secrets Store binding: an account secret the Worker reads with get(). */
export interface StoredSecret {
	get(): Promise<string>;
}

const values = new WeakMap<StoredSecret, Promise<string | undefined>>();

/**
 * The secret's value, or nothing when there is no binding or the secret
 * cannot be read. The value is kept for the life of the Worker instance, since
 * these keys never change.
 */
export function storedSecret(binding: StoredSecret | undefined): Promise<string | undefined> {
	if (!binding) return Promise.resolve(undefined);
	let value = values.get(binding);
	if (!value) {
		value = binding.get().then(
			(text) => (typeof text === 'string' && text.trim() !== '' ? text.trim() : undefined),
			(problem) => {
				console.error('A Secrets Store secret could not be read.', problem);
				values.delete(binding);
				return undefined;
			}
		);
		values.set(binding, value);
	}
	return value;
}
