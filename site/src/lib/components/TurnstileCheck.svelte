<!--
	Cloudflare Turnstile's "are you a person?" check, placed inside a form just
	above its button (src/lib/server/turnstile.ts; decision record 0062). It
	stays out of sight unless Cloudflare is unsure about the visitor, and then
	shows a box to tick (approved mockup: design/sign-in-providers,
	b-turnstile). Cloudflare's script is loaded only on a page that shows a
	form with the check, and only once.

	The widget puts a single-use token in the form as cf-turnstile-response.
	If the form is sent before the token is ready, the sending waits for it.
	A form that stays on the page after an answer, such as the sign-in panel,
	asks for a fresh token by sending the event "turnstile-reset" to the form.
-->
<script lang="ts" module>
	interface TurnstileApi {
		render(container: HTMLElement, options: Record<string, unknown>): string;
		reset(widget: string): void;
		remove(widget: string): void;
		getResponse(widget: string): string | undefined;
	}

	declare global {
		interface Window {
			turnstile?: TurnstileApi;
		}
	}

	/** The event a form gets when it wants a fresh token. */
	export const turnstileResetEvent = 'turnstile-reset';

	let loading: Promise<TurnstileApi> | undefined;

	/** Loads Cloudflare's script once per page. */
	function loadTurnstile(): Promise<TurnstileApi> {
		if (window.turnstile) return Promise.resolve(window.turnstile);
		loading ??= new Promise<TurnstileApi>((resolve, reject) => {
			const script = document.createElement('script');
			script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
			script.async = true;
			script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile did not start')));
			script.onerror = () => {
				loading = undefined;
				reject(new Error('Turnstile could not be loaded'));
			};
			document.head.append(script);
		});
		return loading;
	}
</script>

<script lang="ts">
	interface Props {
		/** The public site key (TURNSTILE_SITE_KEY). */
		siteKey: string;
		/** Which form this is, checked by the server (src/lib/server/turnstile.ts, turnstileActions). */
		action: string;
	}

	let { siteKey, action }: Props = $props();

	/** Whether Cloudflare is showing its box, so the form leaves room for it. */
	let showing = $state(false);

	function attach(container: HTMLElement) {
		let widget: string | undefined;
		let api: TurnstileApi | undefined;
		let token = '';
		let waiting: { form: HTMLFormElement; submitter: HTMLElement | null } | undefined;
		let gone = false;
		const form = container.closest('form');

		const theme = () => {
			const chosen = document.documentElement.dataset.theme;
			return chosen === 'dark' || chosen === 'light' ? chosen : 'auto';
		};

		const sendWaiting = () => {
			if (!waiting) return;
			const { form: waitingForm, submitter } = waiting;
			waiting = undefined;
			waitingForm.requestSubmit(submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement ? submitter : undefined);
		};

		// Sent before the token is ready: hold the sending until it is. Listening
		// while capturing runs this before the form's own handlers.
		const holdUntilReady = (event: SubmitEvent) => {
			if (token || !api || widget === undefined) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			waiting = { form: event.currentTarget as HTMLFormElement, submitter: event.submitter };
		};

		const reset = () => {
			token = '';
			if (api && widget !== undefined) api.reset(widget);
		};

		form?.addEventListener('submit', holdUntilReady, { capture: true });
		form?.addEventListener(turnstileResetEvent, reset);

		loadTurnstile()
			.then((loaded) => {
				if (gone) return;
				api = loaded;
				widget = loaded.render(container, {
					sitekey: siteKey,
					action,
					appearance: 'interaction-only',
					size: 'flexible',
					theme: theme(),
					'response-field-name': 'cf-turnstile-response',
					callback: (value: string) => {
						token = value;
						sendWaiting();
					},
					'before-interactive-callback': () => {
						showing = true;
					},
					'after-interactive-callback': () => {
						showing = false;
					},
					'expired-callback': () => {
						token = '';
					},
					'error-callback': () => {
						token = '';
					}
				});
			})
			.catch((problem) => console.error(problem));

		return () => {
			gone = true;
			form?.removeEventListener('submit', holdUntilReady, { capture: true });
			form?.removeEventListener(turnstileResetEvent, reset);
			if (api && widget !== undefined) api.remove(widget);
		};
	}
</script>

<div class="turnstile" class:showing {@attach attach}></div>

<style>
	.turnstile.showing {
		margin: 0 0 var(--space-4);
	}

	.turnstile :global(iframe) {
		max-width: 100%;
	}
</style>
