<script lang="ts">
	// Recent changes, like a wiki's (site/COLLABORATION.md, "Recent changes"),
	// and, with ?page=, one page's history. The filters are a plain form, so
	// they work without scripts.
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Lock from '@lucide/svelte/icons/lock';
	import Rss from '@lucide/svelte/icons/rss';
	import { dateTime, dayHeading, pacificDay, timeOfDay } from '#lib/change-dates.ts';
	import {
		byDay,
		byPage,
		changeKindLabels,
		changeKinds,
		dayChoices,
		filterQuery,
		largeChange,
		limitChoices,
		pageKindFilterLabels,
		pageKindLabels,
		pageKinds,
		sizeChangeText,
		siteReleaseName,
		sizeChoices,
		wordingIsShown,
		type ChangeView
	} from '#lib/page-history.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const filters = $derived(data.filters);
	const history = $derived(Boolean(filters.page));
	const historyKind = $derived(data.pageKind ?? data.changes[0]?.kind);
	const historyName = $derived(data.pageTitle ? `“${data.pageTitle}”` : (filters.page ?? ''));
	const historyShowsWording = $derived(historyKind ? wordingIsShown(historyKind) : true);
	const days = $derived(byDay(data.changes, pacificDay));
	const feedLink = $derived(`/changes/feed.xml${filterQuery(filters)}`);

	const dayLabels: Record<number, string> = {
		1: 'Last day',
		7: 'Last 7 days',
		30: 'Last 30 days',
		90: 'Last 90 days',
		365: 'Last year',
		0: 'Any time'
	};

	function sizeLabel(size: number): string {
		return size === 0 ? 'Any size' : `At least ${size.toLocaleString('en-US')} bytes`;
	}

	/** Changes to one page in a day are gathered; so are the pages one bulk update touched. */
	function groupsOf(items: ChangeView[]) {
		if (!filters.group) return items.map((item) => ({ key: item.id, items: [item] }));
		const bulk = new Map<string, ChangeView[]>();
		const rest: ChangeView[] = [];
		for (const item of items) {
			if (item.bulk) {
				const key = `${item.summary ?? ''}`;
				bulk.set(key, [...(bulk.get(key) ?? []), item]);
			} else rest.push(item);
		}
		const groups = byPage(rest).map((group) => ({ key: group.address, items: group.items }));
		for (const [summary, gathered] of bulk) {
			if (gathered.length === 1) groups.push({ key: gathered[0].id, items: gathered });
			else groups.push({ key: `bulk:${summary}`, items: gathered });
		}
		return groups.sort((first, second) => second.items[0].madeAt.localeCompare(first.items[0].madeAt));
	}

	function whoLink(change: ChangeView): string {
		return `/changes${filterQuery(filters, { who: change.whoKey, page: undefined })}`;
	}

	function historyLink(address: string): string {
		return `/changes?page=${encodeURIComponent(address)}`;
	}

	function totalSize(items: ChangeView[]): number | undefined {
		const sizes = items.map((item) => item.sizeChange).filter((size): size is number => size !== undefined);
		return sizes.length > 0 ? sizes.reduce((sum, size) => sum + size, 0) : undefined;
	}

	let fromChoice = $state<string | undefined>(undefined);
	let toChoice = $state<string | undefined>(undefined);
	const comparable = $derived(data.changes.filter((change) => change.comparable));
	$effect(() => {
		fromChoice = comparable[1]?.id;
		toChoice = comparable[0]?.id;
	});
</script>

