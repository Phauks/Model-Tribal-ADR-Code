<!--
	The sign-in forms: email and password or a code, Create an account, and
	the code from the email (site/COLLABORATION.md, "How sign-in works"; site/DESIGN.md, section 6, "Masthead"). The sign-in
	page shows them, and so does the panel that the masthead's Sign in button
	opens (AccountLink.svelte), so people can sign in or make an account
	without leaving the page they are reading (Trevor, Nov. 23, 2026).

	On the page the forms are ordinary forms. In the panel they are sent
	without leaving the page, and each answer comes back through onchange;
	once signed in, the browser goes where the server says, which is usually
	the page it was on. Every form posts to /sign-in, so both work without
	scripts the same way.

	The panel follows its approved mockup (design/sign-in-popover): a problem
	shows as a short note at the top with a short error at the field, rather
	than the page's error summary; there is no hint under Password; and the
	confirm step has no "Keep me signed in" box, because the choice made on
	the step before it is carried along.

	The other ways to sign in, a passkey, Google and Microsoft, sit under "or"
	below the email and password, as Trevor chose on Nov. 26, 2026 (mockup B,
	design/sign-in-providers). A passkey is also offered in the email field's
	autofill where the browser can. Google and Microsoft show only once they
	are switched on (src/lib/server/outside-sign-in.ts). Forms that send email
	or try a password carry Cloudflare's "are you a person?" check
	(TurnstileCheck.svelte) when it is on.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import Mail from '@lucide/svelte/icons/mail';
	import Check from '@lucide/svelte/icons/check';
	import Circle from '@lucide/svelte/icons/circle';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import X from '@lucide/svelte/icons/x';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import { browserSupportsWebAuthn, browserSupportsWebAuthnAutofill, startAuthentication, WebAuthnAbortService } from '@simplewebauthn/browser';
	import type { SignInState } from '#lib/sign-in-state.ts';
	import CodeInput from './CodeInput.svelte';
	import TurnstileCheck, { turnstileResetEvent } from './TurnstileCheck.svelte';
	import ErrorSummary from './ErrorSummary.svelte';
	import PasswordInput from './PasswordInput.svelte';

	interface Props {
		/** What the last form sent back, if anything. */
		answer: SignInState | undefined;
		/** Whether this copy of the site can send codes by email. */
		codesAvailable: boolean;
		returnTo: string;
		/** Open on Create an account rather than on signing in. */
		creating?: boolean;
		/** Put before every id, so the panel's fields do not share ids with the page's. */
		prefix?: string;
		/** The heading's level: 1 on the sign-in page, 2 in the panel. */
		level?: 1 | 2;
		/** In the panel: forms are sent without leaving the page, and each answer comes here. */
		onchange?: (answer: SignInState) => void;
		/** In the panel: the Close button. */
		onclose?: () => void;
		/** The site key of the "are you a person?" check, when it is on (src/lib/server/turnstile.ts). */
		turnstileSiteKey?: string;
		/** Google and Microsoft, when switched on (src/lib/server/outside-sign-in.ts). */
		providers?: ('google' | 'microsoft')[];
	}

	let {
		answer,
		codesAvailable,
		returnTo,
		creating = false,
		prefix = '',
		level = 1,
		onchange,
		onclose,
		turnstileSiteKey,
		providers = []
	}: Props = $props();

	const providerNames = { google: 'Google', microsoft: 'Microsoft' } as const;

	const minimum = 15;
	const inPanel = $derived(Boolean(onchange));
	const step = $derived(answer?.step ?? (creating && codesAvailable ? 'create' : 'email'));
	const email = $derived(answer?.email ?? '');
	const keep = $derived(Boolean(answer?.keep));
	const problem = $derived(answer?.problem);
	const field = $derived(answer?.field);
	const paused = $derived(answer?.paused);
	const problems = $derived(problem && !inPanel ? [{ field: field ? `${prefix}${field}` : undefined, message: problem }] : []);
	/** In the panel, the field's own error is short; the note at the top says the rest. */
	const shortErrors: Record<string, string> = {
		email: 'Check your email address',
		password: 'Check your password',
		'new-password': 'Choose another password',
		code: 'Check the code'
	};
	const heading = $derived(
		step === 'code' ? 'Check your email' : step === 'create' ? 'Create an account' : 'Sign in'
	);
	const back = $derived(encodeURIComponent(returnTo));

	// The new password's length so far, counted as the server counts it: each Unicode code point once.
	let typedLength = $state(0);
	// Whether the new password is in Have I Been Pwned's list of leaked passwords, checked as it is typed (src/routes/sign-in/leaks/+server.ts). Only the first five characters of its SHA-1 hash leave the browser. The server checks again when the form is sent.
	let leaks = $state<'unchecked' | 'checking' | 'clear' | 'found' | 'unavailable'>('unchecked');
	let leakTimer: ReturnType<typeof setTimeout> | undefined;
	let leakAsked = 0;

	async function checkLeaks(password: string) {
		const asked = ++leakAsked;
		try {
			const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password.normalize('NFC')));
			const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
			const response = await fetch(`/sign-in/leaks?prefix=${hash.slice(0, 5)}`);
			if (!response.ok) throw new Error(`The leak check answered ${response.status}`);
			const suffix = hash.slice(5);
			const found = (await response.text()).split('\n').some((line) => {
				const [ending, count] = line.trim().split(':');
				return ending === suffix && Number(count) > 0;
			});
			if (asked === leakAsked) leaks = found ? 'found' : 'clear';
		} catch {
			// expected: the password leak check is another service; the form says the check is unavailable.
			if (asked === leakAsked) leaks = 'unavailable';
		}
	}

	function measure(event: Event) {
		const password = (event.currentTarget as HTMLInputElement).value;
		typedLength = [...password.normalize('NFC')].length;
		clearTimeout(leakTimer);
		leakAsked++;
		if (typedLength < minimum) {
			leaks = 'unchecked';
			return;
		}
		leaks = 'checking';
		leakTimer = setTimeout(() => void checkLeaks(password), 400);
	}

	/** The ids that describe a field: its hint, and its error when it has one. */
	function describedBy(name: string, hint?: string): string | undefined {
		const ids = [hint ? `${prefix}${hint}` : undefined, field === name && problem ? `${prefix}${name}-error` : undefined].filter(Boolean);
		return ids.length > 0 ? ids.join(' ') : undefined;
	}

	/* Passkeys ------------------------------------------------------------ */

	// Shown only once the page knows the browser can use passkeys.
	let passkeysWork = $state(false);
	let passkeyProblem = $state<string | undefined>(undefined);
	let passkeyBusy = $state(false);

	/**
	 * Asks the browser for a passkey and signs in with it
	 * (src/routes/sign-in/passkey/+server.ts). With autofill, the browser
	 * offers the passkeys in the email field's list instead of opening a
	 * window, and waits until one is picked.
	 */
	async function signInWithPasskey(autofill = false) {
		if (!autofill) passkeyProblem = undefined;
		try {
			const asked = await fetch('/sign-in/passkey', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ step: 'options' })
			});
			if (!asked.ok) throw new Error(`The passkey options answered ${asked.status}`);
			const response = await startAuthentication({ optionsJSON: await asked.json(), useBrowserAutofill: autofill });
			passkeyBusy = true;
			const checked = await fetch('/sign-in/passkey', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					step: 'check',
					response,
					returnTo,
					keep: Boolean((document.getElementById(`${prefix}keep`) as HTMLInputElement | null)?.checked)
				})
			});
			const result: { location?: string; problem?: string } = await checked.json().catch(() => /* expected: an answer that is not JSON; the form says the passkey did not work. */ ({}));
			if (result.location) {
				location.assign(result.location);
				return;
			}
			passkeyProblem = result.problem ?? 'That passkey did not work here. Try again, or sign in another way.';
		} catch (problem) {
			// Closing the browser's window, or a newer request taking over, is not a problem to show.
			const name = problem instanceof Error ? problem.name : '';
			if (!autofill && name !== 'NotAllowedError' && name !== 'AbortError') {
				passkeyProblem = 'The passkey could not be used. Try again, or sign in another way.';
			}
		}
		passkeyBusy = false;
	}

	$effect(() => {
		passkeysWork = browserSupportsWebAuthn();
	});

	// Offers passkeys in the email field's autofill while the sign-in form is showing.
	$effect(() => {
		if (step !== 'email' || paused) return;
		let active = true;
		void browserSupportsWebAuthnAutofill().then((works) => {
			if (works && active) void signInWithPasskey(true);
		});
		return () => {
			active = false;
			WebAuthnAbortService.cancelCeremony();
		};
	});

	/** The answer to a form sent from the panel. */
	const answered: SubmitFunction = () => {
		return async ({ result, formElement }) => {
			if (result.type === 'redirect') {
				location.assign(result.location);
				return;
			}
			// The "are you a person?" token works once, so the form gets a fresh one.
			formElement.dispatchEvent(new Event(turnstileResetEvent));
			if (result.type === 'success' || result.type === 'failure') onchange?.((result.data ?? {}) as SignInState);
			else onchange?.({ ...answer, step, problem: 'Something went wrong. Please try again in a minute.', field: undefined });
			// A password is never left in the field after it was sent.
			for (const input of formElement.querySelectorAll<HTMLInputElement>('input[name="password"]')) input.value = '';
			typedLength = 0;
			leaks = 'unchecked';
		};
	};

	/** In the panel, forms are sent without leaving the page. */
	function sentHere(form: HTMLFormElement) {
		if (!onchange) return;
		const enhanced = enhance(form, answered);
		return () => enhanced.destroy();
	}

	/** In the panel, links between the steps change the panel instead of opening the page. */
	function goTo(next: SignInState) {
		return (event: MouseEvent) => {
			if (!onchange) return;
			event.preventDefault();
			onchange(next);
		};
	}
