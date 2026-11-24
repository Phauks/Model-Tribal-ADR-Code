<script lang="ts">
	// What the site shows of a nation's own laws and its courts' opinions: a
	// level for each kind, items set apart from their kind, what saving will
	// do, and the team's recent saves (design/nation-restrictions/, screens 1
	// and 2, approved by Trevor on Nov. 24, 2026; src/lib/nation-restrictions.ts).
	import Lock from '@lucide/svelte/icons/lock';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import {
		allowedLevels,
		describeRestrictionChange,
		itemLevel,
		kindCount,
		kindLevel,
		restrictionItemKindLabels,
		restrictionKindDescriptions,
		restrictionKindLabels,
		restrictionKinds,
		restrictionLevelLabels,
		savingLines,
		settingsChanges,
		tidySettings,
		type RestrictableItem,
		type RestrictionChange,
		type RestrictionKind,
		type RestrictionLevel,
		type RestrictionSettings
	} from '#lib/nation-restrictions.ts';
	import { readableDate } from '#lib/readable-date.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	/** The longest item list drawn at once; Find narrows it. */
	const mostRows = 200;

	// The choices being made, starting from what is in force.
	let kinds = $state<Partial<Record<RestrictionKind, RestrictionLevel>>>({});
	let apart = $state<Record<string, RestrictionLevel>>({});
	$effect.pre(() => {
		kinds = { ...data.settings.kinds };
		apart = { ...data.settings.items };
	});
	let find = $state('');
	let shownKind = $state<RestrictionKind | 'all'>('all');
	let onlyApart = $state(false);

	const draft: RestrictionSettings = $derived(tidySettings({ kinds, items: apart }, data.items));
	const changes = $derived(settingsChanges(data.settings, draft, data.items));
	const lines = $derived(savingLines(changes, data.items));
	const counts = $derived(Object.fromEntries(restrictionKinds.map((kind) => [kind, data.items.filter((item) => item.kind === kind).length])) as Record<RestrictionKind, number>);
	const presentKinds = $derived(restrictionKinds.filter((kind) => counts[kind] > 0));
	const kindChoices = $derived([{ value: 'all' as const, label: 'All kinds' }, ...presentKinds.map((kind) => ({ value: kind, label: restrictionKindLabels[kind] }))]);

	const matching = $derived.by(() => {
		const words = find.trim().toLocaleLowerCase('en-US');
		return data.items.filter(
			(item) =>
				(shownKind === 'all' || item.kind === shownKind) &&
				(!onlyApart || item.id in draft.items) &&
				(!words || `${item.title} ${item.citation ?? ''}`.toLocaleLowerCase('en-US').includes(words))
		);
	});

	function setKind(kind: RestrictionKind, level: RestrictionLevel): void {
		kinds = { ...kinds, [kind]: level };
	}

	function setItem(item: RestrictableItem, level: RestrictionLevel): void {
		const next = { ...apart };
		if (level === kindLevel({ kinds, items: {} }, item.kind)) delete next[item.id];
		else next[item.id] = level;
		apart = next;
	}

	function reset(): void {
		kinds = { ...data.settings.kinds };
		apart = { ...data.settings.items };
	}

	function the(title: string): string {
		return /^the\s/i.test(title) ? title.replace(/^the /, 'The ') : title;
	}

	function when(value: string): string {
		return `${readableDate(value.slice(0, 10))}, ${new Date(value).toLocaleTimeString('en-US', { timeStyle: 'short' })}`;
	}
</script>

