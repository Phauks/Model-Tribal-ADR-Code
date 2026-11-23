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
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import Mail from '@lucide/svelte/icons/mail';
	import Check from '@lucide/svelte/icons/check';
	import Circle from '@lucide/svelte/icons/circle';
	import X from '@lucide/svelte/icons/x';
	import type { SignInState } from '#lib/sign-in-state.ts';
	import CodeInput from './CodeInput.svelte';
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
	}

	let { answer, codesAvailable, returnTo, creating = false, prefix = '', level = 1, onchange, onclose }: Props = $props();

	const minimum = 15;
	const step = $derived(answer?.step ?? (creating && codesAvailable ? 'create' : 'email'));
	const email = $derived(answer?.email ?? '');
	const keep = $derived(Boolean(answer?.keep));
	const problem = $derived(answer?.problem);
	const field = $derived(answer?.field);
	const paused = $derived(answer?.paused);
	const problems = $derived(problem ? [{ field: field ? `${prefix}${field}` : undefined, message: problem }] : []);
	const heading = $derived(
		step === 'code' ? 'Check your email' : step === 'create' ? 'Create an account' : 'Sign in'
	);
	const back = $derived(encodeURIComponent(returnTo));

	// The new password's length so far, counted as the server counts it: each Unicode code point once.
	let typedLength = $state(0);
	function measure(event: Event) {
		typedLength = [...(event.currentTarget as HTMLInputElement).value.normalize('NFC')].length;
	}

	/** The ids that describe a field: its hint, and its error when it has one. */
	function describedBy(name: string, hint?: string): string | undefined {
		const ids = [hint ? `${prefix}${hint}` : undefined, field === name && problem ? `${prefix}${name}-error` : undefined].filter(Boolean);
		return ids.length > 0 ? ids.join(' ') : undefined;
	}

	/** The answer to a form sent from the panel. */
	const answered: SubmitFunction = () => {
		return async ({ result, formElement }) => {
			if (result.type === 'redirect') {
				location.assign(result.location);
				return;
			}
			if (result.type === 'success' || result.type === 'failure') onchange?.((result.data ?? {}) as SignInState);
			else onchange?.({ ...answer, step, problem: 'Something went wrong. Please try again in a minute.', field: undefined });
			// A password is never left in the field after it was sent.
			for (const input of formElement.querySelectorAll<HTMLInputElement>('input[name="password"]')) input.value = '';
			typedLength = 0;
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
		<p class="field-error" id="{prefix}{name}-error"><span class="visually-hidden">Error:</span> {problem}</p>
	{/if}
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

{#if step === 'code'}
	<p>
		We sent a six-digit code to <strong>{email}</strong>.
		{#if answer?.creating}Your account is made when you type it.{/if}
		It works once, for {answer?.minutes ?? 15} minutes. You can also open the link in the email instead.
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
		{@render keepSignedIn('keep-code')}
		<button class="button wide" type="submit">{answer?.creating ? 'Confirm and create account' : 'Sign in'}</button>
		{#if answer?.creating}
			<p class="small after">If this address already has an account, the code signs you in and its password stays as it was.</p>
		{/if}
	</form>
	<form method="post" action="/sign-in?/{answer?.creating ? 'create' : 'send'}" {@attach sentHere}>
		<input type="hidden" name="email" value={email} />
		<input type="hidden" name="returnTo" value={returnTo} />
		<p class="small">
			No email after a minute? Check your spam or junk folder.
			{#if !answer?.creating}
				Or <button class="button-link" type="submit">send a new code</button>.
			{/if}
			<a
				href="/sign-in?{answer?.creating ? 'create&' : ''}returnTo={back}"
				data-sveltekit-reload
				onclick={goTo({ step: answer?.creating ? 'create' : 'email', email, keep })}>Use a different email address</a
			>.
		</p>
	</form>
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
			<button class="button with-icon" type="submit"><Mail size={20} strokeWidth={1.75} aria-hidden="true" /> Email me a code</button>
		</form>
	{/if}
	<p class="small">
		If you did not try to sign in, someone may be guessing your password. Sign in another way and choose
		a new password on Sign-in and security.
	</p>
{:else if step === 'create'}
	<p class="intro">
		An account lets you keep a contributor profile, follow pages and upload documents. Reading the site and
		sending a request never need one.
	</p>
	<form method="post" action="/sign-in?/create" class="panel" {@attach sentHere}>
		<input type="hidden" name="returnTo" value={returnTo} />
		<div class="field">
			<label for="{prefix}email">Email address</label>
			<p class="hint" id="{prefix}email-hint">We send a code to this address. Your account is made when you type it.</p>
			{@render fieldError('email')}
			<input
				id="{prefix}email"
				name="email"
				type="email"
				autocomplete="username"
				value={email}
				aria-describedby={describedBy('email', 'email-hint')}
				aria-invalid={field === 'email' && problem ? 'true' : undefined}
				required
			/>
		</div>
		<div class="field">
			<label for="{prefix}new-password">Choose a password</label>
			<p class="hint" id="{prefix}new-password-hint">
				Use {minimum} characters or more. Three or four unrelated words work well. It is also checked against
				passwords leaked in data breaches.
			</p>
			{@render fieldError('new-password')}
			<PasswordInput
				id="{prefix}new-password"
				name="password"
				autocomplete="new-password"
				aria-describedby={describedBy('new-password', 'new-password-hint')}
				aria-invalid={field === 'new-password' && problem ? 'true' : undefined}
				oninput={measure}
				required
			/>
			<p class="length small" class:met={typedLength >= minimum}>
				{#if typedLength >= minimum}
					<Check size={18} strokeWidth={2} aria-hidden="true" />
				{:else}
					<Circle size={18} strokeWidth={1.75} aria-hidden="true" />
				{/if}
				{minimum} characters or more ({typedLength} so far)
			</p>
		</div>
		{@render keepSignedIn('keep')}
		<button class="button wide" type="submit">Create account</button>
	</form>
	<p class="switch small">
		Already have an account?
		<a href="/sign-in?returnTo={back}" data-sveltekit-reload onclick={goTo({ step: 'email', email })}><strong>Sign in</strong></a>
	</p>
{:else}
	<p class="intro">
		{#if onchange}
			You do not need an account to read the site or to send a request.
		{:else}
			Sign in to keep a contributor profile, or to work in the workspace if the lead author has given you
			access. You do not need an account to read the site or to send a request.
		{/if}
	</p>
	<form method="post" action="/sign-in?/password" class="panel" {@attach sentHere}>
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
			<label for="{prefix}password">Password</label>
			<p class="hint" id="{prefix}password-hint">
				{codesAvailable
					? 'Only if you chose one. Otherwise, email yourself a code below.'
					: 'Only if you chose one. Otherwise, ask the lead author for a sign-in link.'}
			</p>
			{@render fieldError('password')}
			<PasswordInput
				id="{prefix}password"
				name="password"
				autocomplete="current-password"
				aria-describedby={describedBy('password', 'password-hint')}
				aria-invalid={field === 'password' && problem ? 'true' : undefined}
			/>
			<!-- After the field, so Tab goes from the email address straight to the password. -->
			<p class="forgot"><a href="/sign-in/forgot?returnTo={back}" data-sveltekit-reload>Forgot your password?</a></p>
		</div>
		{@render keepSignedIn('keep')}
		<button class="button wide" type="submit">Sign in</button>
		{#if codesAvailable}
			<p class="or">or</p>
			<button class="button button-quiet wide with-icon" type="submit" formaction="/sign-in?/send"
				><Mail size={20} strokeWidth={1.75} aria-hidden="true" /> Email me a code</button
			>
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

	.length {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: var(--space-2) 0 0;
		color: var(--color-ink-muted);
	}

	.length.met {
		color: var(--color-ink);
	}

	.length.met :global(svg) {
		color: var(--color-link);
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