</script>

{#snippet fieldError(name: string)}
	{#if field === name && problem}
		<p class="field-error" id="{prefix}{name}-error">
			{#if inPanel}<CircleAlert size={18} strokeWidth={2} aria-hidden="true" />{/if}
			<span class="visually-hidden">Error:</span>
			{inPanel ? (shortErrors[name] ?? problem) : problem}
		</p>
	{/if}
{/snippet}

{#snippet personCheck(action: string)}
	{#if turnstileSiteKey}<TurnstileCheck siteKey={turnstileSiteKey} {action} />{/if}
{/snippet}

{#snippet providerLinks()}
	{#each providers as provider (provider)}
		<a
			class="button button-quiet wide with-icon"
			href="/sign-in/{provider}?returnTo={back}{keep ? '&keep=yes' : ''}"
			data-sveltekit-reload
			><img src="/sign-in/{provider}.svg" alt="" width="20" height="20" /> Continue with {providerNames[provider]}</a
		>
	{/each}
{/snippet}

{#snippet keepSignedIn(id: string)}
	<div class="choice">
		<input type="checkbox" id="{prefix}{id}" name="keep" value="yes" checked={keep} />
		<label for="{prefix}{id}">Keep me signed in for 30 days</label>
	</div>
{/snippet}

<div class="heading-row">
	<svelte:element this={level === 1 ? 'h1' : 'h2'} class="heading">{heading}</svelte:element>
	{#if onclose}
		<button class="close" type="button" aria-label="Close" title="Close" onclick={onclose}><X size={22} /></button>
	{/if}
</div>

<ErrorSummary {problems} />

{#if inPanel && problem}
	<div class="notice notice-problem panel-note" role="alert">
		{#if answer?.reason === 'no-match'}
			<p>
				<strong>That email address and password do not match.</strong>
				{codesAvailable ? 'Check both, or email yourself a code instead.' : 'Check both, or ask the lead author for a sign-in link.'}
			</p>
		{:else}
			<p>{problem}</p>
		{/if}
	</div>
{/if}

{#if step === 'code'}
	<p class:intro={inPanel}>
		We sent a six-digit code to <strong>{email}</strong>.
		{#if answer?.creating}Your account is made when you type it.{/if}
		It works once, for {answer?.minutes ?? 15} minutes.{#if !inPanel}
			You can also open the link in the email instead.{/if}
	</p>
	{#if answer?.shownCode}
		<div class="notice" role="note">
			<p>
				This copy of the site is running on your computer, so no email was sent. The code is
				<strong>{answer.shownCode}</strong>{#if answer.shownLink}, and the link is <a href={answer.shownLink}>{answer.shownLink}</a>{/if}.
			</p>
		</div>
	{/if}
	<form method="post" action="/sign-in?/code" class="panel" {@attach sentHere}>
		<input type="hidden" name="email" value={email} />
		<input type="hidden" name="returnTo" value={returnTo} />
		{#if answer?.creating}<input type="hidden" name="creating" value="yes" />{/if}
		<div class="field">
			<label for="{prefix}code">Code from the email</label>
			<p class="hint" id="{prefix}code-hint">The six digits in the email, for example 482 913.</p>
			{@render fieldError('code')}
			<CodeInput id="{prefix}code" name="code" describedBy={describedBy('code', 'code-hint')} invalid={field === 'code' && Boolean(problem)} />
		</div>
		{#if inPanel}
			{#if keep}<input type="hidden" name="keep" value="yes" />{/if}
		{:else}
			{@render keepSignedIn('keep-code')}
		{/if}
		<button class="button wide" type="submit">{answer?.creating ? 'Confirm and create account' : 'Sign in'}</button>
		{#if answer?.creating && !inPanel}
			<p class="small after">If this address already has an account, the code signs you in and its password stays as it was.</p>
		{/if}
	</form>
	<form method="post" action="/sign-in?/{answer?.creating ? 'resend' : 'send'}" {@attach sentHere}>
		<input type="hidden" name="email" value={email} />
		<input type="hidden" name="returnTo" value={returnTo} />
		{#if keep}<input type="hidden" name="keep" value="yes" />{/if}
		{@render personCheck(answer?.creating ? 'create_account' : 'sign_in')}
		{#if inPanel}
			<p class="small">No email after a minute? Check spam, or <button class="button-link" type="submit">send a new code</button>.</p>
		{:else}
			<p class="small">
				No email after a minute? Check your spam or junk folder.
				Or <button class="button-link" type="submit">send a new code</button>.
				<a
					href="/sign-in?{answer?.creating ? 'create&' : ''}returnTo={back}"
					data-sveltekit-reload
					onclick={goTo({ step: answer?.creating ? 'create' : 'email', email, keep })}>Use a different email address</a
				>.
			</p>
		{/if}
	</form>
	{#if inPanel}
		<p class="switch small">
			<a
				class="back"
				href="/sign-in?{answer?.creating ? 'create&' : ''}returnTo={back}"
				data-sveltekit-reload
				onclick={goTo({ step: answer?.creating ? 'create' : 'email', email, keep })}
				><ArrowLeft size={16} strokeWidth={2} aria-hidden="true" /> Use a different email address</a
			>
		</p>
	{/if}
{:else if paused}
	<div class="notice notice-problem" role="alert">
		{#if paused.off}
			<p><strong>Password sign-in is off for this address</strong></p>
			<p>
				There were too many wrong passwords for <strong>{email}</strong>, so we switched off password
				sign-in for this address to keep the account safe. It stays off until a new password is chosen.
			</p>
		{:else}
			<p><strong>Password sign-in is paused for {paused.minutes} {paused.minutes === 1 ? 'minute' : 'minutes'}</strong></p>
			<p>
				There were too many wrong passwords for <strong>{email}</strong>, so we paused password sign-in
				for this address to keep the account safe.
			</p>
		{/if}
		{#if paused.codesAvailable}
			<p>You can still sign in now with a code sent to this address, then choose a new password.</p>
		{:else}
			<p>You can still sign in with a link from the lead author, then choose a new password.</p>
		{/if}
	</div>
	{#if paused.codesAvailable}
		<form method="post" action="/sign-in?/send" class="panel" {@attach sentHere}>
			<input type="hidden" name="returnTo" value="/profile/password" />
			<div class="field">
				<label for="{prefix}email">Email address</label>
				<input id="{prefix}email" name="email" type="email" autocomplete="username" value={email} required />
			</div>
			{@render personCheck('sign_in')}
			<button class="button with-icon" type="submit"><Mail size={20} strokeWidth={1.75} aria-hidden="true" /> Email me a code</button>
		</form>
	{/if}
	<p class="small">
		If you did not try to sign in, someone may be guessing your password. Sign in another way and choose
		a new password on Sign-in and security.
	</p>
{:else if step === 'create'}
	{#if !(inPanel && problem)}
		<p class="intro">
			An account lets you keep a contributor profile, follow pages and upload documents. Reading the site never
			needs one.
		</p>
	{/if}
	<form method="post" action="/sign-in?/create" class="panel" {@attach sentHere}>
		<input type="hidden" name="returnTo" value={returnTo} />
		<div class="field">
			<label for="{prefix}email">Email address</label>
			{@render fieldError('email')}
			<input
				id="{prefix}email"
				name="email"
				type="email"
				autocomplete="username"
				value={email}
				aria-describedby={describedBy('email')}
				aria-invalid={field === 'email' && problem ? 'true' : undefined}
				required
			/>
		</div>
		<div class="field">
			<label for="{prefix}new-password">Choose a password</label>
			{@render fieldError('new-password')}
			<PasswordInput
				id="{prefix}new-password"
				name="password"
				autocomplete="new-password"
				aria-describedby={describedBy('new-password', 'new-password-checks')}
				aria-invalid={field === 'new-password' && problem ? 'true' : undefined}
				oninput={measure}
				required
			/>
			<ul class="checks small" id="{prefix}new-password-checks">
				<li class:met={typedLength >= minimum}>
					{#if typedLength >= minimum}
						<Check size={18} strokeWidth={2} aria-hidden="true" />
					{:else}
						<Circle size={18} strokeWidth={1.75} aria-hidden="true" />
					{/if}
					At least {minimum} characters
				</li>
				<li class:met={leaks === 'clear'} class:refused={leaks === 'found'} aria-live="polite">
					{#if leaks === 'clear'}
						<Check size={18} strokeWidth={2} aria-hidden="true" />
						Not found in known password leaks
					{:else if leaks === 'found'}
						<X size={18} strokeWidth={2} aria-hidden="true" />
						Found in known password leaks. Choose another.
					{:else}
						<Circle size={18} strokeWidth={1.75} aria-hidden="true" />
						Not found in known password leaks
					{/if}
				</li>
			</ul>
		</div>
		{@render keepSignedIn('keep')}
		{@render personCheck('create_account')}
		<button class="button wide" type="submit">Create account</button>
		{#if providers.length > 0}
			<p class="or">or</p>
			<div class="other-ways">{@render providerLinks()}</div>
		{/if}
	</form>
	<p class="switch small">
		Already have an account?
		<a href="/sign-in?returnTo={back}" data-sveltekit-reload onclick={goTo({ step: 'email', email })}><strong>Sign in</strong></a>
	</p>
{:else}
	{#if inPanel}
		{#if !problem}<p class="intro">You do not need an account to read the site or send a request.</p>{/if}
	{:else}
		<p class="intro">
			Sign in to keep a contributor profile, or to work in the workspace if the lead author has given you
			access. You do not need an account to read the site or to send a request.
		</p>
	{/if}
	<form method="post" action="/sign-in?/password" class="panel" {@attach sentHere}>
		<input type="hidden" name="returnTo" value={returnTo} />
		<div class="field">
			<label for="{prefix}email">Email address</label>
			{@render fieldError('email')}
			<input
				id="{prefix}email"
				name="email"
				type="email"
				autocomplete="username webauthn"
				value={email}
				aria-describedby={describedBy('email')}
				aria-invalid={field === 'email' && problem ? 'true' : undefined}
				required
			/>
		</div>
		<div class="field">
			<label for="{prefix}password">Password</label>
			{#if !inPanel}
				<p class="hint" id="{prefix}password-hint">
					{codesAvailable
						? 'Only if you chose one. Otherwise, email yourself a code below.'
						: 'Only if you chose one. Otherwise, ask the lead author for a sign-in link.'}
				</p>
			{/if}
			{@render fieldError('password')}
			<PasswordInput
				id="{prefix}password"
				name="password"
				autocomplete="current-password"
				aria-describedby={describedBy('password', inPanel ? undefined : 'password-hint')}
				aria-invalid={field === 'password' && problem ? 'true' : undefined}
			/>
			<!-- After the field, so Tab goes from the email address straight to the password. -->
			<p class="forgot"><a href="/sign-in/forgot?returnTo={back}" data-sveltekit-reload>Forgot your password?</a></p>
		</div>
		{@render keepSignedIn('keep')}
		{@render personCheck('sign_in')}
		<button class="button wide" type="submit">Sign in</button>
		{#if codesAvailable || passkeysWork || providers.length > 0}
			<p class="or">or</p>
			<div class="other-ways">
				{#if codesAvailable}
					<button class="button button-quiet wide with-icon" type="submit" formaction="/sign-in?/send"
						><Mail size={20} strokeWidth={1.75} aria-hidden="true" /> Email me a code</button
					>
				{/if}
				{#if passkeysWork}
					<button class="button button-quiet wide with-icon" type="button" disabled={passkeyBusy} onclick={() => signInWithPasskey()}
						><KeyRound size={20} strokeWidth={1.75} aria-hidden="true" /> Sign in with a passkey</button
					>
				{/if}
				{@render providerLinks()}
			</div>
			{#if passkeyProblem}
				<p class="field-error passkey-problem" role="alert">
					{#if inPanel}<CircleAlert size={18} strokeWidth={2} aria-hidden="true" />{/if}
					{passkeyProblem}
				</p>
			{/if}
		{/if}
	</form>
	{#if codesAvailable}
		<p class="switch small">
			New here?
			<a href="/sign-in?create&amp;returnTo={back}" data-sveltekit-reload onclick={goTo({ step: 'create', email })}
				><strong>Create an account</strong></a
			>
		</p>
	{:else}
		<p class="switch small">
			This site cannot send email yet, so new accounts cannot be made here. If you have not chosen a password,
			ask the lead author for a sign-in link.
		</p>
	{/if}
{/if}

<style>
	.heading-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.close {
		display: grid;
		place-items: center;
		flex: none;
		width: var(--layout-target-minimum);
		height: var(--layout-target-minimum);
		margin: calc(var(--space-2) * -1) calc(var(--space-2) * -1) 0 0;
		border: 0;
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--color-ink-muted);
		cursor: pointer;
	}

	.close:hover {
		color: var(--color-ink);
		background: color-mix(in srgb, currentColor 10%, transparent);
	}

	.panel {
		max-width: var(--layout-panel);
	}

	.choice {
		display: flex;
		gap: var(--space-3);
		align-items: center;
		margin: 0 0 var(--space-4);
	}

	.choice input {
		margin: 0;
		width: 1.25rem;
		height: 1.25rem;
		flex: none;
	}

	.choice label {
		font-weight: var(--font-weight-regular);
	}

	.forgot {
		margin: var(--space-2) 0 0;
		font-size: var(--font-size-small);
	}

	.checks {
		list-style: none;
		margin: var(--space-2) 0 0;
		padding: 0;
	}

	.checks li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: var(--space-1) 0 0;
		color: var(--color-ink-muted);
	}

	.checks li.met {
		color: var(--color-ink);
	}

	.checks li.met :global(svg) {
		color: var(--color-link);
	}

	.checks li.refused {
		color: var(--color-danger);
	}

	.panel-note {
		margin: var(--space-3) 0;
		font-size: var(--font-size-small);
	}

	.field-error {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.after {
		margin: var(--space-3) 0 0;
	}

	.switch {
		max-width: var(--layout-panel);
	}

	.wide {
		width: 100%;
		justify-content: center;
	}

	.with-icon {
		gap: var(--space-2);
	}

	.or {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin: var(--space-4) 0;
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	.or::before,
	.or::after {
		content: '';
		flex: 1;
		border-top: 1px solid var(--color-line);
	}

	.other-ways {
		display: grid;
		gap: var(--space-3);
	}

	.passkey-problem {
		margin: var(--space-3) 0 0;
	}

	.button-link {
		background: none;
		border: none;
		color: var(--color-link);
		cursor: pointer;
		font: inherit;
		padding: 0;
		text-decoration: underline;
	}
</style>
