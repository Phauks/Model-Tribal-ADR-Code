<script lang="ts">
	import ProfileSummary from '#lib/components/ProfileSummary.svelte';
	import { profileStatusLabels } from '#lib/contributors.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const profile = $derived(data.profile);

	function date(value: string): string {
		return new Date(value).toLocaleDateString('en-US', { dateStyle: 'long' });
	}
</script>

<svelte:head>
	<title>Your profile · Tribal Law Project</title>
</svelte:head>

{#if !profile}
	<h1>Help write the code</h1>
	<p class="lead">
		Tell us a little about yourself and how you would like to help. It takes about ten minutes, and
		you can stop and come back.
	</p>
	<h2>What we ask, and why</h2>
	<ul>
		<li><strong>Your names and how to reach you</strong>, so we can talk with you.</li>
		<li><strong>Any Native nation you are connected to, if you want to say.</strong></li>
		<li><strong>Your background and how you would like to help</strong>, so we can match work to you.</li>
		<li><strong>Where each answer may appear</strong>: in the book, on the website, or neither.</li>
	</ul>
	<h2>Who sees it</h2>
	<p>
		Only the lead author and editors see your answers. Nothing is published except what you tick for the
		book or the website, and only after you confirm it on a review page. Your email addresses, phone
		numbers and birth year are never published.
	</p>
	<p><a class="button" href="/profile/edit">Start</a></p>
	<p class="small muted">
		Signing up is not permission to use anything you share. Stories,
		interviews and documents each get their own contributor statement, where you choose how they may
		be used. If you would rather not make an account, you can
		<a href="/requests?kind=contribute">offer to contribute through the request form</a>.
	</p>
{:else}
	<h1>Your profile</h1>

	{#if data.saved}
		<div class="notice" role="status"><p>Your draft is saved.</p></div>
	{/if}

	{#if data.confirmed}
		<div class="notice" role="status">
			<p>
				<strong>Thank you. Your profile is confirmed.</strong>
				{profile.confirmedVersion === 1
					? 'You are signed up. The lead author will be in touch, using the way to reach you that you chose.'
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

	{#if profile.status === 'welcomed' && profile.publicSlug && !profile.hasUnconfirmedChanges}
		<p>Your contributor page: <a href="/contributors/{profile.publicSlug}">/contributors/{profile.publicSlug}</a></p>
	{/if}

	<ProfileSummary
		answers={profile.answers}
		picture={profile.pictureKey ? `/profile/picture?v=${encodeURIComponent(profile.pictureUpdatedAt ?? '')}` : null}
		curriculumVitae={profile.curriculumVitaeName ? { name: profile.curriculumVitaeName, href: '/profile/curriculum-vitae' } : null}
	/>

{/if}

<section class="nation-team" aria-labelledby="nation-team-heading">
	<h2 id="nation-team-heading">Your nation’s page</h2>
	<p>
		If your nation chooses you to keep its page up to date, you can ask for a place on its team. Once your
		nation’s office confirms you, your changes go live on the page, labeled as coming from the nation.
	</p>
	<p><a class="button button-quiet" href="/profile/nation-team">Ask to edit your nation’s page</a></p>
</section>

<p class="small muted">To download what the project keeps about you or delete your account, go to <a href="/account/data">Your data</a>.</p>

<style>
	.nation-team {
		margin-top: var(--space-6);
		border-top: 1px solid var(--color-line);
		padding-top: var(--space-4);
	}
</style>
