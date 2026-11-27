<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import EventFields from '#lib/components/EventFields.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Add an event · Workspace · Tribal Law Project</title>
</svelte:head>

<Breadcrumbs
	trail={[
		{ label: 'Workspace', href: '/workspace' },
		{ label: 'Events', href: '/workspace/events' }
	]}
	current="Add an event"
/>
<h1>Add an event</h1>
<p>The event is saved as a draft. Add the kinds of seat and the speakers on the next page, then publish it.</p>

{#if form?.problem}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{/if}

<form method="post">
	<EventFields values={form?.values ?? data.values} invalid={form?.field} problem={form?.problem} />
	<p><button class="button" type="submit">Save the draft</button></p>
</form>
