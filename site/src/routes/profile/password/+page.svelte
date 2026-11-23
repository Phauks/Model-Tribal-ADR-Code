<script lang="ts">
	import ErrorSummary from '#lib/components/ErrorSummary.svelte';
	import PasswordInput from '#lib/components/PasswordInput.svelte';
	import Check from '@lucide/svelte/icons/check';
	import Circle from '@lucide/svelte/icons/circle';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const minimum = 15;
	const hasPassword = $derived(form && 'hasPassword' in form ? form.hasPassword : data.hasPassword);
	const needsCurrent = $derived(form && 'needsCurrent' in form && form.needsCurrent !== undefined ? form.needsCurrent : data.needsCurrent);
	const problem = $derived(form && 'problem' in form ? form.problem : undefined);
	const field = $derived(form && 'field' in form ? form.field : undefined);
	const problems = $derived(problem ? [{ field, message: problem }] : []);

	// The length so far, counted as the server counts it: each Unicode code point once.
	let typedLength = $state(0);
	function measure(event: Event) {
		typedLength = [...(event.currentTarget as HTMLInputElement).value.normalize('NFC')].length;
	}

	function describedBy(name: string, hint?: string): string | undefined {
		const ids = [hint, field === name && problem ? `${name}-error` : undefined].filter(Boolean);
		return ids.length > 0 ? ids.join(' ') : undefined;
	}
</script>

<svelte:head>
	<title>{problem ? 'Error: ' : ''}{hasPassword ? 'Change your password' : 'Choose a password'} · Model Tribal ADR Code</title>
</svelte:head>

{#snippet fieldError(name: string)}
	{#if field === name && problem}
		<p class="field-error" id="{name}-error"><span class="visually-hidden">Error:</span> {problem}</p>
	{/if}
{/snippet}

<p class="small"><a href="/account/security">Sign-in and security</a></p>
<h1>{hasPassword ? 'Change your password' : 'Choose a password'}</h1>

<ErrorSummary {problems} />

{#if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{:else if hasPassword && !needsCurrent}
	<div class="notice" role="status">
		<p>
			You signed in with a code or a link a moment ago, so you do not need your old password.
			{#if data.welcome}You can also skip this and <a href="/workspace">go to the workspace</a>.{/if}
		</p>
	</div>
{:else if data.welcome}
	<div class="notice" role="status">
		<p>
			You are signed in. Choose a password now if you like, so you can sign in again without asking for
			a link. You can also skip this and <a href="/workspace">go to the workspace</a>.
		</p>
	</div>
{/if}

<p>
	A password is optional. Without one, you sign in with a code sent to your email address or a link from the
	lead author.
</p>

<form method="post" action="?/set" class="panel">
	<!-- For password managers, so the new password is saved for this address. -->
	<input type="email" name="username" autocomplete="username" aria-label="Email address" value={data.email} class="for-password-managers" hidden />
	{#if needsCurrent}
		<div class="field">
			<label for="current">Current password</label>
			{@render fieldError('current')}
			<PasswordInput
				id="current"
				name="current"
				autocomplete="current-password"
				aria-describedby={describedBy('current')}
				aria-invalid={field === 'current' && problem ? 'true' : undefined}
				required
			/>
		</div>
	{/if}
	<div class="field">
		<label for="password">New password</label>
		<p class="hint" id="password-hint">
			Use {minimum} characters or more. Three or four unrelated words work well, such as
			<em>kettle river paper moon</em>. A password manager can make and save one for you.
		</p>
		{@render fieldError('password')}
		<PasswordInput
			id="password"
			name="password"
			autocomplete="new-password"
			aria-describedby={describedBy('password', 'password-hint')}
			aria-invalid={field === 'password' && problem ? 'true' : undefined}
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
	<button class="button" type="submit">Save the password</button>
	<p class="small">
		Saving signs out every other browser signed in to your account. New passwords are checked against
		passwords known from data breaches without sending yours: only the first 5 characters of a scrambled
		copy leave this site.
	</p>
</form>

{#if hasPassword}
	<form method="post" action="?/remove" class="panel">
		<h2>Remove your password</h2>
		<p>You will sign in with a code sent to your email address, or a link from the lead author, instead.</p>
		{#if needsCurrent}
			<div class="field">
				<label for="remove-current">Current password</label>
				{@render fieldError('remove-current')}
				<PasswordInput
					id="remove-current"
					name="current"
					autocomplete="current-password"
					aria-describedby={describedBy('remove-current')}
					aria-invalid={field === 'remove-current' && problem ? 'true' : undefined}
					required
				/>
			</div>
		{/if}
		<button class="button button-quiet" type="submit">Remove the password</button>
	</form>
{/if}

<style>
	/* The global input style sets display: block, which would show it. */
	.for-password-managers {
		display: none;
	}

	.panel {
		max-width: var(--layout-panel);
	}

	.panel > .button + .small {
		margin-top: var(--space-3);
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
</style>
