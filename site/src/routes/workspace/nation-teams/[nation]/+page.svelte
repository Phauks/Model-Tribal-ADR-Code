<script lang="ts">
	import {
		atLeastTeamLevel,
		describeParts,
		pagePartLabels,
		pageParts,
		teamLevelDescriptions,
		teamLevelLabels,
		teamLevels,
		type TeamLevel
	} from '#lib/nation-teams.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Only the levels and parts this person may give are offered; the server checks again.
	const givableLevels = $derived(
		teamLevels.filter((level) => data.isAdministrator || (data.own.level && atLeastTeamLevel(data.own.level, level)))
	);
	const givableParts = $derived(data.own.parts === null ? pageParts : pageParts.filter((part) => data.own.parts?.includes(part)));
	let level = $state<TeamLevel>('editor');
	let scope = $state<'whole' | 'parts'>('whole');
	const wholePageAllowed = $derived(data.isAdministrator || data.own.parts === null);

	function date(value: string | null): string {
		return value ? new Date(value).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '';
	}

	function when(value: string): string {
		return new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
	}
</script>

<svelte:head>
	<title>Team for {data.nation.title} · Workspace · Model Tribal ADR Code</title>
</svelte:head>

{#if data.isAdministrator}<p class="small"><a href="/workspace/nation-teams">Nation teams</a></p>{/if}
<h1>Team for {data.nation.title}</h1>
<p>
	{#if data.isAdministrator}
		As the lead author you can add, change and end any place on this team, and suspend a person together with
		everyone they added.
	{:else if data.canManage}
		You are a steward for {data.nation.title}, so you can add and remove people for this nation’s page. You can
		give anyone up to your own level and parts of the page. You cannot give access to any other nation.
	{:else}
		You are {teamLevelLabels[data.own.level ?? 'reviewer'].toLocaleLowerCase('en-US')} for {data.nation.title},
		for {describeParts(data.own.parts)}. A steward of the team adds and removes people.
	{/if}
	{#if data.nation.page}<a href={data.nation.page}>View the page</a>.{/if}
</p>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

<section aria-labelledby="team-heading">
	<h2 id="team-heading">Who is on the team</h2>
	{#if data.team.length === 0}
		<p>Nobody yet.</p>
	{:else}
		<div class="table-scroll" tabindex="-1">
			<table>
				<thead>
					<tr><th scope="col">Person</th><th scope="col">Level</th><th scope="col">Parts</th><th scope="col">Until</th><th scope="col">Added by</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr>
				</thead>
				<tbody>
					{#each data.team as place (place.identifier)}
						<tr>
							<td>
								{place.personName}
								{#if place.office}<br /><span class="small muted">{place.office}</span>{/if}
								{#if place.personStatus === 'invited'}<br /><span class="small muted">Has not signed in yet</span>{/if}
							</td>
							<td>{teamLevelLabels[place.level]}</td>
							<td>{describeParts(place.parts)}</td>
							<td>{date(place.expiresAt)}</td>
							<td>
								{#if place.addedByProject}The project, after the nation confirmed{#if place.basis}<br /><span class="small muted">{place.basis}</span>{/if}{:else}{place.grantedByName ?? ''}{/if}
							</td>
							<td>
								{#if place.personIdentifier === data.own.personIdentifier}
									<form method="post" action="?/end">
										<input type="hidden" name="place" value={place.identifier} />
										<button class="button button-quiet" type="submit">Leave the team</button>
									</form>
								{:else if data.isAdministrator || (data.canManage && !place.addedByProject)}
									<form method="post" action="?/end">
										<input type="hidden" name="place" value={place.identifier} />
										<button class="button button-quiet" type="submit">End {place.personName}’s place</button>
									</form>
								{/if}
								{#if data.isAdministrator && place.personIdentifier !== data.own.personIdentifier}
									<form method="post" action="?/suspend">
										<input type="hidden" name="place" value={place.identifier} />
										<button class="button button-quiet danger" type="submit">Suspend {place.personName} and everyone they added</button>
									</form>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

{#if data.canManage}
	<form method="post" action="?/add" class="panel">
		<h2>Add a person, or change a person’s place</h2>
		<p class="small">Adding someone already on the team replaces their place. The nation’s office is told about every person added.</p>
		<div class="field">
			<label for="email">Their email address</label>
			<input type="email" id="email" name="email" autocomplete="off" required />
		</div>
		<div class="field">
			<label for="name">Their name</label>
			<input type="text" id="name" name="name" autocomplete="off" required />
		</div>
		<div class="field">
			<label for="office">Their title or office</label>
			<p class="hint">Optional.</p>
			<input type="text" id="office" name="office" autocomplete="off" />
		</div>
		<fieldset>
			<legend>Level</legend>
			{#each givableLevels as option (option)}
				<div class="choice">
					<input type="radio" id="level-{option}" name="level" value={option} bind:group={level} />
					<label for="level-{option}">{teamLevelLabels[option]} <span class="hint">{teamLevelDescriptions[option]}</span></label>
				</div>
			{/each}
		</fieldset>
		<fieldset>
			<legend>Parts of the page</legend>
			{#if wholePageAllowed}
				<div class="choice">
					<input type="radio" id="scope-whole" name="scope" value="whole" bind:group={scope} />
					<label for="scope-whole">The whole page</label>
				</div>
				<div class="choice">
					<input type="radio" id="scope-parts" name="scope" value="parts" bind:group={scope} />
					<label for="scope-parts">Only some parts</label>
				</div>
			{:else}
				<input type="hidden" name="scope" value="parts" />
			{/if}
			{#if scope === 'parts' || !wholePageAllowed}
				{#each givableParts as part (part)}
					<div class="choice" class:indented={wholePageAllowed}>
						<input type="checkbox" id="part-{part}" name="parts" value={part} />
						<label for="part-{part}">{pagePartLabels[part]}</label>
					</div>
				{/each}
			{/if}
		</fieldset>
		<div class="field">
			<label for="expires">Until</label>
			<p class="hint">Two years at most; it can be renewed.</p>
			{#key level}
				<input type="date" id="expires" name="expires" required value={data.usualEnds[level]} max={data.latestEnd} />
			{/key}
		</div>
		<button class="button" type="submit">Save</button>
	</form>
{/if}

<section aria-labelledby="activity-heading">
	<h2 id="activity-heading">Recent activity</h2>
	{#if data.activity.length === 0}
		<p>Nothing yet.</p>
	{:else}
		<ul class="activity">
			{#each data.activity.slice(0, 50) as entry (entry.identifier)}
				<li>
					<span class="small muted">{when(entry.createdAt)}</span><br />
					{entry.personName ?? 'From the website'}: {entry.action}{#if entry.note}. <span class="small">{entry.note}</span>{/if}
				</li>
			{/each}
		</ul>
		<p class="small muted">This log cannot be changed or deleted, by anyone.</p>
	{/if}
</section>

<style>
	fieldset {
		border: 0;
		padding: 0;
		margin: 0 0 var(--space-4);
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
	}

	.choice .hint {
		display: block;
		margin: 0;
	}

	.indented {
		margin-left: var(--space-6);
	}

	input[type='date'] {
		font: inherit;
		min-height: var(--layout-target-minimum);
	}

	.activity {
		list-style: none;
		padding: 0;
	}

	.activity li {
		margin-bottom: var(--space-3);
	}

	td form + form {
		margin-top: var(--space-2);
	}

	.danger {
		color: var(--color-danger);
	}
</style>