<svelte:head>
	<title>{data.nation.title}’s laws and cases · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<p class="small page-links">
	<a href="/workspace/nation-teams/{data.nation.identifier}">Team</a> ·
	<a href="/workspace/nation-teams/{data.nation.identifier}/edit">Edit the page</a> ·
	<a href="/workspace/nation-teams/{data.nation.identifier}/changes">Changes and history</a> ·
	<strong aria-current="page">Laws and cases</strong>
	{#if data.nation.page}· <a href={data.nation.page}>View the page</a>{/if}
</p>
<h1>{the(data.nation.title)}’s laws and cases</h1>
<p class="lede">Choose how the site shows the nation’s laws and its courts’ opinions. A change shows within minutes. Stewards and editors can make changes.</p>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

{#if data.question}
	<form method="post" action="?/answer" class="notice">
		<p><strong>The project asks</strong> <span class="small muted">({when(data.question.askedAt)})</span></p>
		<p>{data.question.text}</p>
		<input type="hidden" name="save" value={data.question.save} />
		<div class="field note"><label for="answer">Your answer</label><textarea id="answer" name="answer" required></textarea></div>
		<button class="button" type="submit">Send the answer</button>
	</form>
{/if}

<form method="post" action="?/save">
	<input type="hidden" name="settings" value={JSON.stringify(draft)} />

	<h2>By kind</h2>
	<div class="table-scroll">
		<table class="kinds">
			<thead><tr><th scope="col">Kind</th><th scope="col">On the site</th><th scope="col">Shown as</th></tr></thead>
			<tbody>
				{#each presentKinds as kind (kind)}
					<tr>
						<td><strong>{restrictionKindLabels[kind]}</strong><br /><span class="small muted">{restrictionKindDescriptions[kind]}</span></td>
						<td>{kindCount(kind, counts[kind])}</td>
						<td>
							<div class="levels" role="radiogroup" aria-label={restrictionKindLabels[kind]}>
								{#each allowedLevels[kind] as level (level)}
									<button
										type="button"
										role="radio"
										aria-checked={kindLevel({ kinds, items: {} }, kind) === level}
										disabled={!data.canChange}
										onclick={() => setKind(kind, level)}>{restrictionLevelLabels[level]}</button
									>
								{/each}
							</div>
							{#if kind === 'agreements'}<br /><span class="small muted">The United States publishes them, so they stay listed.</span>{/if}
						</td>
					</tr>
				{/each}
				<tr>
					<td><strong>Federal and state law</strong><br /><span class="small muted">Treaties, statutes, and federal and state court cases</span></td>
					<td>{data.alwaysShown}</td>
					<td>
						<span class="always small muted"><Lock size={16} aria-hidden="true" /> Always shown</span><br />
						<a class="small" href="/workspace/nation-teams/{data.nation.identifier}/edit#statement-law-heading">Add the nation’s statement beside one</a>
					</td>
				</tr>
			</tbody>
		</table>
	</div>
	<ul class="level-meanings small">
		<li><strong>Show:</strong> listed, with the text on this site.</li>
		<li><strong>Cite only:</strong> listed by citation, linked to where the original is kept. No copy on this site, and no text in search, downloads, print or data sets.</li>
		<li><strong>Hide:</strong> not listed anywhere on the site, in downloads, print or data sets.</li>
	</ul>

	<h2>Each item</h2>
	<div class="tools">
		<div class="field"><label for="find">Find</label><input id="find" type="search" placeholder="Name or citation" bind:value={find} /></div>
		<div class="field"><Dropdown label="Kind" id="kind" choices={kindChoices} bind:value={shownKind} /></div>
		<label class="small"><input type="checkbox" bind:checked={onlyApart} /> Only items set apart from their kind</label>
	</div>
	{#if matching.length > 0}
		<div class="table-scroll">
			<table class="items">
				<thead><tr><th scope="col">Item</th><th scope="col">Kind</th><th scope="col">Shown as</th></tr></thead>
				<tbody>
					{#each matching.slice(0, mostRows) as item (item.id)}
						{@const level = itemLevel(draft, item)}
						{@const ofKind = kindLevel(draft, item.kind)}
						<tr>
							<td>{#if item.kind === 'opinions'}<i>{item.title}</i>{#if item.citation}, {item.citation}{/if}{:else}{item.title}{/if}</td>
							<td>{restrictionItemKindLabels[item.kind]}</td>
							<td>
								<Dropdown
									label="Shown as: {item.title}"
									hideLabel
									choices={allowedLevels[item.kind].map((option) => ({ value: option, label: restrictionLevelLabels[option] }))}
									value={level}
									disabled={!data.canChange}
									onchange={(option) => setItem(item, option)}
								/>
								{#if level !== ofKind}<span class="apart">Kind: {restrictionLevelLabels[ofKind]}</span>{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
	<p class="small muted">
		{matching.length > mostRows ? `The first ${mostRows} of ${matching.length.toLocaleString('en-US')} matching items; Find narrows the list.` : `${matching.length.toLocaleString('en-US')} of ${data.items.length.toLocaleString('en-US')} items.`} Items added later follow their kind.
	</p>

	{#if data.canChange}
		{#if lines.length > 0}
			<div class="notice" role="status">
				<p><strong>Saving will</strong></p>
				<ul>
					{#each lines as line, index (index)}
						<li>{line.before}{#if line.name}{#if line.caseName}<i>{line.name}</i>{:else}{line.name}{/if}{/if}{line.after}{index === lines.length - 1 ? '.' : ';'}</li>
					{/each}
				</ul>
				<p class="small">Downloads and offline copies follow at once. Search and data sets follow at a later site update. Books already printed cannot change; the next edition follows.</p>
			</div>
		{/if}
		<div class="field note">
			<label for="note">Note to the project <span class="muted">(optional; only the project sees it)</span></label>
			<textarea id="note" name="note"></textarea>
		</div>
		<div class="actions">
			<button class="button" type="submit" disabled={changes.length === 0}>Save</button>
			<button class="button button-quiet" type="button" onclick={reset} disabled={changes.length === 0}>Cancel</button>
		</div>
	{/if}
</form>

{#snippet changeText(change: RestrictionChange)}{#if change.caseName}<i>{change.label}</i>{:else}{change.label}{/if}{describeRestrictionChange(change).slice(change.label.length)}.{/snippet}

<h2>Recent activity</h2>
{#if data.activity.length > 0}
	<ul class="log small">
		{#each data.activity as entry (entry.identifier)}
			<li>
				<span class="muted">{when(entry.madeAt)}</span><br />
				{entry.madeByName ?? 'Someone'}:{#each entry.changes as change, index (index)}{' '}{@render changeText(change)}{/each}
			</li>
		{/each}
	</ul>
{:else}
	<p class="small muted">Nothing has been changed yet. The site shows everything in full.</p>
{/if}
<p class="small muted">This log cannot be changed or deleted, by anyone.</p>

<style>
	.page-links {
		margin: 0 0 var(--space-2);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		margin: var(--space-3) 0;
	}

	th {
		text-align: left;
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		background: var(--color-surface);
		padding: var(--space-2) var(--space-3);
	}

	td {
		padding: var(--space-3);
		border-bottom: 1px solid var(--color-line);
		vertical-align: top;
	}

	.levels {
		display: inline-flex;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		overflow: hidden;
	}

	.levels button {
		font: inherit;
		font-size: var(--font-size-small);
		padding: 6px 14px;
		border: 0;
		border-right: 1px solid var(--color-control-border);
		background: transparent;
		color: var(--color-ink);
		cursor: pointer;
		white-space: nowrap;
	}

	.levels button:last-child {
		border-right: 0;
	}

	.levels button[aria-checked='true'] {
		background: var(--color-link);
		color: var(--color-paper);
		font-weight: var(--font-weight-semibold);
	}

	.levels button:disabled {
		cursor: default;
	}

	.always {
		display: inline-flex;
		gap: 6px;
		align-items: center;
	}

	.level-meanings {
		margin: 0 0 var(--space-5);
		padding: 0;
		list-style: none;
		max-width: var(--layout-measure);
	}

	.level-meanings li {
		margin: 0 0 var(--space-1);
	}

	.tools {
		display: flex;
		gap: var(--space-3);
		align-items: end;
		flex-wrap: wrap;
		margin: var(--space-3) 0;
	}

	.tools .field {
		margin: 0;
	}

	.tools input[type='search'] {
		min-width: 280px;
	}

	.apart {
		font-size: 12px;
		font-weight: var(--font-weight-semibold);
		border: 1px solid var(--color-line);
		border-radius: 999px;
		padding: 1px 8px;
		margin-left: 6px;
		color: var(--color-link);
		white-space: nowrap;
	}

	.note textarea {
		width: 100%;
		max-width: 640px;
		min-height: 64px;
		font: inherit;
		padding: 8px;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink);
	}

	.actions {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
		margin-top: var(--space-3);
	}

	.log {
		list-style: none;
		padding: 0;
		margin: var(--space-2) 0;
	}

	.log li {
		margin: 0 0 var(--space-3);
	}

	@media (max-width: 700px) {
		.kinds thead {
			display: none;
		}

		.kinds tr {
			display: block;
			border-bottom: 1px solid var(--color-line);
			padding: var(--space-2) 0;
		}

		.kinds td {
			display: block;
			border: 0;
			padding: var(--space-1) 0;
		}

		.tools input[type='search'] {
			min-width: 0;
			width: 100%;
		}

		.tools .field {
			width: 100%;
		}

		.items td:nth-child(2),
		.items th:nth-child(2) {
			display: none;
		}
	}
</style>
