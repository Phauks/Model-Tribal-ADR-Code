<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Video rooms · Tribal Law Project</title>
</svelte:head>

<h1>Video rooms</h1>
<p>
	Public video rooms the project is holding now or soon. Anyone signed in may join one. Before you join, the room says
	whether it is recorded and who may watch the recording. Events have their own rooms, on their pages under
	<a href="/events">Events</a>.
</p>
{#if data.mayStart}
	<p><a class="button" href="/workspace/rooms">Start or plan a room</a></p>
{/if}

{#if data.rooms.length === 0}
	<p class="muted">No public rooms are open or planned right now.</p>
{:else}
	<ul class="rooms">
		{#each data.rooms as room (room.identifier)}
			<li class="panel">
				<h2><a href="/rooms/{room.identifier}" target="_blank" rel="noopener">{room.title}<span class="visually-hidden"> (opens in a new tab)</span></a></h2>
				<p>{room.when}</p>
				<p class="small">{room.open ? 'Open now' : 'Not open yet'}</p>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.rooms {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-3);
	}

	.rooms h2 {
		margin-top: 0;
	}
</style>
