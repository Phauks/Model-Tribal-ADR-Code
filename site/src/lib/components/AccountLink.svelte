<script lang="ts">
	// The masthead's sign-in control. Pages are built ahead of time, so they
	// show "Sign in" until the browser reads the signed-in hint
	// (src/lib/signed-in-hint.ts) and then show "Workspace". Without scripts the
	// link stays "Sign in", which still works: a signed-in person who follows it
	// goes on to the workspace. Until Auth0 is set up, /sign-in says that
	// sign-in is not available yet (site/COLLABORATION.md). Nobody needs to
	// sign in to read the site or to make a request.
	import { onMount } from 'svelte';
	import LogIn from '@lucide/svelte/icons/log-in';
	import UserRound from '@lucide/svelte/icons/user-round';
	import { signedInHintCookie } from '#lib/signed-in-hint.ts';

	let signedIn = $state(false);

	onMount(() => {
		signedIn = document.cookie
			.split(';')
			.some((entry) => entry.trim() === `${signedInHintCookie}=1`);
	});
</script>

{#if signedIn}
	<a class="account-link" href="/workspace" data-sveltekit-reload>
		<UserRound size={20} strokeWidth={1.75} />
		Workspace
	</a>
{:else}
	<a class="account-link" href="/sign-in" data-sveltekit-reload>
		<LogIn size={20} strokeWidth={1.75} />
		Sign in
	</a>
{/if}

<style>
	.account-link {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-band-text);
		border-radius: var(--radius-control);
		color: var(--color-band-text);
		font-weight: var(--font-weight-semibold);
		text-decoration: none;
		white-space: nowrap;
	}

	.account-link:visited {
		color: var(--color-band-text);
	}

	.account-link:hover {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.18em;
	}
</style>
