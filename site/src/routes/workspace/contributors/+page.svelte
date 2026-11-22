<script lang="ts">
	import { keyboardScroll } from '#lib/keyboard-scroll.ts';
	import {
		creditSectionLabels,
		creditSections,
		interestLabels,
		profileStatusLabels
	} from '#lib/contributors.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const waiting = $derived(data.profiles.filter((profile) => profile.status === 'submitted').length);

	function date(value: string | null): string {
		return value ? new Date(value).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '';
	}
</script>

<svelte:head>
	<title>Contributors · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<h1>Contributors</h1>
<p class="lead">
	People who registered to help. {waiting === 0
		? 'Nobody is waiting for an answer.'
		: `${waiting} ${waiting === 1 ? 'registration is' : 'registrations are'} waiting for an answer.`}
	Profiles that were started but not sent stay private to the person.
</p>

{#if data.profiles.length === 0}
	<p>Nobody has registered yet. People register at <a href="/join">/join</a>.</p>
{:else}
	<div class="table-scroll" role="region" aria-label="Table: contributors" {@attach keyboardScroll}>
		<table>
			<thead>
				<tr>
					<th scope="col">Name</th>
					<th scope="col">Status</th>
					<th scope="col">Would like to</th>
					<th scope="col">Native nations</th>
					<th scope="col">Sent</th>
				</tr>
			</thead>
			<tbody>
				{#each data.profiles as profile (profile.identifier)}
					<tr>
						<td><a href="/workspace/contributors/{profile.identifier}">{profile.name}</a></td>
						<td>
							{profileStatusLabels[profile.status]}{profile.hasWorkspaceAccess ? '; has workspace access' : ''}
						</td>
						<td>{profile.interests.map((interest) => interestLabels[interest]).join('; ')}</td>
						<td>{profile.nations.join('; ')}</td>
						<td>{date(profile.submittedAt)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<section>
	<h2>Credits as they would be printed today</h2>
	<p>
		Welcomed contributors placed in a section, from the version each person last confirmed, in order
		of family name. Changes a person has not confirmed are never used.
	</p>
	{#each creditSections as section (section)}
		{@const entries = data.credits.filter((credit) => credit.section === section)}
		{#if entries.length > 0}
			<h3>{creditSectionLabels[section]}</h3>
			<ul>
				{#each entries as entry, position (position)}
					<li>
						{entry.line}
						<span class="small muted">
							({[entry.inBook ? 'book' : '', entry.onWebsite ? 'website' : ''].filter(Boolean).join(' and ')})
						</span>
						{#if entry.biography}<p class="small">{entry.biography}</p>{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{/each}
	{#if data.credits.length === 0}<p>No credits yet.</p>{/if}
</section>
