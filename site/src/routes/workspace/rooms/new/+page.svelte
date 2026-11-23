<script lang="ts">
	import RoomFields from '../RoomFields.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const values = $derived(form?.values ?? data.values);
</script>

<svelte:head>
	<title>Plan a room · Video rooms · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<p class="small"><a href="/workspace/rooms">Video rooms</a></p>
<h1>Plan a room</h1>
<p>
	For an interview, choose a private room that is recorded, then send the person an invite link from the room’s page.
	They are told it is recorded, and who may watch the recording, and must agree before they join.
</p>
{#if form?.problem}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{/if}
<form method="post">
	<RoomFields {values} invalid={form?.field} problem={form?.problem} />
	<p><button class="button" type="submit">Make the room</button></p>
</form>
