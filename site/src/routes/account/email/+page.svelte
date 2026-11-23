<script lang="ts">
	import { emailChoiceLabels, emailChoices } from '#lib/following.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Email and notifications · Model Tribal ADR Code</title>
</svelte:head>

<h1>Email and notifications</h1>
<p class="lead">
	What the project sends you, and how often. Updates to pages you follow always show on the
	<a href="/following">Following</a> page and as a number on your account button as well.
</p>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

<h2>Pages you follow</h2>
{#if !data.emailReady}
	<div class="notice" role="note">
		<p>
			The site cannot send email yet. Your choice is saved, and emails start once it can. Until then, updates
			show on the Following page and as a number on your account button.
		</p>
	</div>
{/if}
<form method="post">
	<fieldset class="choices">
		<legend>Email me a summary, sent to {data.email}</legend>
		{#each emailChoices as choice (choice)}
			<div class="choice">
				<input type="radio" id="email-{choice}" name="email" value={choice} checked={data.emailChoice === choice} />
				<label for="email-{choice}">{emailChoiceLabels[choice]}</label>
			</div>
		{/each}
	</fieldset>
	<p><button class="button" type="submit">Save</button></p>
</form>
<p class="small muted">
	An email lists the pages that changed and links to them. It never says what changed. Every email has a link
	that stops them. <a href="/following">See the pages you follow</a>.
</p>

<style>
	.choices {
		margin: 0 0 var(--space-4);
		padding: 0;
		border: 0;
	}

	.choices legend {
		font-weight: var(--font-weight-semibold);
		margin-bottom: var(--space-2);
	}

	.choice {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		margin: var(--space-2) 0;
	}

	.choice input {
		margin-top: 0.3em;
		width: 1.25rem;
		height: 1.25rem;
		flex: none;
		accent-color: var(--color-action);
	}
</style>
