<script lang="ts">
	import ProfileSummary from '#lib/components/ProfileSummary.svelte';
	import { profileStatusLabels } from '#lib/contributors.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const profile = $derived(data.profile);

	function date(value: string): string {
		return new Date(value).toLocaleDateString('en-US', { dateStyle: 'long' });
	}
</script>

<svelte:head>
	<title>Your profile · Model Tribal ADR Code</title>
</svelte:head>

{#if data.deleted}
	<div class="notice" role="status">
		<p>Your profile and everything in it are deleted. Thank you for your interest in the project.</p>
	</div>
{/if}

{#if !profile}
	<h1>Help with the project</h1>
	<p class="lead">
		Tell us a little about yourself and how you would like to help. It takes about ten minutes, and
		you can stop and come back.
	</p>
	<h2>What we ask, and why</h2>
	<ul>
		<li>
			<strong>Your name and how to reach you</strong>, so we can talk with you. Your email address
			comes from signing in. A phone number is optional.
		</li>
		<li>
			<strong>Any Native nation you are connected to, if you want to say.</strong> It is never
			required and never checked, and listing a nation does not mean you speak for it.
		</li>
		<li><strong>Your background and how you would like to help</strong>, so we can match work to you.</li>
		<li>
			<strong>How you want to be credited</strong>: by name, by name and nation, by a description,
			by a name you choose, or not at all, and whether in the book, on the website, or both.
		</li>
	</ul>
	<h2>Who sees it</h2>
	<p>
		Only the lead author and editors see what you write here. Nothing is published except the credit
		you choose, and only after you confirm it on a review page. Your email address and phone number
		are never printed or published. You can change your answers or delete your profile at any time.
	</p>
	<p><a class="button" href="/profile/edit">Start</a></p>
	<p class="small muted">
		Registering does not give the project permission to use anything you share with it. Stories,
		interviews and documents each get their own contributor statement, where you choose how they may
		be used. If you would rather not make an account, you can
		<a href="/requests?kind=contribute">offer to contribute through the request form</a>.
	</p>
{:else}
	<h1>Your profile</h1>

	{#if data.confirmed}
		<div class="notice" role="status">
			<p>
				<strong>Thank you. Your profile is confirmed.</strong>
				{profile.status === 'submitted'
					? 'The lead author will be in touch, using the way to reach you that you chose.'
					: 'Your credit now uses this version.'}
			</p>
		</div>
	{/if}

	<dl class="summary-list">
		<div>
			<dt>Registration</dt>
			<dd>
				{profileStatusLabels[profile.status]}
				{#if profile.submittedAt}<span class="small muted">(sent {date(profile.submittedAt)})</span>{/if}
				{#if profile.status === 'declined' && profile.decisionNote}
					<p class="small">{profile.decisionNote}</p>
				{/if}
			</dd>
		</div>
		<div>
			<dt>Confirmed version</dt>
			<dd>
				{#if profile.confirmedVersion}
					Version {profile.confirmedVersion}, {date(profile.confirmedAt ?? profile.updatedAt)}
				{:else}
					None yet
				{/if}
			</dd>
		</div>
	</dl>

	{#if profile.hasUnconfirmedChanges}
		<div class="notice" role="note">
			<p>
				{#if profile.confirmedVersion}
					You have changes that are not confirmed yet. Until you confirm them, your credit uses version
					{profile.confirmedVersion}.
				{:else}
					Your profile is saved but not sent yet. Check your answers and confirm them to send it to the
					lead author.
				{/if}
			</p>
			<p><a class="button" href="/profile/review">Check and confirm</a></p>
		</div>
	{/if}

	<p><a class="button button-quiet" href="/profile/edit">Edit your profile</a></p>

	<ProfileSummary answers={profile.answers} email={profile.email} />

	<details class="leave">
		<summary>Delete your profile</summary>
		<p>
			This deletes your profile, your answers and every confirmed version, at once. A credit already
			printed in a book cannot be recalled, but the next edition leaves it out.
			{#if data.hasWorkspaceAccess}
				Your workspace access is not changed; ask the lead author to end it.
			{/if}
		</p>
		{#if form?.problem}
			<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
		{/if}
		<form method="post" action="?/delete">
			<div class="choice">
				<input type="checkbox" id="sure" name="sure" value="yes" />
				<label for="sure">I want to delete my profile</label>
			</div>
			<p><button class="button button-quiet" type="submit">Delete my profile</button></p>
		</form>
	</details>
{/if}

<style>
	.leave {
		margin-top: var(--space-6);
		border-top: 1px solid var(--color-line);
		padding-top: var(--space-4);
	}

	.leave summary {
		cursor: pointer;
		font-weight: var(--font-weight-semibold);
		min-height: var(--layout-target-minimum);
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
</style>
