<script lang="ts">
	// What the source watch found (docs/source-watch.md, "The review queue"),
	// built to mockup A, which Trevor chose on Nov. 26, 2026: one table, newest
	// first, whose rows open in place to show the item's details and actions
	// (/mnt/project-files/design/source-watch-review). Nothing is published
	// from here: an added item later becomes a record draft that lands by pull
	// request and starts Unverified.
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import Activity from '@lucide/svelte/icons/activity';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import FileIcon from '@lucide/svelte/icons/file';
	import Filter from '@lucide/svelte/icons/filter';
	import Layers from '@lucide/svelte/icons/layers';
	import Link2 from '@lucide/svelte/icons/link-2';
	import Mail from '@lucide/svelte/icons/mail';
	import Pause from '@lucide/svelte/icons/pause';
	import Plus from '@lucide/svelte/icons/plus';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import X from '@lucide/svelte/icons/x';
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import { readableDate } from '#lib/readable-date.ts';
	import { feedLabel as feedLabelFrom, hostingLabels, proposedLabels, sensitivityLabels } from '#lib/watch-labels.ts';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import SearchableDropdown from '#lib/components/SearchableDropdown.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const feedLabel = (feed: string) => feedLabelFrom(feed, data.collectionTitles);

	// "Checked 2 minutes ago · 3 watchers · next: eCFR at 12:07 PM", as in the mockup.
	const stateLine = $derived(
		[
			data.watch.minutesSinceTick === null ? null : `Checked ${data.watch.minutesSinceTick === 0 ? 'this minute' : `${data.watch.minutesSinceTick} minute${data.watch.minutesSinceTick === 1 ? '' : 's'} ago`}`,
			`${data.watch.watchersOn} watcher${data.watch.watchersOn === 1 ? '' : 's'}`,
			data.watch.next ? `next: ${data.watch.next.title} at ${new Date(data.watch.next.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })}` : null,
			data.waitingForModel > 0 ? `${data.waitingForModel} waiting for a model` : null
		]
			.filter(Boolean)
			.join(' · ')
	);

	type Item = (typeof data.items)[number];

	// The first row starts open, as in the mockup; any row opens and closes in place.
	let opened = $state<Set<number>>(new Set());
	let firstOpened = $state<number | null>(null);
	$effect(() => {
		const first = data.items[0]?.identifier ?? null;
		if (first !== firstOpened) {
			firstOpened = first;
			opened = new Set(first === null ? [] : [first]);
		}
	});
	function toggle(identifier: number) {
		const next = new Set(opened);
		if (next.has(identifier)) next.delete(identifier);
		else next.add(identifier);
		opened = next;
	}

	/** Same as… and Not relevant ask one more thing before they are sent. */
	let asking = $state<{ identifier: number; decision: 'same-as' | 'not-relevant' } | null>(null);

	// The Worker writes its progress every minute, so the page asks again every minute.
	$effect(() => {
		const timer = setInterval(() => void invalidateAll(), 60_000);
		return () => clearInterval(timer);
	});

	const filterLabels: Record<string, string> = { collection: 'Collection', nation: 'Nation', watcher: 'Watcher', proposed: 'Proposed' };

	function addressWith(changes: Record<string, string | null>): string {
		const parameters = new URLSearchParams(page.url.search);
		for (const [name, value] of Object.entries(changes)) {
			if (value === null) parameters.delete(name);
			else parameters.set(name, value);
		}
		const query = parameters.toString();
		return query ? `?${query}` : page.url.pathname;
	}

	function filterValueLabel(kind: string, value: string): string {
		if (kind === 'collection') return feedLabel(value);
		if (kind === 'proposed') return proposedLabels[value] ?? value;
		return data.choices[kind]?.find((choice) => choice.value === value)?.label ?? value;
	}

	const shortDate = (date: string) => readableDate(date).replace(/, \d{4}$/, '');

	function foundDate(item: Item): string {
		return shortDate(item.publishedOn ?? item.foundAt.slice(0, 10));
	}

	function sourceLine(item: Item): string {
		const parts = [item.watcherTitle];
		if (item.documentNumber) parts.push(`FR Doc. ${item.documentNumber}`);
		else if (item.watcher === 'ecfr') parts.push(item.kind === 'regulation-section-removed' ? 'Section removed' : 'Section changed');
		else if (item.kind === 'changed-file') parts.push('Changed file');
		else if (item.kind === 'link-gone') parts.push('Link gone');
		if (item.publishedOn) parts.push(readableDate(item.publishedOn));
		return parts.join(' · ');
	}

	function hostOf(link: string): string {
		try {
			return new URL(link).hostname.replace(/^www\./, '');
		} catch {
			return link;
		}
	}

	function whyLines(item: Item): { label: string | null; code: string | null; text: string }[] {
		return item.triage.map((step) => {
			if (step.step === 'rules') return step.by === 'dedupe' || step.by === 'sensitivity' || step.by === 'triage' ? { label: null, code: null, text: step.reason } : { label: 'Rule', code: step.by.replace(/^[a-z0-9-]+:/, ''), text: step.reason };
			if (step.step === 'person') return { label: 'Decided', code: null, text: step.reason };
			const model = step.by.replace(/^anthropic\//, '').replace(/^claude-/, 'Claude ').replace(/-(\d+)\.(\d+)$/, ' $1.$2').replace(/-/g, ' ');
			return { label: step.step === 'sample-check' ? `Sample check, ${model}` : model.replace(/\b(haiku|opus|sonnet)\b/, (word) => word[0].toUpperCase() + word.slice(1)), code: null, text: step.reason };
		});
	}

	const proposedText = (item: Item) => proposedLabels[item.proposed ?? 'none'] ?? item.proposed ?? 'None';
	const recordSearch = (title: string) => `/search?${new URLSearchParams({ q: title })}`;
	const reviewing = $derived(data.view === 'to-review' || data.view === 'held');
</script>

<svelte:head>
	<title>Source watch · Workspace · Tribal Law Project</title>
</svelte:head>

<Breadcrumbs trail={[{ label: 'Workspace', href: '/workspace' }]} current="Source watch" />
<h1>Source watch <CountBadge count={data.views.find((view) => view.name === 'to-review')?.count ?? 0} label="to review" /></h1>

<p class="watch-state">
	<span class="state-chip" class:problem={data.watch.state === 'not-running' || data.watch.state === 'problem'}><Activity size={16} aria-hidden="true" /> {data.watch.stateWords}</span>
	<span class="muted">{stateLine}</span>
	<a href={data.watch.progressPage} target="_blank" rel="noopener noreferrer">Progress</a>
</p>

<nav class="view-tabs" aria-label="Show">
	{#each data.views as view (view.name)}
		<a href={addressWith({ view: view.name === 'to-review' ? null : view.name })} aria-current={data.view === view.name ? 'page' : undefined}>{view.label} <CountBadge count={view.count} /></a>
	{/each}
</nav>

<div class="tools">
	{#each Object.entries(data.filters) as [kind, value] (kind)}
		<span class="filter-chip">{filterLabels[kind]}: {filterValueLabel(kind, value as string)} <a href={addressWith({ [kind]: null })} aria-label="Remove filter {filterLabels[kind]}"><X size={16} aria-hidden="true" /></a></span>
	{/each}
	<details class="add-filter">
		<summary class="button button-quiet"><Filter size={18} aria-hidden="true" /> Add filter</summary>
		<form method="get" class="filter-form">
			{#if data.view !== 'to-review'}<input type="hidden" name="view" value={data.view} />{/if}
			{#each Object.entries(data.filters) as [kind, value] (kind)}<input type="hidden" name={kind} value={value} />{/each}
			{#each Object.entries(data.choices) as [kind, values] (kind)}
				{#if !(kind in data.filters) && values.length > 0}
					{@const filterChoices = [{ value: '', label: 'Any' }, ...values.map((choice) => ({ value: choice.value, label: kind === 'collection' ? feedLabel(choice.value) : kind === 'proposed' ? (proposedLabels[choice.value] ?? choice.label) : choice.label }))]}
					{#if values.length > 12}
						<SearchableDropdown label={filterLabels[kind]} name={kind} choices={filterChoices} value="" />
					{:else}
						<Dropdown label={filterLabels[kind]} name={kind} choices={filterChoices} value="" />
					{/if}
				{/if}
			{/each}
			<button class="button" type="submit">Apply</button>
		</form>
	</details>
</div>

{#if form && 'problem' in form && form.problem}
	<p class="problem" role="alert">{form.problem}</p>
{/if}

{#if data.items.length === 0}
	<p class="muted">None Identified.</p>
{:else}
	<div class="table-scroll">
		<table class="watch-table">
			<thead>
				<tr><th class="toggle-column"><span class="visually-hidden">Details</span></th><th scope="col">Item</th><th scope="col">Collection</th><th scope="col" class="nations-column">Nations</th><th scope="col" class="found-column">Found</th><th scope="col">Proposed</th></tr>
			</thead>
			<tbody>
				{#each data.items as item (item.identifier)}
					{@const open = opened.has(item.identifier)}
					<tr class:open>
						<td class="toggle-column">
							<button class="icon-button" type="button" aria-expanded={open} aria-controls="item-{item.identifier}" aria-label="Details" onclick={() => toggle(item.identifier)}>
								{#if open}<ChevronDown size={18} aria-hidden="true" />{:else}<ChevronRight size={18} aria-hidden="true" />{/if}
							</button>
						</td>
						<th scope="row"><button type="button" class="title-button" onclick={() => toggle(item.identifier)}><span class="item-title">{item.title}</span></button><span class="item-source">{sourceLine(item)}</span></th>
						<td class="collection-column">{item.feeds.filter((feed) => !feed.startsWith('nation:')).slice(0, 1).map(feedLabel).join('') || (item.feeds[0] ? feedLabel(item.feeds[0]) : '')}</td>
						<td class="nations-column">{item.nations.map((nation) => nation.name).join('; ')}</td>
						<td class="found-column">{foundDate(item)}</td>
						<td>
							{#if item.sensitivity.length > 0 && data.view === 'held'}<span class="badge flag">{sensitivityLabels[item.sensitivity[0]] ?? item.sensitivity[0]}</span>{:else}<span class="badge proposed">{proposedText(item)}</span>{/if}
						</td>
					</tr>
					{#if open}
						<tr class="detail" id="item-{item.identifier}">
							<td colspan="6">
								<div class="detail-grid">
									<dl>
										{#if item.link}<dt>Source</dt><dd><a href={item.link} target="_blank" rel="noopener noreferrer">{hostOf(item.link)} <ExternalLink size={14} aria-hidden="true" /></a></dd>{/if}
										<dt>Our copy</dt>
										<dd>
											{#if item.capture}
												<FileIcon size={16} aria-hidden="true" /> <a href="/workspace/watch/files/{item.identifier}">.{item.capture.extension}</a>
												{#if item.capture.clean}<span class="badge clean"><ShieldCheck size={14} aria-hidden="true" /> Scan clean</span>{:else}<span class="badge">{item.capture.scanLabel}</span>{/if}
											{:else}
												<span class="muted">None kept{item.watcher === 'ecfr' ? ' (the eCFR’s robots.txt bars copies)' : ''}</span>
											{/if}
										</dd>
										<dt>Proposed</dt>
										<dd>
											<span class="badge proposed">{proposedText(item)}</span>
											{#if (item.proposed === 'new-version' || item.proposed === 'same-as') && (item.matchTitle || item.matchRecord)}
												of {#if item.matchTitle}<a href={recordSearch(item.matchTitle)}>{item.matchTitle}</a>{:else}<code>{item.matchRecord}</code>{/if}
											{/if}
										</dd>
										<dt>Collection</dt><dd>{item.feeds.map(feedLabel).join('; ') || 'None'}</dd>
										<dt>{item.nations.length === 1 ? 'Nation' : 'Nations'}</dt>
										<dd>
											{#if item.nations.length === 0}<span class="muted">None Identified</span>{/if}
											{#each item.nations as nation, index (nation.identifier)}{#if index > 0};
												{/if}<a href="/nations/{nation.identifier}">{nation.name}</a>{/each}
										</dd>
										<dt>Hosting</dt><dd>{hostingLabels[item.hosting] ?? item.hosting}</dd>
										{#if item.sensitivity.length > 0}<dt>Held for</dt><dd>{item.sensitivity.map((flag) => sensitivityLabels[flag] ?? flag).join('; ')}</dd>{/if}
									</dl>
									<div>
										<p class="small why-heading"><strong>Why</strong></p>
										<ul class="why">
											{#each whyLines(item) as line, index (index)}
												<li>{#if line.label}{line.label}{#if line.code}&nbsp;<code>{line.code}</code>{/if}{': '}{/if}{line.text}</li>
											{/each}
										</ul>
										{#if item.summary}<p class="small summary">{item.summary}</p>{/if}
									</div>
									{#if item.difference}
										<div class="difference"><p class="difference-head">What changed</p><pre>{item.difference}</pre></div>
									{/if}
									<div class="actions">
										{#if reviewing}
											{@const primary = item.proposed === 'new-version' ? 'new-version' : item.proposed === 'same-as' ? 'same-as' : 'add'}
											{#snippet decision(name: string, label: string, Icon: typeof Plus)}
												<form method="post" action="?/decide" use:enhance>
													<input type="hidden" name="identifier" value={item.identifier} />
													<input type="hidden" name="decision" value={name} />
													<button class="button" class:button-quiet={primary !== name} type="submit"><Icon size={16} aria-hidden="true" /> {label}</button>
												</form>
											{/snippet}
											{#if item.proposed === 'new-version' || item.matchKind === 'new-version'}{@render decision('new-version', 'Add as new version', Layers)}{/if}
											{@render decision('add', 'Add', Plus)}
											<button class="button" class:button-quiet={primary !== 'same-as'} type="button" onclick={() => (asking = { identifier: item.identifier, decision: 'same-as' })}><Link2 size={16} aria-hidden="true" /> Same as…</button>
											<button class="button button-quiet" type="button" onclick={() => (asking = { identifier: item.identifier, decision: 'not-relevant' })}><X size={16} aria-hidden="true" /> Not relevant</button>
											{#if data.view === 'to-review'}{@render decision('hold', 'Hold', Pause)}{/if}
											{#if data.view === 'to-review' && item.nations.length > 0}{@render decision('ask-nation', 'Ask the nation', Mail)}{/if}
											{#if data.view === 'held'}{@render decision('reopen', 'Back to review', RotateCcw)}{/if}
										{:else}
											<form method="post" action="?/decide" use:enhance>
												<input type="hidden" name="identifier" value={item.identifier} />
												<input type="hidden" name="decision" value="reopen" />
												<button class="button button-quiet" type="submit"><RotateCcw size={16} aria-hidden="true" /> Reopen</button>
											</form>
											{#if item.decisionNote}<span class="small muted">{item.decisionNote}</span>{/if}
										{/if}
									</div>
									{#if asking?.identifier === item.identifier}
										<form method="post" action="?/decide" use:enhance={() => async ({ update }) => { asking = null; await update(); }} class="asking">
											<input type="hidden" name="identifier" value={item.identifier} />
											<input type="hidden" name="decision" value={asking.decision} />
											{#if asking.decision === 'same-as'}
												<label class="small">Record it is the same as <input name="record" value={item.matchRecord ?? ''} required placeholder="A source key, such as pechanga-compact-2020" /></label>
											{:else}
												<label class="small">Why, so a rule can learn from it <input name="note" placeholder="Optional" /></label>
											{/if}
											<button class="button" type="submit">{asking.decision === 'same-as' ? 'Save' : 'Not relevant'}</button>
											<button class="button button-quiet" type="button" onclick={() => (asking = null)}>Cancel</button>
										</form>
									{/if}
								</div>
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
	<p class="table-foot">{data.items.length} of {data.total} · Newest first</p>
{/if}

<style>
	h1 {
		display: flex;
		gap: var(--space-2);
		align-items: center;
	}
	.watch-state {
		display: flex;
		gap: var(--space-3);
		align-items: center;
		flex-wrap: wrap;
		margin: 0 0 var(--space-4);
	}
	.state-chip {
		display: inline-flex;
		gap: 6px;
		align-items: center;
		padding: 2px 10px;
		border: 1px solid var(--color-status-published-rule);
		background: var(--color-status-published-background);
		color: var(--color-status-published);
		border-radius: 999px;
		font-weight: 600;
	}
	.state-chip.problem {
		border-color: var(--color-danger);
		background: transparent;
		color: var(--color-danger);
	}
	.view-tabs {
		display: inline-flex;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		overflow: hidden;
		margin: 0 0 var(--space-3);
		flex-wrap: wrap;
	}
	.view-tabs a {
		padding: 6px 14px;
		border-right: 1px solid var(--color-control-border);
		color: var(--color-ink);
		text-decoration: none;
		display: inline-flex;
		gap: 8px;
		align-items: center;
		white-space: nowrap;
	}
	.view-tabs a:last-child {
		border-right: 0;
	}
	.view-tabs a[aria-current='page'] {
		background: var(--color-link);
		color: var(--color-paper);
		font-weight: 600;
	}
	.view-tabs a[aria-current='page'] :global(.count-badge) {
		background: var(--color-paper);
		color: var(--color-link);
	}
	.tools {
		display: flex;
		gap: var(--space-2);
		align-items: flex-start;
		flex-wrap: wrap;
		margin: 0 0 var(--space-3);
	}
	.filter-chip {
		display: inline-flex;
		gap: 6px;
		align-items: center;
		border: 1px solid var(--color-control-border);
		border-radius: 999px;
		padding: 2px 4px 2px 10px;
		font-size: 0.9rem;
		min-height: 2.25rem;
	}
	.filter-chip a {
		color: var(--color-ink-muted);
		display: inline-flex;
		padding: 2px;
	}
	.add-filter > summary {
		list-style: none;
		display: inline-flex;
		gap: 6px;
		align-items: center;
		cursor: pointer;
	}
	.add-filter > summary::-webkit-details-marker {
		display: none;
	}
	.filter-form {
		display: flex;
		gap: var(--space-2);
		align-items: flex-end;
		flex-wrap: wrap;
		margin-top: var(--space-2);
		padding: var(--space-3);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		background: var(--color-surface);
	}
	.badge {
		display: inline-flex;
		gap: 4px;
		align-items: center;
		font-size: 0.8rem;
		font-weight: 600;
		border: 1px solid var(--color-line);
		border-radius: 999px;
		padding: 0 8px;
		white-space: nowrap;
		color: var(--color-ink);
	}
	.badge.proposed {
		border-color: var(--color-link);
		color: var(--color-link);
	}
	.badge.flag {
		border-color: var(--color-danger);
		color: var(--color-danger);
	}
	.badge.clean {
		border-color: var(--color-status-published-rule);
		color: var(--color-status-published);
		background: var(--color-status-published-background);
	}
	.watch-table {
		width: 100%;
		border-collapse: collapse;
	}
	.watch-table th,
	.watch-table td {
		text-align: left;
		vertical-align: top;
		padding: 10px 12px;
		border-bottom: 1px solid var(--color-line);
	}
	.watch-table thead th {
		font-size: 0.85rem;
		background: var(--color-surface);
		font-weight: 600;
	}
	.watch-table .toggle-column {
		width: 44px;
		padding: 6px;
	}
	.watch-table tr.open > td,
	.watch-table tr.open > th {
		border-bottom: 0;
		background: var(--color-surface);
	}
	.watch-table tr.detail > td {
		background: var(--color-surface);
		padding: 0 12px 16px 56px;
	}
	.title-button {
		all: unset;
		cursor: pointer;
	}
	.title-button:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.item-title {
		font-weight: 600;
	}
	.item-source {
		display: block;
		font-size: 0.85rem;
		color: var(--color-ink-muted);
		margin-top: 2px;
		font-weight: 600;
	}
	.detail-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-3) var(--space-5);
	}
	.detail-grid dl {
		margin: 0;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 6px 14px;
		font-size: 0.92rem;
	}
	.detail-grid dt {
		color: var(--color-ink-muted);
		font-weight: 600;
	}
	.detail-grid dd {
		margin: 0;
	}
	.why-heading {
		margin: 0 0 4px;
	}
	.why {
		margin: 0;
		padding-left: 1.1rem;
		font-size: 0.92rem;
	}
	.why li {
		margin: 0 0 4px;
	}
	.summary {
		margin: var(--space-2) 0 0;
		color: var(--color-ink-muted);
	}
	.difference {
		grid-column: 1 / -1;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		font-size: 0.92rem;
		overflow: hidden;
	}
	.difference-head {
		margin: 0;
		padding: 6px 12px;
		font-weight: 600;
		background: var(--color-surface-raised);
		border-bottom: 1px solid var(--color-line);
	}
	.difference pre {
		margin: 0;
		padding: 6px 12px;
		white-space: pre-wrap;
		font: inherit;
	}
	.actions {
		grid-column: 1 / -1;
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
		align-items: center;
		margin-top: var(--space-2);
	}
	.actions form {
		display: contents;
	}
	.actions .button {
		display: inline-flex;
		gap: 6px;
		align-items: center;
	}
	.asking {
		grid-column: 1 / -1;
		display: flex;
		gap: var(--space-2);
		align-items: flex-end;
		flex-wrap: wrap;
	}
	.asking label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: min(100%, 22rem);
	}
	.table-foot {
		font-size: 0.85rem;
		color: var(--color-ink-muted);
	}
	.problem {
		color: var(--color-danger);
	}
	@media (max-width: 700px) {
		.watch-table thead {
			display: none;
		}
		.watch-table tr {
			display: block;
			border-bottom: 1px solid var(--color-line);
		}
		.watch-table th,
		.watch-table td {
			display: block;
			border: 0;
			padding: 4px 0;
		}
		.watch-table .toggle-column,
		.watch-table .found-column,
		.watch-table .nations-column {
			display: none;
		}
		.watch-table tr.detail > td {
			padding: 0 0 12px;
		}
		.detail-grid {
			grid-template-columns: 1fr;
		}
		.view-tabs {
			display: flex;
		}
		.view-tabs a {
			flex: 1 1 auto;
			justify-content: center;
			padding: 6px 8px;
		}
	}
</style>
