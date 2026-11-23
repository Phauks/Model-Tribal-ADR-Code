<script lang="ts">
	import { page } from '$app/state';
	import ProfilePicturePicker from '#lib/components/ProfilePicturePicker.svelte';
	import ProfileSummary from '#lib/components/ProfileSummary.svelte';
	import { profileStatusLabels } from '#lib/contributors.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const pictureNotice = $derived(page.url.searchParams.get('picture'));

	const profile = $derived(data.profile);

	function date(value: string): string {
		return new Date(value).toLocaleDateString('en-US', { dateStyle: 'long' });
	}
</script>

<svelte:head>
	<title>Your profile · Model Tribal ADR Code</title>
</svelte:head>

{#if !profile}
	<h1>Help write the code</h1>
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
		you choose, and only after you confirm it on a review page. If you are credited on the website by
		name or by a name you choose, you also get a contributor page that shows that credit, your picture if
		you add one, and the published work you helped with. Your email address and phone number
		are never printed or published. You can change your answers or delete your profile at any time.
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

	<ProfileSummary answers={profile.answers} email={profile.email} />

	<section aria-labelledby="picture-heading">
		<h2 id="picture-heading">Picture</h2>
		{#if pictureNotice === 'saved'}
			<div class="notice" role="status"><p>Your picture is saved.</p></div>
		{:else if pictureNotice === 'removed'}
			<div class="notice" role="status"><p>Your picture is removed.</p></div>
		{/if}
		{#if profile.answers.ageGroup === '18-or-older'}
			{#if profile.pictureKey}
				<img class="own-picture" src="/profile/picture?v={encodeURIComponent(profile.pictureUpdatedAt ?? '')}" alt="Now on your profile" width="128" height="128" />
			{/if}
			<p id="picture-hint" class="small muted">
				Shown on your contributor page while you have one. It is never printed in the book. We crop it to a
				square from the middle and remove the camera details and location from it.
			</p>
			{#if form?.pictureProblem}
				<p class="field-error" role="alert"><span class="visually-hidden">Error:</span> {form.pictureProblem}</p>
			{/if}
			<form method="post" action="?/picture" enctype="multipart/form-data" class="picture-form">
				<label for="picture">{profile.pictureKey ? 'Choose a new picture' : 'Choose a picture'}</label>
				<ProfilePicturePicker side={data.pictureSide} describedBy="picture-hint" />
				<p><button class="button" type="submit">Save picture</button></p>
			</form>
			{#if profile.pictureKey}
				<form method="post" action="?/removePicture">
					<button class="button button-quiet" type="submit">Remove picture</button>
				</form>
			{/if}
		{:else if profile.answers.ageGroup === '13-to-17'}
			<p>Pictures are for people 18 or older, so nothing on the website can identify you.</p>
		{:else}
			<p>To add a picture, <a href="/profile/edit#about">answer the question about your age</a> first.</p>
		{/if}
	</section>
{/if}

<p class="small muted">To download what the project keeps about you or delete your account, go to <a href="/account/data">Your data</a>.</p>

<style>
	.own-picture {
		width: 8rem;
		height: 8rem;
		border-radius: 50%;
		object-fit: cover;
	}

</style>
