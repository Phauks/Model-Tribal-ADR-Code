<script lang="ts">
	import Mail from '@lucide/svelte/icons/mail';
	import TurnstileCheck from '#lib/components/TurnstileCheck.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Forgot your password? · Tribal Law Project</title>
</svelte:head>

<div class="reading">
	<p class="small"><a href="/sign-in">Back to sign in</a></p>
	<h1>Forgot your password?</h1>
	{#if data.codesAvailable}
		<p>
			Enter your email address and we will send you a code. After you sign in with it, you can choose a new
			password without the old one.
		</p>
		<form method="post" action="/sign-in?/send" class="panel">
			<input type="hidden" name="returnTo" value="/profile/password" />
			<div class="field">
				<label for="email">Email address</label>
				<input id="email" name="email" type="email" autocomplete="username" required />
			</div>
			{#if data.turnstileSiteKey}<TurnstileCheck siteKey={data.turnstileSiteKey} action="forgot_password" />{/if}
			<button class="button with-icon" type="submit"><Mail size={20} strokeWidth={1.75} aria-hidden="true" /> Email me a code</button>
		</form>
	{:else}
		<p>
			This site cannot send email yet. Ask the lead author for a sign-in link. After you open it, you can
			choose a new password without the old one.
		</p>
	{/if}
	<p class="small">
		If your account has no password, you do not need one: sign in with a code or a link instead.
	</p>
</div>

<style>
	.panel {
		max-width: var(--layout-panel);
	}

	.with-icon {
		gap: var(--space-2);
	}
</style>
