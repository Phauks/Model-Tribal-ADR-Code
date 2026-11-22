<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const step = $derived(form?.step ?? 'email');
	const email = $derived(form?.email ?? '');
	const problem = $derived(form && 'problem' in form ? form.problem : undefined);
	const shownCode = $derived(form && 'shownCode' in form ? form.shownCode : undefined);
	const shownLink = $derived(form && 'shownLink' in form ? form.shownLink : undefined);
	const minutes = $derived(form && 'minutes' in form ? form.minutes : 15);
</script>

<svelte:head>
	<title>Sign in · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<h1>Sign in</h1>

	{#if data.signedInAs}
		<div class="notice" role="status">
			<p>You are signed in as {data.signedInAs}. <a href="/workspace">Go to the workspace</a> or <a href="/profile">your profile</a>.</p>
		</div>
	{/if}

	{#if problem}
		<div class="notice notice-problem" role="alert"><p>{problem}</p></div>
	{/if}

	{#if step === 'code'}
		<p>
			We sent a six-digit code to <strong>{email}</strong>. It works once, for {minutes} minutes. You can
			also open the link in the email instead of typing the code.
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
			<input type="hidden" name="returnTo" value={data.returnTo} />
			<div class="field">
				<label for="code">Code from the email</label>
				<input
					id="code"
					name="code"
					type="text"
					class="code-field"
					inputmode="numeric"
					autocomplete="one-time-code"
					pattern="[0-9 ]*"
					maxlength="8"
					required
				/>
			</div>
			<button class="button" type="submit">Sign in</button>
		</form>
		<form method="post" action="?/send">
			<input type="hidden" name="email" value={email} />
			<input type="hidden" name="returnTo" value={data.returnTo} />
			<p class="small">
				No email? Check your spam or junk folder, or
				<button class="button-link" type="submit">send a new code</button>.
				<a href="/sign-in?returnTo={encodeURIComponent(data.returnTo)}">Use a different address</a>.
			</p>
		</form>
	{:else}
		<p>
			Sign in to keep a contributor profile or, if the lead author has given you access, to work in the
			workspace. If you have never signed in, enter your email address and ask for a code: your account
			is made when you first sign in.
		</p>
		<form method="post" action={data.codesAvailable ? '?/send' : '?/password'} class="panel">
			<input type="hidden" name="returnTo" value={data.returnTo} />
			<div class="field">
				<label for="email">Email address</label>
				<input id="email" name="email" type="email" autocomplete="email" value={email} required />
			</div>
			{#if data.codesAvailable}
				<p><button class="button" type="submit">Email me a code</button></p>
			{/if}
			<details open={!data.codesAvailable}>
				<summary>Sign in with a password instead</summary>
				<div class="field">
					<label for="password">Password</label>
					<p class="hint" id="password-hint">Only if you chose one on your profile.</p>
					<input
						id="password"
						name="password"
						type="password"
						autocomplete="current-password"
						aria-describedby="password-hint"
					/>
				</div>
				<button class="button {data.codesAvailable ? 'button-quiet' : ''}" type="submit" formaction="?/password"
					>Sign in with password</button
				>
			</details>
		</form>
		{#if !data.codesAvailable}
			<p class="small">
				This site cannot send sign-in codes by email yet. If you have not chosen a password, ask the lead
				author for a sign-in link.
			</p>
		{/if}
	{/if}

	<p>
		Nobody needs to sign in to read the site or to send a request. To ask the project something, use
		<a href="/requests">Make a request</a>.
	</p>
</div>

<style>
	.code-field {
		max-width: 12ch;
		font-size: var(--font-size-lead);
		letter-spacing: 0.2em;
	}

	details {
		margin-top: var(--space-4);
	}

	summary {
		cursor: pointer;
		margin-bottom: var(--space-3);
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
