<script lang="ts">
	import { emailChoiceLabels, emailChoices } from '#lib/following.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Most email first, as drawn (design/settings-and-account).
	const choicesInOrder = ['daily', 'weekly', 'off'] as const satisfies readonly (typeof emailChoices)[number][];
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

<section class="account-card" aria-labelledby="follow-heading">
<h2 id="follow-heading">Pages you follow</h2>
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
		{#each choicesInOrder as choice (choice)}
			<div class="choice">
				<input type="radio" id="email-{choice}" name="email" value={choice} checked={data.emailChoice === choice} />
				<label for="email-{choice}">{emailChoiceLabels[choice]}</label>
			</div>
		{/each}
	</fieldset>
	<p class="small muted">
		An email lists the pages that changed and links to them. It never says what changed. Every email has a link
		that stops them.
	</p>
	<p><a href="/following">See and manage the pages you follow</a></p>
	<p><button class="button" type="submit">Save</button></p>
</form>
</section>

<section class="account-card" aria-labelledby="other-heading">
	<h2 id="other-heading">Other email</h2>
	<dl class="other">
		<div>
			<dt>Replies to requests you sent</dt>
			<dd class="small muted">Always sent, since you asked a question.</dd>
		</div>
		<div>
			<dt>Events and training you signed up for</dt>
			<dd class="small muted">Reminders a day before and two hours before, if you asked for them when you signed up.</dd>
		</div>
	</dl>
</section>

<style>
	.other {
		margin: 0;
	}

	.other > div {
		padding: var(--space-3) 0;
		border-top: 1px solid var(--color-line);
	}

	.other dt {
		font-weight: var(--font-weight-semibold);
	}

	.other dd {
		margin: 0;
	}

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
