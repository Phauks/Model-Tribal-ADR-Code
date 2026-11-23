<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const name = $derived(form?.name ?? '');
</script>

<svelte:head>
	<title>Delete your account · Model Tribal ADR Code</title>
</svelte:head>

<h1>Delete your account</h1>
<p class="lead">Your account is deleted at once. It cannot be undone.</p>

<h2>What is deleted</h2>
<ul>
	<li>Your sign-in: your email address, your password and any codes. You are signed out everywhere.</li>
	{#if data.profile}
		<li>Your profile: every answer and every version you confirmed, including your phone number and the nations you listed.</li>
		<li>Your contributor page and your picture, if you have them.</li>
	{/if}
	{#if data.hasWorkspaceAccess}
		<li>Your access to the workspace.</li>
	{/if}
	<li>Pages you follow, and your email setting for updates to them.</li>
</ul>

<h2>What stays</h2>
<ul>
	<li>
		Drafts you wrote and reviews you gave stay in the history, so the record of who did what holds. You
		choose below whether they keep your name.
	</li>
	<li>
		Forms you signed for stories, interviews or documents stay on file. To take something back, use the
		<a href="/forms/change-or-withdrawal-request">Change or withdrawal</a> form, before or after you delete
		your account.
	</li>
	<li>A credit already printed in a book cannot be recalled. The next edition follows your choice below.</li>
	<li>Pages you starred or saved on this device stay in this browser. You can clear them in Settings, under Data.</li>
</ul>

{#if form?.problem}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{/if}

<form method="post">
	<fieldset>
		<legend><h2>Your name on work you helped with</h2></legend>
		<div class="choice">
			<input type="radio" id="name-keep" name="name" value="keep" checked={name === 'keep'} aria-describedby="name-keep-hint" />
			<label for="name-keep">
				Keep my name
				<span class="hint" id="name-keep-hint">
					{#if data.creditLine}
						Your credit stays as you last confirmed it, “{data.creditLine}”, in the places you chose.
					{:else}
						Your name stays on drafts and reviews.
					{/if}
					Nothing else about you is kept.
				</span>
			</label>
		</div>
		<div class="choice">
			<input type="radio" id="name-remove" name="name" value="remove" checked={name === 'remove'} aria-describedby="name-remove-hint" />
			<label for="name-remove">
				Remove my name
				<span class="hint" id="name-remove-hint">
					Your credit is removed, and your drafts and reviews show “Former contributor”.
				</span>
			</label>
		</div>
	</fieldset>
	<div class="choice">
		<input type="checkbox" id="sure" name="sure" value="yes" />
		<label for="sure">I understand my account is deleted at once and cannot be restored</label>
	</div>
	<p class="actions">
		<button class="button button-danger" type="submit">Delete my account</button>
		<a href="/profile">Cancel</a>
	</p>
</form>

<style>
	fieldset {
		border: none;
		padding: 0;
		margin: var(--space-4) 0;
	}

	.choice {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		margin: var(--space-3) 0;
	}

	.choice input {
		margin-top: 0.3em;
		width: 1.25rem;
		height: 1.25rem;
		flex: none;
	}

	.choice .hint {
		display: block;
	}

	.actions {
		display: flex;
		gap: var(--space-4);
		align-items: center;
		flex-wrap: wrap;
	}

	.button-danger {
		background: var(--color-danger);
		border-color: var(--color-danger);
		color: var(--color-paper);
	}
</style>
