<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Forms · Tribal Law Project</title>
	<meta
		name="description"
		content="Forms for sharing a story, an interview or a document with the project. Fill one in online or print it."
	/>
</svelte:head>

<div class="reading">
	<h1>Forms</h1>
	<p class="lead">
		Fill in a form on this site, or print it and fill it in by hand. You can say no to any part of a
		form, and you get a copy of what you send.
	</p>

	{#each data.groups as group (group.group)}
		<section aria-labelledby="group-{group.group}">
			<h2 id="group-{group.group}">{group.title}</h2>
			<p>{group.description}</p>
			<ul class="form-list">
				{#each group.forms as form (form.slug)}
					<li>
						<h3><a href="/forms/{form.slug}">{form.title}</a></h3>
						<p class="small muted">When to use it: {form.summary}.</p>
						<p class="small">
							<a href="/forms/{form.slug}">Fill in online</a>
							<span aria-hidden="true"> · </span>
							<a href="/forms/{form.slug}/print">Print a blank copy</a>
						</p>
					</li>
				{/each}
			</ul>
		</section>
	{/each}

	<h2>Your information</h2>
	<ul>
		<li>Forms you send are kept private. Only the lead author and editors see them.</li>
		<li>We never publish your contact details.</li>
		<li>You can change your mind at any time with the <a href="/forms/change-or-withdrawal-request">Change or withdrawal</a> form, or just tell us.</li>
	</ul>
</div>

<style>
	.form-list {
		list-style: none;
		padding: 0;
	}

	.form-list li {
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--color-line);
	}

	.form-list h3 {
		margin: 0 0 var(--space-1);
	}

	.form-list p {
		margin: 0 0 var(--space-1);
	}
</style>
