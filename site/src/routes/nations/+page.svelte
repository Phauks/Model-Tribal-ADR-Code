<script lang="ts">
	import { keyboardScroll } from '#lib/keyboard-scroll.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Nations · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<h1>Native nations</h1>
	<p class="lead">
		One page for every nation and community, drafted from public sources, with a way for each nation
		to correct, restrict or remove what the project says about it.
	</p>
	{#if data.example}
		<div class="notice" role="note">
			<p>
				The nation records are not published yet. The page below is a fictitious example that shows
				the layout.
			</p>
		</div>
	{/if}
	<p>
		<a href="/nations/map">See the map</a> of nations by state, with the Bureau of Indian Affairs
		regions.
	</p>
	<p>
		<strong>Is your nation missing?</strong>
		<a href="/requests?kind=add-nation">Ask to be added</a>. One federal or state government source
		that names the nation is enough.
	</p>
	<p class="small muted">
		The Native Hawaiian community and the Indigenous peoples of the territories are listed in their
		own groups, not as tribes.
	</p>
</div>

{#each data.groups as group (group.entityType)}
	<section aria-labelledby="group-{group.entityType}">
		<h2 id="group-{group.entityType}">{group.label}</h2>
		<p class="small muted">{group.rows.length.toLocaleString('en-US')} pages</p>
		<div class="table-scroll" role="region" aria-label="Table: {group.label}" {@attach keyboardScroll}>
			<table>
				<thead>
					<tr>
						<th scope="col">Name</th>
						<th scope="col">States</th>
						<th scope="col">Review status</th>
					</tr>
				</thead>
				<tbody>
					{#each group.rows as row (row.id)}
						<tr>
							<td><a href="/nations/{row.id}">{row.name}</a></td>
							<td>{row.states}</td>
							<td>{row.review}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
{/each}
