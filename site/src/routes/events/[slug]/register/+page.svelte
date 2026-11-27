<script lang="ts">
	// Registering for an event (site/COLLABORATION.md, "Events"; design/events-and-cle, "3-registration").
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const values = $derived(form && 'values' in form ? form.values : undefined);
	const field = $derived(form && 'field' in form ? form.field : undefined);
	const problem = $derived(form && 'problem' in form ? form.problem : undefined);
	const chosenNeeds = $derived(new Set(values?.needs ?? []));
</script>

<svelte:head>
	<title>Register · {data.event.title} · Events · Tribal Law Project</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="reading">
	<Breadcrumbs
		trail={[
			{ label: 'Events', href: '/events' },
			{ label: data.event.title, href: `/events/${data.event.slug}` }
		]}
		current="Register"
	/>
	<h1>Register</h1>
	<p>{data.event.when}</p>

	{#if problem && field !== 'name' && field !== 'ticket'}
		<div class="notice notice-problem" role="alert"><p>{problem}</p></div>
	{/if}

	<form method="post">
		<fieldset class="group">
			<legend>How will you take part?</legend>
			{#if field === 'ticket'}<p class="field-error" id="ticket-error">{problem}</p>{/if}
			{#each data.tickets as ticket (ticket.identifier)}
				<div class="choice">
					<input type="radio" id="ticket-{ticket.identifier}" name="ticket" value={ticket.identifier} checked={ticket.identifier === data.chosen} />
					<label for="ticket-{ticket.identifier}">
						{ticket.name}
						<span class="hint">{ticket.full ? 'Full: you will join the waitlist' : ticket.status}</span>
					</label>
				</div>
			{/each}
		</fieldset>

		<div class="field">
			<label for="name">Your name</label>
			<p class="hint" id="name-hint">As it should appear on the list of people coming.</p>
			{#if field === 'name'}<p class="field-error" id="name-error">{problem}</p>{/if}
			<input
				type="text"
				id="name"
				name="name"
				autocomplete="name"
				maxlength="200"
				required
				value={values?.name ?? data.name}
				aria-describedby="name-hint"
				aria-invalid={field === 'name' ? 'true' : undefined}
			/>
		</div>

		<fieldset class="group">
			<legend>What do you need to take part?</legend>
			<p class="hint">Only the people running the event see this, and it is deleted 30 days after the event.</p>
			{#each data.needs as need, index (need)}
				<div class="choice">
					<input type="checkbox" id="need-{index}" name="need" value={need} checked={chosenNeeds.has(need)} />
					<label for="need-{index}">{need}</label>
				</div>
			{/each}
			<div class="field">
				<label for="need-other">Something else</label>
				<textarea id="need-other" name="need-other" rows="2" maxlength="1500">{values?.other ?? ''}</textarea>
			</div>
		</fieldset>

		<fieldset class="group">
			<legend>Reminders</legend>
			<div class="choice">
				<input type="checkbox" id="reminders" name="reminders" value="yes" checked />
				<label for="reminders">Email me the day before and shortly before it starts</label>
			</div>
		</fieldset>

		<div class="buttons">
			<a class="button button-quiet" href="/events/{data.event.slug}">Back</a>
			<button class="button" type="submit">Register</button>
		</div>
	</form>
</div>

<style>
	.group {
		margin: 0 0 var(--space-5);
		padding: 0;
		border: 0;
	}

	.group legend {
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

	.choice .hint {
		display: block;
		margin: 0;
	}

	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}
</style>
