<script lang="ts">
	// A nation's team: a table of who is on it, a short "Add a person" form under
	// it, and the team's sealed activity log beside it (design/nation-editors,
	// screen 4, approved by Trevor on Nov. 23, 2026).
	import { tick } from 'svelte';
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import { keepPlaced } from '#lib/popover-place.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import {
		atLeastTeamLevel,
		describeParts,
		pagePartLabels,
		pageParts,
		teamLevelLabels,
		teamLevels,
		type PagePart,
		type TeamLevel
	} from '#lib/nation-teams.ts';
	import type { PageProps } from './$types';
	import DateField from '#lib/components/DateField.svelte';
	import { readableDate } from '#lib/readable-date.ts';

	let { data, form }: PageProps = $props();

	type Place = PageProps['data']['team'][number];

	/** Each level and what it may do, as the level list and the legend under the form say it. */
	const levelSummaries: Record<TeamLevel, string> = {
		steward: 'adds people, publishes',
		editor: 'publishes changes',
		drafter: 'writes, an editor publishes',
		reviewer: 'reads and comments'
	};

	// Only the levels and parts this person may give are offered; the server checks again.
	const givableLevels = $derived(
		teamLevels.filter((level) => data.isAdministrator || (data.own.level && atLeastTeamLevel(data.own.level, level)))
	);
	const givableParts = $derived(data.own.parts === null ? pageParts : pageParts.filter((part) => data.own.parts?.includes(part)));
	const wholePageAllowed = $derived(data.isAdministrator || data.own.parts === null);

	let email = $state('');
	let name = $state('');
	let office = $state('');
	let level = $state<TeamLevel>('editor');
	let scope = $state<string>('whole');
	let ticked = $state<PagePart[]>([]);
	let until = $state<string>('');
	let otherDate = $state('');
	let changing = $state<Place | null>(null);
	let emailField: HTMLInputElement | undefined = $state();

	// A new level offers its usual term, unless the person picked another date.
	const untilChoice = $derived(until || data.usualEnds[level]);
	const levelChoices = $derived(givableLevels.map((option) => ({ value: option, label: `${teamLevelLabels[option]}: ${levelSummaries[option]}` })));
	const scopeChoices = $derived([
		...(wholePageAllowed ? [{ value: 'whole', label: 'All of the page' }] : []),
		...givableParts.map((part) => ({ value: `part:${part}`, label: partName(part) })),
		...(givableParts.length > 1 ? [{ value: 'parts', label: 'Some parts…' }] : [])
	]);
	const untilChoices = $derived([...data.terms.map((term) => ({ value: term.end, label: `${term.label} (${month(term.end)})` })), { value: 'other', label: 'Another date' }]);

	function partName(part: PagePart): string {
		return pagePartLabels[part].replace(/ \(.*\)$/, '');
	}

	function the(title: string): string {
		return /^the\s/i.test(title) ? title : `the ${title}`;
	}

	function month(value: string | null): string {
		return value ? readableDate(value.slice(0, 7)) : '';
	}

	function when(value: string): string {
		return `${readableDate(value.slice(0, 10))}, ${new Date(value).toLocaleTimeString('en-US', { timeStyle: 'short' })}`;
	}

	function partsCell(parts: readonly PagePart[] | null): string {
		return parts === null || parts.length === pageParts.length ? 'All' : parts.map(partName).join(', ');
	}

	/** Fills the form with a person's place, to change it. Saving replaces the place. */
	async function change(place: Place): Promise<void> {
		changing = place;
		email = place.personEmail;
		name = place.personName;
		office = place.office ?? '';
		level = givableLevels.includes(place.level) ? place.level : givableLevels[0];
		if (place.parts === null) scope = 'whole';
		else if (place.parts.length === 1) scope = `part:${place.parts[0]}`;
		else {
			scope = 'parts';
			ticked = [...place.parts];
		}
		until = 'other';
		otherDate = place.expiresAt.slice(0, 10);
		await tick();
		document.getElementById('add-heading')?.scrollIntoView({ block: 'start' });
		emailField?.focus();
	}

	const teamColumns: TableColumn[] = [
		{ key: 'person', header: 'Person', isRowHeader: true, sortable: true, searchable: true, custom: true },
		{ key: 'level', header: 'Level', sortable: true, filterable: true, custom: true },
		{ key: 'parts', header: 'Parts', sortable: true },
		{ key: 'until', header: 'Until', type: 'date', sortable: true },
		{ key: 'added', header: 'Added by', sortable: true },
		{ key: 'change', header: 'Change', custom: true, hiddenHeader: true, keepOutOfDownload: true }
	];
	const teamRows: TableRow[] = $derived(
		data.team.map((place) => ({
			key: place.identifier,
			cells: {
				person: { text: [place.personName, place.office ?? '', place.personStatus === 'invited' ? 'Has not signed in yet' : ''].filter(Boolean).join(', ') },
				level: { text: teamLevelLabels[place.level], sortValue: teamLevels.indexOf(place.level) },
				parts: { text: partsCell(place.parts) },
				until: { text: month(place.expiresAt), sortValue: place.expiresAt },
				added: { text: place.addedByProject ? 'The project, after the nation confirmed' : (place.grantedByName ?? '') },
				change: { text: '' }
			}
		}))
	);
	const places = $derived(new Map(data.team.map((place) => [place.identifier, place])));

	// The open row menu, kept under its Change button as the page scrolls.
	let openMenu = $state.raw<{ popover: HTMLElement; anchor: HTMLElement } | undefined>();
	function onMenuToggle(event: Event): void {
		const popover = event.currentTarget as HTMLElement;
		if ((event as ToggleEvent).newState === 'open') {
			const anchor = document.querySelector<HTMLElement>(`[popovertarget="${popover.id}"]`);
			if (anchor) openMenu = { popover, anchor };
		} else if (openMenu?.popover === popover) {
			openMenu = undefined;
		}
	}
	$effect(() => {
		if (openMenu) return keepPlaced(openMenu.popover, openMenu.anchor, 'right', [document.body]);
	});

	function cancelChange(): void {
		changing = null;
		email = name = office = '';
		level = 'editor';
		scope = 'whole';
		ticked = [];
		until = '';
	}
