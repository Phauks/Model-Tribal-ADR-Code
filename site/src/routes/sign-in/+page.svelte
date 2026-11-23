<script lang="ts">
	import ErrorSummary from '#lib/components/ErrorSummary.svelte';
	import PasswordInput from '#lib/components/PasswordInput.svelte';
	import Mail from '@lucide/svelte/icons/mail';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const step = $derived(form?.step ?? 'email');
	const email = $derived(form?.email ?? '');
	// A form posted to "?/send" or "?/code" loses the address's query, so the page to return to comes back with the form.
	const returnTo = $derived(form && 'returnTo' in form && form.returnTo ? form.returnTo : data.returnTo);
	const problem = $derived(form && 'problem' in form ? form.problem : undefined);
	const field = $derived(form && 'field' in form ? form.field : undefined);
	const paused = $derived(form && 'paused' in form ? form.paused : undefined);
	const shownCode = $derived(form && 'shownCode' in form ? form.shownCode : undefined);
	const shownLink = $derived(form && 'shownLink' in form ? form.shownLink : undefined);
	const minutes = $derived(form && 'minutes' in form ? form.minutes : 15);
	const keep = $derived(Boolean(form && 'keep' in form && form.keep));
	const problems = $derived(problem ? [{ field, message: problem }] : []);

	/** The ids that describe a field: its hint, and its error when it has one. */
	function describedBy(name: string, hint?: string): string | undefined {
		const ids = [hint, field === name && problem ? `${name}-error` : undefined].filter(Boolean);
		return ids.length > 0 ? ids.join(' ') : undefined;
	}
</script>

<svelte:head>
	<title>{problem ? 'Error: ' : ''}{step === 'code' ? 'Check your email' : 'Sign in'} · Model Tribal ADR Code</title>
</svelte:head>

