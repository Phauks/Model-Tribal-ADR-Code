<script lang="ts">
	// Recent changes, like a wiki's (site/COLLABORATION.md, "Recent changes"),
	// and, with ?page=, one page's history. The filters are a plain form: with
	// scripts each choice applies at once, as in the approved mockup
	// (design/recent-changes); without them a "Show changes" button sends it.
	import { onMount } from 'svelte';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import Check from '@lucide/svelte/icons/check';
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import PageHistory from '#lib/components/PageHistory.svelte';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Lock from '@lucide/svelte/icons/lock';
	import Rss from '@lucide/svelte/icons/rss';
	import Search from '@lucide/svelte/icons/search';
	import User from '@lucide/svelte/icons/user';
	import { dateTime, dayHeading, pacificDay, timeOfDay } from '#lib/change-dates.ts';
	import { essayDate } from '#lib/essays/dates.ts';
	import {
		byDay,
		byPage,
		changeKindLabels,
		changeKinds,
		dayChoices,
		defaultFilters,
		filterQuery,
		pageChangesLink,
		largeChange,
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
	const dayLabels: Record<number, string> = {
		1: 'Last day',
		7: 'Last 7 days',
		30: 'Last 30 days',
		90: 'Last 90 days',
		365: 'Last year',
		0: 'Any time'
	};

	// A feed reader is not signed in, so the feed leaves out "Only pages I follow".
	const feedLink = $derived(`/changes/feed.xml${filterQuery({ ...filters, following: false })}`);
	/** The dates the list covers, "Nov. 1 to Nov. 23, 2026", or nothing for any time. */
	const span = $derived.by(() => {
		if (!filters.days) return '';
		const end = data.listedAt;
		const start = new Date(new Date(end).getTime() - filters.days * 86_400_000).toISOString();
		const [startText, endText] = [essayDate(start), essayDate(end)];
		const year = endText.slice(-4);
		return `${startText.endsWith(year) ? startText.slice(0, -6) : startText} to ${endText}`;
	});

	/** The choices that narrow the list, for the phone's folded filters ("Filters · 3"). */
	const narrowing = $derived(
		[
			filters.title ? `“${filters.title}”` : '',
			...filters.kinds.map((kind) => pageKindFilterLabels[kind]),
			filters.who ? (data.people.find((person) => person.key === filters.who)?.name ?? 'One person') : '',
			filters.days ? dayLabels[filters.days] : '',
			filters.size ? sizeLabel(filters.size) : '',
			filters.changes.length < changeKinds.length ? filters.changes.map((kind) => changeKindLabels[kind]).join(', ') : '',
			filters.hidden ? 'Hidden changes' : '',
			filters.following ? 'Pages I follow' : '',
			filters.showBulk ? '' : 'Hide bulk'
		].filter(Boolean)
	);

	let scripted = $state(false);
	let filtersOpen = $state(true);
	onMount(() => {
		scripted = true;
		// On a phone the filters fold behind one button; on wider screens they stay open.
		const phone = window.matchMedia('(max-width: 40rem)');
		filtersOpen = !phone.matches;
		const follow = () => (filtersOpen = !phone.matches);
		phone.addEventListener('change', follow);
		return () => phone.removeEventListener('change', follow);
	});

	/** Each choice applies at once; typing in the Page box applies when the reader leaves it or presses Enter. */
	function apply(event: Event & { currentTarget: HTMLFormElement }): void {
		event.currentTarget.requestSubmit();
	}


	function sizeLabel(size: number): string {
		return size === 0 ? 'Any size' : `At least ${size.toLocaleString('en-US')} bytes`;
	}

	const kindChoices = [{ value: '', label: 'All kinds' }, ...pageKinds.map((kind) => ({ value: kind, label: pageKindFilterLabels[kind] }))];
	const whoChoices = $derived([{ value: '', label: 'Anyone' }, ...data.people.map((person) => ({ value: person.key, label: person.name }))]);
	const dateChoices = dayChoices.map((choice) => ({ value: String(choice), label: dayLabels[choice] }));
	const changeSizeChoices = sizeChoices.map((choice) => ({ value: String(choice), label: sizeLabel(choice) }));

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

	/** A page's own Changes view, or its history here when it is no longer on the site. */
	function historyLink(address: string): string {
		return pageChangesLink(address);
	}

	function totalSize(items: ChangeView[]): number | undefined {
		const sizes = items.map((item) => item.sizeChange).filter((size): size is number => size !== undefined);
		return sizes.length > 0 ? sizes.reduce((sum, size) => sum + size, 0) : undefined;
	}
</script>

<svelte:head>
	<title>{history ? `History of ${data.pageTitle ?? filters.page}` : 'Recent changes'} · Tribal Law Project</title>
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
	{#if change.change === 'restored'}<span class="tag">Restored version</span>{/if}
	{#if change.id.startsWith('nation-')}<span class="tag nation">Nation’s own edit</span>{/if}
	{#if change.bulk}<span class="tag bulk">Bulk update</span>{/if}
{/snippet}

{#if history}
	<Breadcrumbs trail={[{ label: 'Recent changes', href: '/changes' }]} current="{historyShowsWording ? 'History of' : 'Changes to'} {historyName}" />
	<h1>{historyShowsWording ? 'History of' : 'Changes to'} {historyName}</h1>
	<!-- Says plainly that the list is one page's, with the way back to every page's (Trevor, Nov. 23, 2026). -->
	<p class="showing">
		Showing changes to {#if data.pageOnSite && filters.page}<a href={filters.page}>{historyName}</a>{:else}{historyName}{/if} only
		· <a href="/changes">Show all changes</a>
	</p>
	<PageHistory
		changes={data.changes}
		address={filters.page ?? ''}
		kind={historyKind}
		pageOnSite={data.pageOnSite}
		recordedSince={data.recordedSince}
	/>
{:else}
	<p class="eyebrow">About the site</p>
	<h1>Recent changes</h1>
	<p class="lede">
		Every change to a page on this site, newest first. Open a change to see what was added and taken out, or a page’s
		history to see every version. Nation pages list what changed and when, but not the earlier wording.
	</p>

	<details class="filter-fold" bind:open={filtersOpen}>
		<summary>
			<span class="filter-button"><Search size={16} aria-hidden="true" />Filters{#if narrowing.length > 0}{` · ${narrowing.length}`}{/if}</span>
			{#each narrowing.slice(0, 2) as choice (choice)}<span class="summary-chip">{choice}</span>{/each}
		</summary>
	<form method="get" class="filters" aria-label="Filter changes" data-sveltekit-keepfocus data-sveltekit-noscroll onchange={apply}>
		<div class="fields">
			<div class="field page-field">
				<label for="changes-title">Page</label>
				<span class="with-icon">
					<Search size={16} aria-hidden="true" />
					<input id="changes-title" type="search" name="title" value={filters.title ?? ''} placeholder="Any page, or type a title" maxlength="100" autocomplete="off" />
				</span>
			</div>
			<div class="field">
				<Dropdown label="Kind of page" name="kind" choices={kindChoices} value={filters.kinds.length === 1 ? filters.kinds[0] : ''} />
			</div>
			<div class="field">
				<Dropdown label="Who" name="who" icon={User} choices={whoChoices} value={filters.who ?? ''} />
			</div>
			<div class="field">
				<Dropdown label="Dates" name="days" icon={CalendarIcon} choices={dateChoices} value={String(filters.days)} />
			</div>
			<div class="field">
				<Dropdown label="Size of change" name="size" choices={changeSizeChoices} value={String(filters.size)} />
			</div>
		</div>
		<fieldset class="choices">
			<legend class="visually-hidden">Kinds of change</legend>
			{#each changeKinds as kind (kind)}
				<label class="chip"
					><input class="visually-hidden" type="checkbox" name="change" value={kind} checked={filters.changes.includes(kind)} /><Check
						class="chip-check"
						size={14}
						aria-hidden="true"
					/>{changeKindLabels[kind]}</label
				>
			{/each}
			<label class="chip"
				><input class="visually-hidden" type="checkbox" name="hidden" value="1" checked={filters.hidden} /><Check
					class="chip-check"
					size={14}
					aria-hidden="true"
				/>Hidden changes</label
			>
		</fieldset>
		<div class="toggles">
			<input type="hidden" name="group" value="0" />
			<label class="switch"><input type="checkbox" role="switch" name="group" value="1" checked={filters.group} />Group changes by page</label>
			<!-- "Hide bulk updates" sends bulk=0 after this bulk=1, so turning it off shows them. -->
			<input type="hidden" name="bulk" value="1" />
			<label class="switch"><input type="checkbox" role="switch" name="bulk" value="0" checked={!filters.showBulk} />Hide bulk updates</label>
			<label class="switch"><input type="checkbox" role="switch" name="follow" value="1" checked={filters.following} />Only pages I follow</label>
			{#if filters.limit !== defaultFilters.limit}<input type="hidden" name="limit" value={filters.limit} />{/if}
			{#if !scripted}<button type="submit" class="button">Show changes</button>{/if}
			<a href="/changes" class="reset small">Reset filters</a>
		</div>
	</form>
	</details>

	<p class="count small muted">
		<span>
			{#if data.changes.length === 0}No changes match.{:else}Showing {data.changes.length.toLocaleString('en-US')} of {data.total.toLocaleString('en-US')}
				{data.total === 1 ? 'change' : 'changes'}{span ? `, ${span}` : ''}{/if}
			{#if filters.following && !data.signedIn}<a href="/sign-in?returnTo={encodeURIComponent(`/changes${filterQuery(filters)}`)}">Sign in</a> to see the pages you follow.{/if}
		</span>
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
			{data.hiddenBulk.toLocaleString('en-US')} bulk {data.hiddenBulk === 1 ? 'update' : 'updates'} hidden (changes that touched
			many pages at once).
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

	.eyebrow {
		margin: 0;
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
	}

	.eyebrow + h1 {
		margin-top: var(--space-1);
	}

	.filters {
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		padding: var(--space-3) var(--space-4);
		background: var(--color-surface-raised);
		margin-block: var(--space-4);
	}

	/* On wider screens the filters are always open, so the fold's button is not drawn. */
	.filter-fold > summary {
		display: none;
	}

	.fields {
		display: grid;
		grid-template-columns: 1.6fr 1fr 1fr 1fr 1.2fr;
		gap: var(--space-3);
		align-items: end;
	}

	.field label {
		display: block;
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
		margin-bottom: var(--space-1);
	}

	.field input {
		width: 100%;
		margin: 0;
	}

	/* The shared dropdowns sit in the row as the other filters do: no space above, the small label, the full cell. */
	.field :global(.dropdown) {
		margin: 0;
	}

	.field :global(.dropdown-label) {
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
	}

	.field :global(.dropdown-control),
	.field :global(.dropdown-fallback select) {
		width: 100%;
	}

	/* A Lucide icon inside the box's left edge: search, person, calendar. */
	.with-icon {
		position: relative;
		display: block;
	}

	.with-icon :global(svg) {
		position: absolute;
		inset-inline-start: var(--space-2);
		top: 50%;
		translate: 0 -50%;
		color: var(--color-ink-muted);
		pointer-events: none;
	}

	.with-icon input {
		padding-inline-start: calc(var(--space-2) + 16px + var(--space-2));
	}

	.choices {
		border: 0;
		padding: 0;
		margin: var(--space-3) 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	/* A kind of change is a chip: teal with a check when chosen, plain when not. */
	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		border: 1px solid var(--color-line);
		border-radius: 999px;
		padding: var(--space-1) var(--space-3);
		background: var(--color-surface-raised);
		font-size: var(--font-size-small);
		cursor: pointer;
	}

	.chip :global(.chip-check) {
		display: none;
	}

	.chip:has(input:checked) {
		border-color: var(--color-link);
		background: var(--color-notice-background);
		color: var(--color-link);
		font-weight: var(--font-weight-bold);
	}

	.chip:has(input:checked) :global(.chip-check) {
		display: inline;
	}

	.chip:has(input:focus-visible),
	.switch:has(input:focus-visible) {
		outline: 3px solid var(--color-focus-ring);
		outline-offset: 2px;
	}

	.toggles {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-4);
		margin-top: var(--space-3);
		font-size: var(--font-size-small);
	}

	.toggles .reset {
		margin-inline-start: auto;
	}

	.switch {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		cursor: pointer;
	}

	/* An on/off switch drawn from the checkbox itself, so it still works as one. */
	.switch input {
		appearance: none;
		position: relative;
		flex: none;
		width: 2.125rem;
		height: 1.25rem;
		margin: 0;
		border-radius: 999px;
		background: var(--color-line);
		cursor: pointer;
		transition: background var(--motion-duration-short) var(--motion-easing-standard);
	}

	.switch input::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 1rem;
		height: 1rem;
		border-radius: 50%;
		background: var(--color-surface-raised);
		transition: translate var(--motion-duration-short) var(--motion-easing-standard);
	}

	.switch input:checked {
		background: var(--color-band);
	}

	.switch input:checked::after {
		translate: 0.875rem 0;
		background: var(--color-paper);
	}

	.switch input:focus-visible {
		outline: none;
	}

	.count {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		justify-content: space-between;
		margin-top: var(--space-4);
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
		/* Wide enough for "what changed · history" on a nation page's row. */
		grid-template-columns: 5.5rem 10.5rem 1fr;
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

	.tag.nation {
		background: var(--color-notice-background);
		border-color: var(--color-link);
		color: var(--color-link);
	}

	.hidden-part {
		color: var(--color-ink-muted);
		text-decoration: line-through;
	}

	.showing {
		margin-block-start: 0;
	}















	@media (max-width: 60rem) {
		.fields {
			grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		}

	}

	@media (max-width: 40rem) {
		/* On a phone the filters fold behind a "Filters" button with the choices in force beside it (approved mockup 2). */
		.filter-fold > summary {
			display: flex;
			flex-wrap: wrap;
			gap: var(--space-2);
			margin-block: var(--space-2) var(--space-3);
			list-style: none;
			cursor: pointer;
		}

		.filter-fold > summary::-webkit-details-marker {
			display: none;
		}

		.filter-button,
		.summary-chip {
			display: inline-flex;
			align-items: center;
			gap: var(--space-1);
			min-height: 2.25rem;
			padding: 0 var(--space-3);
			border: 1px solid var(--color-link);
			border-radius: 999px;
			color: var(--color-link);
			font-weight: var(--font-weight-bold);
			font-size: var(--font-size-small);
		}

		.filter-button {
			border-radius: var(--radius-control);
		}

		.summary-chip {
			background: var(--color-notice-background);
		}

		.filters {
			margin-top: 0;
		}

		/* The phone mockup goes straight from the heading to the filters. */
		.eyebrow,
		.eyebrow ~ .lede {
			display: none;
		}

		.toggles .reset {
			margin-inline-start: 0;
		}

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
