<script lang="ts">
	import ProfileSummary from '#lib/components/ProfileSummary.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const profile = $derived(data.profile!);
	const missing = $derived(Object.entries(data.missing));
	const sections: Record<string, string> = {
		givenName: 'about',
		adultConfirmed: 'about',
		phone: 'contact',
		nations: 'nations',
		interests: 'help',
		creditForm: 'credit',
		creditRole: 'credit',
		creditPseudonym: 'credit',
		biography: 'credit'
	};
</script>

<svelte:head>
	<title>Check your answers · Model Tribal ADR Code</title>
</svelte:head>

<h1>Check your answers</h1>
<p class="lead">
	This is everything you have told us, who can see each part, and your credit exactly as it will be
	printed. Change anything before you confirm.
</p>

{#if missing.length > 0}
	<div class="notice notice-problem" role="alert">
		<p><strong>A few answers are still needed before you can confirm:</strong></p>
		<ul>
			{#each missing as [field, message] (field)}
				<li><a href="/profile/edit#{sections[field] ?? 'about'}">{message}</a></li>
			{/each}
		</ul>
	</div>
{/if}

<ProfileSummary answers={profile.answers} email={profile.email} changeLinks />

<section aria-labelledby="confirm-heading">
	<h2 id="confirm-heading">Confirm</h2>
	<ul>
		<li>Your credit is used only in the form shown above, and only where you chose.</li>
		<li>
			Each time you confirm, we keep a copy of this page, so it is clear what you agreed to and when.
			Credits always use the version you last confirmed.
		</li>
		<li>
			Before each edition goes to print, we ask you to check your credit again.
		</li>
		<li>You can change your answers or delete your profile at any time from your profile page.</li>
	</ul>
	{#if form?.problem}
		<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
	{/if}
	<form method="post">
		<div class="choice">
			<input type="checkbox" id="agree" name="agree" value="yes" disabled={missing.length > 0} />
			<label for="agree">These answers are correct, and I agree to be credited as shown</label>
		</div>
		<p>
			<button class="button" type="submit" disabled={missing.length > 0}>
				{profile.status === 'draft' ? 'Confirm and send' : 'Confirm the changes'}
			</button>
			<a class="button button-quiet" href="/profile">Not now</a>
		</p>
	</form>
</section>

<style>
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