{#snippet keepSignedIn(id: string, checked: boolean)}
	<div class="choice">
		<input type="checkbox" {id} name="keep" value="yes" {checked} aria-describedby="{id}-hint" />
		<div>
			<label for={id}>Keep me signed in for 30 days</label>
			<p class="hint" id="{id}-hint">Only on a device you do not share. The workspace still signs you out after 12 hours.</p>
		</div>
	</div>
{/snippet}

{#snippet fieldError(name: string)}
	{#if field === name && problem}
		<p class="field-error" id="{name}-error"><span class="visually-hidden">Error:</span> {problem}</p>
	{/if}
{/snippet}

<div class="reading">
	{#if step === 'code'}
		<p class="small"><a href="/sign-in?returnTo={encodeURIComponent(returnTo)}">Back to sign in</a></p>
		<h1>Check your email</h1>
	{:else}
		<h1>Sign in</h1>
	{/if}

	{#if data.signedInAs}
		<div class="notice" role="status">
			<p>You are signed in as {data.signedInAs}. <a href="/workspace">Go to the workspace</a> or <a href="/profile">your profile</a>.</p>
		</div>
	{/if}

	<ErrorSummary {problems} />

	{#if step === 'code'}
		<p>
			We sent a six-digit code to <strong>{email}</strong>. It works once, for {minutes} minutes. You can
			also open the link in the email instead.
		</p>
		{#if shownCode}
			<div class="notice" role="note">
				<p>
					This copy of the site is running on your computer, so no email was sent. The code is
					<strong>{shownCode}</strong>{#if shownLink}, and the link is <a href={shownLink}>{shownLink}</a>{/if}.
				</p>
			</div>
		{/if}
		<form method="post" action="?/code" class="panel">
			<input type="hidden" name="email" value={email} />
			<input type="hidden" name="returnTo" value={returnTo} />
			<div class="field">
				<label for="code">Code from the email</label>
				<p class="hint" id="code-hint">For example, 482 913</p>
				{@render fieldError('code')}
				<input
					id="code"
					name="code"
					type="text"
					class="code-field"
					inputmode="numeric"
					autocomplete="one-time-code"
					pattern="[0-9 ]*"
					maxlength="8"
					aria-describedby={describedBy('code', 'code-hint')}
					aria-invalid={field === 'code' && problem ? 'true' : undefined}
					required
				/>
			</div>
			{@render keepSignedIn('keep-code', keep)}
			<button class="button" type="submit">Sign in</button>
		</form>
		<form method="post" action="?/send">
			<input type="hidden" name="email" value={email} />
			<input type="hidden" name="returnTo" value={returnTo} />
			<p class="small">
				No email after a minute? Check your spam or junk folder, or
				<button class="button-link" type="submit">send a new code</button>.
				<a href="/sign-in?returnTo={encodeURIComponent(returnTo)}">Use a different email address</a>.
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
			<form method="post" action="?/send" class="panel">
				<input type="hidden" name="returnTo" value="/profile/password" />
				<div class="field">
					<label for="email">Email address</label>
					<input id="email" name="email" type="email" autocomplete="username" value={email} required />
				</div>
				<button class="button with-icon" type="submit"><Mail size={20} strokeWidth={1.75} aria-hidden="true" /> Email me a code</button>
			</form>
		{/if}
		<p class="small">
			If you did not try to sign in, someone may be guessing your password. Sign in another way and choose
			a new password on Sign-in and security.
		</p>
	{:else}
		<p>
			Sign in to keep a contributor profile, or to work in the workspace if the lead author has given you
			access. You do not need an account to read the site or to send a request.
		</p>
		<form method="post" action="?/password" class="panel">
			<input type="hidden" name="returnTo" value={returnTo} />
			<div class="field">
				<label for="email">Email address</label>
				{@render fieldError('email')}
				<input
					id="email"
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
				<div class="label-row">
					<label for="password">Password</label>
					<a href="/sign-in/forgot?returnTo={encodeURIComponent(returnTo)}">Forgot your password?</a>
				</div>
				<p class="hint" id="password-hint">
					{data.codesAvailable
						? 'Only if you chose one. Otherwise, email yourself a code below.'
						: 'Only if you chose one. Otherwise, ask the lead author for a sign-in link.'}
				</p>
				{@render fieldError('password')}
				<PasswordInput
					id="password"
					name="password"
					autocomplete="current-password"
					aria-describedby={describedBy('password', 'password-hint')}
					aria-invalid={field === 'password' && problem ? 'true' : undefined}
				/>
			</div>
			{@render keepSignedIn('keep', keep)}
			<button class="button wide" type="submit">Sign in</button>
			{#if data.codesAvailable}
				<p class="or">or</p>
				<button class="button button-quiet wide with-icon" type="submit" formaction="?/send"
					><Mail size={20} strokeWidth={1.75} aria-hidden="true" /> Email me a code</button
				>
			{/if}
		</form>
		{#if data.codesAvailable}
			<p class="small">
				First time here? Enter your email address and choose <strong>Email me a code</strong>. Your account
				is made when you first sign in.
			</p>
		{:else}
			<p class="small">
				This site cannot send sign-in codes by email yet. If you have not chosen a password, ask the lead
				author for a sign-in link.
			</p>
		{/if}
	{/if}
</div>

<style>
	.panel {
		max-width: 30rem;
	}

	.choice {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		margin: 0 0 var(--space-4);
	}

	.choice input {
		margin-top: 0.2em;
		width: 1.25rem;
		height: 1.25rem;
		flex: none;
	}

	.choice label {
		font-weight: var(--font-weight-regular);
	}

	.choice .hint {
		margin: 0;
	}

	.code-field {
		max-width: 12ch;
		font-size: var(--font-size-lead);
		letter-spacing: 0.2em;
	}

	.label-row {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-1) var(--space-3);
	}

	.label-row label {
		font-weight: var(--font-weight-semibold);
		margin-bottom: var(--space-1);
	}

	.label-row a {
		font-size: var(--font-size-small);
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