</script>

{#snippet teamCell(place: Place, key: string)}
	{@const own = place.personIdentifier === data.own.personIdentifier}
	{@const canChange = !own && (data.isAdministrator || (data.canManage && !place.addedByProject))}
	{#if key === 'person'}
		<strong>{place.personName}</strong>
		{#if place.office}<br /><span class="small muted">{place.office}</span>{/if}
		{#if place.personStatus === 'invited'}<br /><span class="small muted">Has not signed in yet</span>{/if}
	{:else if key === 'level'}
		<span class="level level-{place.level}">{teamLevelLabels[place.level]}</span>
	{:else if own}
		<div class="actions">
			<form method="post" action="?/end">
				<input type="hidden" name="place" value={place.identifier} />
				<button class="button button-quiet small-button" type="submit">Leave</button>
			</form>
		</div>
	{:else if canChange || data.isAdministrator}
		<!-- A popover, so the table's scrolling box does not cut the menu off. -->
		<div class="actions">
			<button class="button button-quiet small-button" type="button" popovertarget="change-{place.identifier}">
				Change<span class="visually-hidden"> {place.personName}’s place</span>
			</button>
		</div>
		<div id="change-{place.identifier}" class="table-popover row-menu-panel" popover="auto" ontoggle={(event) => onMenuToggle(event)}>
			{#if canChange && data.canManage}
				<button class="link-button needs-scripts" type="button" onclick={(event) => { (event.currentTarget as HTMLElement).closest<HTMLElement>('[popover]')?.hidePopover(); void change(place); }}>Change level, parts or date</button>
			{/if}
			{#if canChange}
				<form method="post" action="?/end">
					<input type="hidden" name="place" value={place.identifier} />
					<button class="link-button danger" type="submit">End {place.personName}’s place</button>
				</form>
			{/if}
			{#if data.isAdministrator}
				<form method="post" action="?/suspend">
					<input type="hidden" name="place" value={place.identifier} />
					<button class="link-button danger" type="submit">Suspend {place.personName} and everyone they added</button>
				</form>
			{/if}
		</div>
	{/if}
{/snippet}

<svelte:head>
	<title>{data.nation.title}’s team · Workspace · Model Tribal ADR Code</title>
</svelte:head>

{#if data.isAdministrator}
	<Breadcrumbs
		trail={[
			{ label: 'Workspace', href: '/workspace' },
			{ label: 'Nation teams', href: '/workspace/nation-teams' }
		]}
	/>
{/if}
<!-- The title comes right after the breadcrumbs, which pull it up to meet them
	(Breadcrumbs.svelte), so the page links go under the title, as on other
	pages with a trail. -->
<h1>{the(data.nation.title).replace(/^the /, 'The ')}’s team</h1>
<p class="small page-links">
	<a href="/workspace/nation-teams/{data.nation.identifier}/edit">Edit the page</a> ·
	<a href="/workspace/nation-teams/{data.nation.identifier}/changes">Changes and history</a> ·
	<a href="/workspace/nation-teams/{data.nation.identifier}/laws-and-cases">Laws and cases</a>
	{#if data.nation.page}· <a href={data.nation.page}>View the page</a>{/if}
</p>
<p class="lede">
	{#if data.isAdministrator}
		As the lead author you can add, change and end any place on this team, and suspend a person together with everyone they added.
	{:else if data.canManage}
		You are a steward for {the(data.nation.title)}, so you can add and remove people for this nation’s page. You can give anyone up to your own level. You cannot give access to any other nation.
	{:else}
		You are {teamLevelLabels[data.own.level ?? 'reviewer'].toLocaleLowerCase('en-US')} for {the(data.nation.title)}, for {describeParts(data.own.parts)}. A steward of the team adds and removes people.
	{/if}
</p>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

<div class="columns">
	<div class="team">
		<h2 class="visually-hidden" id="team-heading">Who is on the team</h2>
		{#if data.team.length === 0}
			<p class="muted">Nobody yet.</p>
		{:else}
			<DataTable
				identifier="team"
				label="Table: who is on the team"
				columns={teamColumns}
				rows={teamRows}
				rowName={['person', 'people']}
				download="{data.nation.identifier}-team"
			>
				{#snippet cell(row, column)}
					{@const place = places.get(row.key)}
					{#if place}
						{@render teamCell(place, column.key)}
					{/if}
				{/snippet}
			</DataTable>
		{/if}

		{#if data.canManage}
			<form method="post" action="?/add" class="panel add" aria-labelledby="add-heading">
				<h2 id="add-heading">{changing ? `Change ${changing.personName}’s place` : 'Add a person'}</h2>
				<div class="add-grid">
					<div class="field">
						<label for="email">Their email</label>
						<input bind:this={emailField} type="email" id="email" name="email" autocomplete="off" required bind:value={email} readonly={Boolean(changing)} />
					</div>
					<div class="field">
						<label for="name">Their name</label>
						<input type="text" id="name" name="name" autocomplete="off" required bind:value={name} />
					</div>
					<div class="field">
						<Dropdown label="Level" id="level" name="level" choices={levelChoices} bind:value={level} />
					</div>
					<div class="field">
						<Dropdown label="Parts of the page" id="scope" name="scope" choices={scopeChoices} bind:value={scope} />
					</div>
					{#if scope === 'parts'}
						<fieldset class="field wide">
							<legend>Which parts</legend>
							<div class="ticks">
								{#each givableParts as part (part)}
									<label class="tick"><input type="checkbox" name="parts" value={part} bind:group={ticked} /> {partName(part)}</label>
								{/each}
							</div>
						</fieldset>
					{/if}
					<div class="field">
						<!-- With "Another date", the date field below sends the end instead. -->
						<Dropdown
							label="Until"
							id="until"
							name={untilChoice === 'other' ? undefined : 'expires'}
							choices={untilChoices}
							value={untilChoice}
							onchange={(chosen) => (until = chosen)}
						/>
					</div>
					<div class="field">
						<label for="office">Their title or office <span class="muted">(optional)</span></label>
						<input type="text" id="office" name="office" autocomplete="off" bind:value={office} />
					</div>
					{#if untilChoice === 'other'}
						<div class="field">
							<label for="expires">Their place ends on</label>
							<DateField id="expires" name="expires" required bind:value={otherDate} max={data.latestEnd} hint="Two years at most; it can be renewed." />
						</div>
					{/if}
				</div>
				<p class="hint legend">
					Levels: {#each givableLevels.toReversed() as option, index (option)}{index > 0 ? ', ' : ''}{teamLevelLabels[option]} ({levelSummaries[option]}){/each}. The nation’s office is told about every person added.
				</p>
				<div class="button-row">
					<button class="button" type="submit">{changing ? 'Save the change' : 'Add to the team'}</button>
					{#if changing}<button class="button button-quiet" type="button" onclick={cancelChange}>Cancel</button>{/if}
				</div>
			</form>
		{/if}
	</div>

	<aside class="panel activity" aria-labelledby="activity-heading">
		<h2 id="activity-heading">Recent activity</h2>
		{#if data.activity.length === 0}
			<p class="small">Nothing yet.</p>
		{:else}
			<ul class="log">
				{#each data.activity.slice(0, 50) as entry (entry.identifier)}
					<li>
						<time class="small muted" datetime={entry.createdAt}>{when(entry.createdAt)}</time>
						{entry.personName ?? 'From the website'}: {entry.action}{#if entry.note}. <span class="small">{entry.note}</span>{/if}
					</li>
				{/each}
			</ul>
		{/if}
		<p class="hint">This log can’t be edited or deleted, by anyone.</p>
	</aside>
</div>

<style>
	.lede {
		color: var(--color-ink-muted);
	}

	.columns {
		display: grid;
		gap: var(--space-5) var(--space-6);
		margin-top: var(--space-5);
	}

	@media (min-width: 60rem) {
		.columns {
			grid-template-columns: minmax(0, 1fr) minmax(16rem, 21rem);
			align-items: start;
		}
	}

	.team {
		min-width: 0;
	}

	.level {
		display: inline-block;
		padding: 0 var(--space-2);
		border: 1px solid var(--color-line);
		border-radius: 999px;
		background: var(--color-surface);
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		white-space: nowrap;
	}

	.level-steward {
		border-color: var(--color-link);
		background: var(--color-notice-background);
		color: var(--color-link);
	}

	.level-editor {
		background: var(--color-added-background);
		color: var(--color-ink);
	}

	.actions {
		text-align: end;
	}

	.actions form {
		margin: 0;
	}

	.small-button {
		min-height: auto;
		padding: var(--space-1) var(--space-3);
		font-size: var(--font-size-small);
		border-color: var(--color-link);
		color: var(--color-link);
		white-space: nowrap;
	}

	/* The row menu: a popover (global.css, .table-popover), its choices one under another. */
	.row-menu-panel:popover-open {
		display: grid;
		gap: var(--space-2);
		max-width: min(20rem, calc(100vw - 2 * var(--space-4)));
		font-size: inherit;
	}

	.link-button {
		padding: 0;
		border: 0;
		background: none;
		color: var(--color-link);
		font: inherit;
		text-align: start;
		text-decoration: underline;
		cursor: pointer;
	}

	.danger {
		color: var(--color-danger);
	}

	.add {
		background: var(--color-surface-raised);
	}

	.add h2,
	.activity h2 {
		font-size: var(--font-size-large);
	}

	.add-grid {
		display: grid;
		gap: 0 var(--space-4);
	}

	@media (min-width: 40rem) {
		.add-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.add-grid .field {
		margin-bottom: var(--space-3);
	}

	.add-grid :global(:is(input[type='text'], input[type='email'], select)) {
		width: 100%;
		max-width: none;
	}

	.add-grid :global(.dropdown) {
		margin: 0;
	}

	.add-grid :global(.dropdown-control) {
		width: 100%;
	}

	.wide {
		grid-column: 1 / -1;
		border: 0;
		padding: 0;
	}

	.ticks {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
	}

	.tick {
		display: inline-flex;
		gap: var(--space-2);
		align-items: center;
	}

	.legend {
		margin-top: var(--space-1);
	}

	.button-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}

	.activity {
		margin: 0;
		background: var(--color-surface-raised);
	}

	.log {
		margin: 0 0 var(--space-3);
		padding: 0;
		list-style: none;
	}

	.log li {
		margin-bottom: var(--space-3);
		font-size: var(--font-size-small);
	}

	.log time {
		display: block;
	}
</style>
