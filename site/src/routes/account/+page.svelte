<script lang="ts">
	import { accountPages } from '#lib/account-menu.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const lines: Record<string, string> = $derived({
		'/profile': data.summaries.profile,
		'/account/security': data.summaries.security,
		'/account/email': data.summaries.email,
		'/account/data': data.summaries.data
	});
	const sections = $derived(accountPages.filter((item) => item.link !== '/account'));
</script>

<svelte:head>
	<title>Your account · Model Tribal ADR Code</title>
</svelte:head>

<h1>Your account</h1>
<p class="lead">
	Who you are to the project and what it keeps about you. These are kept with your account, so they are the
	same on every device you sign in on.
</p>

<ul class="account-sections">
	{#each sections as section (section.link)}
		<li>
			<a href={section.link}>{section.label}</a>
			<p>{lines[section.link]}</p>
		</li>
	{/each}
</ul>

<div class="notice" role="note">
	<p>
		Text size, colors, motion and pages saved for offline are in <strong>Settings</strong>, under the cog at
		the top of the page, because they belong to each screen.
		{#if data.settingsEverywhere}
			Yours follow you to every device you sign in on.
		{:else}
			They stay on this device unless you choose, in Settings under This device, to use them on every device
			you sign in on.
		{/if}
	</p>
</div>

<style>
	.account-sections {
		list-style: none;
		padding: 0;
		margin: var(--space-5) 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr));
		gap: var(--space-4);
	}

	.account-sections li {
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		padding: var(--space-4);
		background: var(--color-surface);
	}

	.account-sections a {
		font-size: var(--font-size-lead);
		font-weight: var(--font-weight-semibold);
	}

	.account-sections p {
		margin: var(--space-2) 0 0;
	}
</style>
