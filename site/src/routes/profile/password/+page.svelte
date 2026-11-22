<script lang="ts">
	import PasswordInput from '#lib/components/PasswordInput.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const hasPassword = $derived(form && 'hasPassword' in form ? form.hasPassword : data.hasPassword);
</script>

<svelte:head>
	<title>Password · Model Tribal ADR Code</title>
</svelte:head>

<p class="small"><a href="/profile">Your profile</a></p>
<h1>{hasPassword ? 'Change your password' : 'Choose a password'}</h1>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{:else if data.welcome}
	<div class="notice" role="status">
		<p>
			You are signed in. Choose a password now if you like, so you can sign in again without asking for
			a link. You can also skip this and <a href="/workspace">go to the workspace</a>.
		</p>
	</div>
{/if}

<p>
	A password is optional. Without one, you sign in with a code sent to your email address. Use at least
	12 characters; a few unrelated words make a strong password that is easy to remember. A password
	manager can make and keep one for you.
</p>

<form method="post" action="?/set" class="panel">
	<!-- For password managers, so the new password is saved for this address. -->
	<input type="email" name="username" autocomplete="username" aria-label="Email address" value={data.email} class="for-password-managers" hidden />
	{#if hasPassword}
		<div class="field">
			<label for="current">Current password</label>
			<PasswordInput id="current" name="current" autocomplete="current-password" required />
		</div>
	{/if}
	<div class="field">
		<label for="password">New password</label>
		<PasswordInput id="password" name="password" autocomplete="new-password" minlength={12} required />
	</div>
	<div class="field">
		<label for="repeated">New password again</label>
		<PasswordInput id="repeated" name="repeated" autocomplete="new-password" minlength={12} required />
	</div>
	<button class="button" type="submit">Save the password</button>
	<p class="small">Saving signs out every other browser signed in to your account.</p>
</form>

{#if hasPassword}
	<form method="post" action="?/remove" class="panel">
		<h2>Remove your password</h2>
		<p>You will sign in with a code sent to your email address instead.</p>
		<div class="field">
			<label for="remove-current">Current password</label>
			<PasswordInput id="remove-current" name="current" autocomplete="current-password" required />
		</div>
		<button class="button button-quiet" type="submit">Remove the password</button>
	</form>
{/if}

<style>
	/* The global input style sets display: block, which would show it. */
	.for-password-managers {
		display: none;
	}
</style>
