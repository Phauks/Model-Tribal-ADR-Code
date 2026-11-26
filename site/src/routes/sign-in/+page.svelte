<script lang="ts">
	import SignInForms from '#lib/components/SignInForms.svelte';
	import type { SignInState } from '#lib/sign-in-state.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const answer = $derived((form ?? undefined) as SignInState | undefined);
	// A form posted to "/sign-in?/send" or "?/code" loses the address's query, so the page to return to comes back with the form.
	const returnTo = $derived(answer?.returnTo || data.returnTo);
	const step = $derived(answer?.step ?? (data.create && data.codesAvailable ? 'create' : 'email'));
	const title = $derived(step === 'code' ? 'Check your email' : step === 'create' ? 'Create an account' : 'Sign in');
</script>

<svelte:head>
	<title>{answer?.problem ? 'Error: ' : ''}{title} · Tribal Law Project</title>
</svelte:head>

<div class="reading">
	{#if data.signedInAs}
		<div class="notice" role="status">
			<p>You are signed in as {data.signedInAs}. <a href="/workspace">Go to the workspace</a> or <a href="/profile">your profile</a>.</p>
		</div>
	{/if}

	<SignInForms {answer} codesAvailable={data.codesAvailable} {returnTo} creating={data.create} />
</div>
