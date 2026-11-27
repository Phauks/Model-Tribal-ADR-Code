/**
 * The site key of the "are you a person?" check (src/lib/server/turnstile.ts),
 * for forms on pages built ahead of time, which cannot ask the Worker while
 * they are built. Asked once per page from /sign-in/options; nothing while
 * the check is off or the answer does not come.
 */
let asking: Promise<string | undefined> | undefined;

export function turnstileKey(): Promise<string | undefined> {
	asking ??= fetch('/sign-in/options', { headers: { accept: 'application/json' } })
		.then((response) => (response.ok ? response.json() : {}))
		.then((options: { turnstileSiteKey?: string | null }) => options.turnstileSiteKey ?? undefined)
		.catch(() => {
			asking = undefined;
			return undefined;
		});
	return asking;
}