<svelte:head>
	<title>{history ? `History of ${data.pageTitle ?? filters.page}` : 'Recent changes'} · Model Tribal ADR Code</title>
	<link rel="alternate" type="application/atom+xml" title="Recent changes" href={feedLink} />
	{#if history}<meta name="robots" content="noindex" />{/if}
</svelte:head>

{#snippet size(change: ChangeView)}
	{#if change.sizeChange !== undefined}
		<span
			class="size"
			class:up={change.sizeChange > 0}
			class:down={change.sizeChange < 0}
			class:large={Math.abs(change.sizeChange) >= largeChange}
			title="{change.size !== undefined ? `${change.size.toLocaleString('en-US')} bytes after the change` : 'Change in size'}"
			>{sizeChangeText(change.sizeChange)}<span class="visually-hidden"> bytes</span></span
		>
	{/if}
{/snippet}

{#snippet hiddenTag(change: ChangeView)}
	{#if change.hiddenReason}
		<span class="tag"><EyeOff size={13} aria-hidden="true" />{change.hiddenReason}</span>
	{/if}
{/snippet}

{#snippet about(change: ChangeView)}
	{#if change.change === 'removed'}<span class="tag">Page removed</span>{/if}
	{#if change.whoHidden}<span class="hidden-part">name hidden</span>{:else}<a class="who" href={whoLink(change)}>{change.who}</a>{/if}
	{#if change.parts && change.parts.length > 0}
		<span class="summary">Changed: {change.parts.join(', ')}.</span>
	{/if}
	{#if change.summaryHidden}
		<span class="hidden-part">summary hidden</span>
	{:else if change.summary}
		<span class="summary">{change.summary}</span>
	{/if}
	{@render hiddenTag(change)}
{/snippet}

{#snippet tools(change: ChangeView)}
	{#if change.comparable}
		<a href="/changes/{change.id}">changes</a>
	{:else if !wordingIsShown(change.kind) && !change.textHidden}
		<a href="/changes/{change.id}" title="Which parts changed; earlier wording is not shown"
			><Lock size={13} aria-hidden="true" />what changed</a
		>
	{:else if change.textHidden}
		<span class="hidden-part">changes</span>
	{:else}
		<a href="/changes/{change.id}">changes</a>
	{/if}
{/snippet}

{#snippet pageName(change: ChangeView)}
	{#if change.title && change.change !== 'removed'}
		<a class="page" href={change.address}>{change.title}</a>
	{:else if change.title}
		<span class="page">{change.title}</span>
	{:else}
		<span class="page muted">A page no longer on this site</span>
	{/if}
	<span class="kind">{pageKindLabels[change.kind]}</span>
	{#if change.change === 'new'}<span class="tag new">New page</span>{/if}
	{#if change.bulk}<span class="tag bulk">Bulk update</span>{/if}
{/snippet}

{#if history}
	<nav aria-label="Breadcrumb" class="small">
		<a href="/changes">Recent changes</a> › History
	</nav>
	<h1>History of {historyName}</h1>
	<!-- Says plainly that the list is one page's, with the way back to every page's (Trevor, Nov. 23, 2026). -->
	<p class="showing">
		Showing changes to {#if data.pageOnSite && filters.page}<a href={filters.page}>{historyName}</a>{:else}{historyName}{/if} only
		· <a href="/changes">Show all changes</a>
	</p>
	{#if !historyShowsWording}
		<p class="notice">
			<Lock size={16} aria-hidden="true" />
			This page lists when the page changed, who changed it and which parts. Only the current page is shown on this site.
		</p>
	{:else}
		<p class="lede">Every version readers have seen. Choose two to compare, or open one to read it as it stood.</p>
	{/if}

	{#if data.changes.length === 0 && !data.recordedSince}
		<p>No changes to this page have been recorded. Changes are recorded from Nov. 23, 2026 on.</p>
	{:else}
		<form method="get" action="/changes/compare" class="history-form">
			{#if historyShowsWording && comparable.length > 1}
				<p><button type="submit" class="button">Compare the two chosen versions</button></p>
			{/if}
			<div class="table-scroll">
				<table class="history">
					<thead>
						<tr>
							{#if historyShowsWording}<th scope="col"><span class="visually-hidden">Compare from, to</span>Compare</th>{/if}
							<th scope="col">When</th>
							<th scope="col">Who</th>
							{#if historyShowsWording}<th scope="col">Size</th>{:else}<th scope="col">Parts changed</th>{/if}
							<th scope="col">Summary</th>
							<th scope="col"><span class="visually-hidden">Links</span></th>
						</tr>
					</thead>
					<tbody>
						{#each data.changes as change, index (change.id)}
							<tr class:struck={change.textHidden}>
								{#if historyShowsWording}
									<td class="radios">
										{#if change.comparable}
											<input
												type="radio"
												name="from"
												value={change.id}
												bind:group={fromChoice}
												aria-label="Compare from {dateTime(change.madeAt)}"
											/>
											<input
												type="radio"
												name="to"
												value={change.id}
												bind:group={toChoice}
												aria-label="Compare to {dateTime(change.madeAt)}"
											/>
										{/if}
									</td>
								{/if}
								<td><time datetime={change.madeAt}>{dateTime(change.madeAt)}</time>{#if index === 0 && change.change !== 'removed'} <span class="tag new">Current</span>{/if}</td>
								<td>{#if change.whoHidden}<span class="hidden-part">name hidden</span>{:else}{change.who}{/if}</td>
								{#if historyShowsWording}
									<td class="numbers">
										{#if change.textHidden}<span class="hidden-part">size hidden</span>{:else}{change.size?.toLocaleString('en-US') ?? ''} {@render size(change)}{/if}
									</td>
								{:else}
									<td>
										{#if change.textHidden}<span class="hidden-part">parts hidden</span>
										{:else if change.change === 'new'}New page
										{:else if change.change === 'removed'}Page removed
										{:else}{change.parts?.join(', ')}{/if}
									</td>
								{/if}
								<td>
									{#if change.summaryHidden}<span class="hidden-part">summary hidden</span>{:else if change.summary}<span class="summary">{change.summary}</span>{/if}
									{@render hiddenTag(change)}
								</td>
								<td class="links">
									{#if change.comparable}
										<a href="/changes/{change.id}/version">read</a> · <a href="/changes/{change.id}">changes</a>
									{/if}
								</td>
							</tr>
						{/each}
						{#if data.changes.length === 0 && data.recordedSince}
							<!-- A page that has not changed since the history began: the one version readers have seen. -->
							<tr>
								{#if historyShowsWording}<td class="radios"></td>{/if}
								<td><time datetime={data.recordedSince}>{dateTime(data.recordedSince)}</time> <span class="tag new">Current</span></td>
								<td>{siteReleaseName}</td>
								<td>{#if !historyShowsWording}No changes yet{/if}</td>
								<td><span class="summary">The page as it stood when the site began keeping its history. It has not changed since.</span></td>
								<td class="links">{#if data.pageOnSite && filters.page}<a href={filters.page}>read</a>{/if}</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
		</form>
	{/if}
	<p class="small muted">
		The history begins on Nov. 23, 2026, when the site began recording changes.
		{#if historyShowsWording}Versions saved while writing, before they were published, are kept in the workspace and are not listed here.{/if}
	</p>
{:else}
	<h1>Recent changes</h1>

	<form method="get" class="filters" aria-label="Filter changes">
		<div class="fields">
			<div class="field">
				<label for="changes-kind">Kind of page</label>
				<select id="changes-kind" name="kind">
					<option value="">All kinds</option>
					{#each pageKinds as kind (kind)}
						<option value={kind} selected={filters.kinds.length === 1 && filters.kinds[0] === kind}>{pageKindFilterLabels[kind]}</option>
					{/each}
				</select>
			</div>
			<div class="field">
				<label for="changes-who">Who</label>
				<select id="changes-who" name="who">
					<option value="">Anyone</option>
					{#each data.people as person (person.key)}
						<option value={person.key} selected={filters.who === person.key}>{person.name}</option>
					{/each}
				</select>
			</div>
			<div class="field">
				<label for="changes-days">Dates</label>
				<select id="changes-days" name="days">
					{#each dayChoices as choice (choice)}
						<option value={choice} selected={filters.days === choice}>{dayLabels[choice]}</option>
					{/each}
				</select>
			</div>
			<div class="field">
				<label for="changes-size">Size of change</label>
				<select id="changes-size" name="size">
					{#each sizeChoices as choice (choice)}
						<option value={choice} selected={filters.size === choice}>{sizeLabel(choice)}</option>
					{/each}
				</select>
			</div>
			<div class="field">
				<label for="changes-limit">Show</label>
				<select id="changes-limit" name="limit">
					{#each limitChoices as choice (choice)}
						<option value={choice} selected={filters.limit === choice}>{choice} changes</option>
					{/each}
				</select>
			</div>
		</div>
		<fieldset class="choices">
			<legend>Kinds of change</legend>
			{#each changeKinds as kind (kind)}
				<label class="chip"><input type="checkbox" name="change" value={kind} checked={filters.changes.includes(kind)} />{changeKindLabels[kind]}</label>
			{/each}
		</fieldset>
		<div class="toggles">
			<input type="hidden" name="group" value="0" />
			<label><input type="checkbox" name="group" value="1" checked={filters.group} /> Group changes by page</label>
			<label><input type="checkbox" name="bulk" value="1" checked={filters.showBulk} /> Show bulk updates</label>
			<button type="submit" class="button">Show changes</button>
			<a href="/changes" class="small">Reset filters</a>
		</div>
	</form>

	<p class="count small muted">
		{#if data.changes.length === 0}No changes match.{:else}{data.more ? `The newest ${data.changes.length}` : data.changes.length}
			{data.changes.length === 1 ? 'change' : 'changes'}{filters.days ? ` in the ${dayLabels[filters.days].toLowerCase()}` : ''}.{/if}
		<a href={feedLink} class="feed"><Rss size={14} aria-hidden="true" />Feed of these changes</a>
	</p>

	{#each days as day (day.day)}
		<h2 class="day">{dayHeading(day.day)}</h2>
		<ul class="changes">
			{#each groupsOf(day.items) as group (group.key)}
				{@const first = group.items[0]}
				{#if group.items.length === 1}
					<li class="change" class:struck={first.textHidden}>
						<time datetime={first.madeAt}>{timeOfDay(first.madeAt)}</time>
						<span class="tools">{@render tools(first)} · <a href={historyLink(first.address)}>history</a></span>
						<span class="line">{@render pageName(first)} {@render size(first)} {@render about(first)}</span>
					</li>
				{:else if group.key.startsWith('bulk:')}
					<li class="change group">
						<details>
							<summary>
								<time datetime={first.madeAt}>{timeOfDay(first.madeAt)}</time>
								<span class="tools"><ChevronRight class="opener" size={14} aria-hidden="true" />{group.items.length} pages</span>
								<span class="line"
									><span class="tag bulk">Bulk update</span> <span class="who">{first.who ?? ''}</span>
									<span class="summary">{first.summary ?? 'A change to many pages at once'}</span></span
								>
							</summary>
							<ul>
								{#each group.items as change (change.id)}
									<li class="change sub" class:struck={change.textHidden}>
										<time datetime={change.madeAt}>{timeOfDay(change.madeAt)}</time>
										<span class="tools">{@render tools(change)} · <a href={historyLink(change.address)}>history</a></span>
										<span class="line">{@render pageName(change)} {@render size(change)}{#if change.parts?.length} <span class="summary">Changed: {change.parts.join(', ')}.</span>{/if}</span>
									</li>
								{/each}
							</ul>
						</details>
					</li>
				{:else}
					{@const total = totalSize(group.items)}
					<li class="change group">
						<details>
							<summary>
								<time datetime={first.madeAt}>{timeOfDay(first.madeAt)}</time>
								<span class="tools"><ChevronRight class="opener" size={14} aria-hidden="true" /><a href={historyLink(first.address)}>history</a></span>
								<span class="line"
									>{@render pageName(first)}
									{#if total !== undefined}<span class="size" class:up={total > 0} class:down={total < 0}>{sizeChangeText(total)}<span class="visually-hidden"> bytes</span></span>{/if}
									<span class="summary">{group.items.length} changes that day</span></span
								>
							</summary>
							<ul>
								{#each group.items as change (change.id)}
									<li class="change sub" class:struck={change.textHidden}>
										<time datetime={change.madeAt}>{timeOfDay(change.madeAt)}</time>
										<span class="tools">{@render tools(change)}</span>
										<span class="line">{@render size(change)} {@render about(change)}</span>
									</li>
								{/each}
							</ul>
						</details>
					</li>
				{/if}
			{/each}
		</ul>
	{/each}

	{#if data.hiddenBulk > 0}
		<p class="small muted">
			{data.hiddenBulk.toLocaleString('en-US')} bulk {data.hiddenBulk === 1 ? 'update is' : 'updates are'} not shown: changes
			that touched many pages at once.
			<a href="/changes{filterQuery(filters, { showBulk: true })}">Show them</a>
		</p>
	{/if}
	{#if data.more}
		<p><a href="/changes{filterQuery(filters, { limit: Math.min(filters.limit * 2, 500) })}">Show more changes</a></p>
	{/if}
	<p class="small muted">
		Changes are listed from Nov. 23, 2026 on, plus every essay ever published. Times are Pacific time. Sizes are in bytes,
		about one for each letter.
	</p>
{/if}

<style>
	.lede {
		max-width: var(--layout-measure);
		color: var(--color-ink-muted);
	}

	.filters {
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		padding: var(--space-3) var(--space-4);
		background: var(--color-surface);
		margin-block: var(--space-4);
	}

	.fields {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		gap: var(--space-3);
	}

	.field label {
		display: block;
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-small);
	}

	.field select {
		width: 100%;
	}

	.choices {
		border: 0;
		padding: 0;
		margin: var(--space-3) 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.choices legend {
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-small);
		margin-bottom: var(--space-1);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		border: 1px solid var(--color-control-border);
		border-radius: 999px;
		padding: 0 var(--space-3);
		min-height: var(--layout-target-minimum);
		background: var(--color-paper);
	}

	.toggles {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-4);
		margin-top: var(--space-3);
	}

	.count {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		justify-content: space-between;
	}

	.feed {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.day {
		font-size: var(--font-size-body);
		border-bottom: 2px solid var(--color-line);
		padding-bottom: var(--space-1);
		margin-top: var(--space-5);
	}

	.changes,
	.changes ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.change,
	.change summary {
		display: grid;
		grid-template-columns: 5.5rem 8.5rem 1fr;
		gap: var(--space-2) var(--space-3);
		align-items: baseline;
	}

	.change {
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-line);
	}

	.change.group {
		display: block;
	}

	.change summary {
		cursor: pointer;
		list-style: none;
	}

	.change summary::-webkit-details-marker {
		display: none;
	}

	.change :global(.opener) {
		vertical-align: -2px;
		margin-right: 2px;
	}

	.change details[open] :global(.opener) {
		transform: rotate(90deg);
	}

	.changes {
		margin-bottom: var(--space-4);
	}

	.change.sub {
		padding-left: var(--space-4);
		background: var(--color-surface);
	}

	.change time {
		color: var(--color-ink-muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.tools {
		font-size: var(--font-size-small);
		white-space: nowrap;
	}

	.tools a {
		display: inline-flex;
		align-items: center;
		gap: 2px;
	}

	.page {
		font-weight: var(--font-weight-bold);
	}

	.kind {
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-inline: var(--space-1);
	}

	.size {
		display: inline-block;
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-bold);
		font-variant-numeric: tabular-nums;
		padding: 0 var(--space-1);
		border-radius: var(--radius-control);
		margin-inline: var(--space-1);
	}

	.size.up {
		background: var(--color-added-background);
	}

	.size.down {
		background: var(--color-removed-background);
	}

	.size.large {
		outline: 2px solid currentColor;
	}

	.summary {
		color: var(--color-ink-muted);
		font-style: italic;
	}

	.tag {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		font-style: normal;
		padding: 0 var(--space-2);
		border-radius: 999px;
		border: 1px solid var(--color-line);
		color: var(--color-ink-muted);
		margin-inline: var(--space-1);
	}

	.tag.new {
		background: var(--color-added-background);
		color: var(--color-ink);
	}

	.tag.bulk {
		background: var(--color-surface);
	}

	.hidden-part {
		color: var(--color-ink-muted);
		text-decoration: line-through;
	}

	.showing {
		margin-block-start: 0;
	}

	.notice {
		background: var(--color-notice-background);
		border-radius: var(--radius-panel);
		padding: var(--space-3) var(--space-4);
		max-width: var(--layout-measure);
	}

	.history td {
		vertical-align: top;
	}

	.history .radios {
		white-space: nowrap;
	}

	.history .numbers {
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.history .links {
		white-space: nowrap;
	}

	/* Links break anywhere elsewhere on the site; here a short word such as "read" stays whole. */
	.history .links a {
		overflow-wrap: normal;
		word-break: normal;
	}

	@media (max-width: 40rem) {
		.change,
		.change summary {
			grid-template-columns: 1fr;
			gap: 0;
		}

		.change .line {
			order: -1;
		}
	}
</style>
