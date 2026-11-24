<script lang="ts">
	// Find the law (src/lib/find-the-law.ts): pick a Native nation and a
	// subject, and see the nation's law, court decisions, agreements and the
	// federal law that applies, together. The nation and the subject go in the
	// page address. The page is built empty; the browser loads the nation's
	// file (/nations/law/<id>.json) when one is picked.
	import { onMount } from 'svelte';
	import { nationNames } from 'virtual:section-lists';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import Collapsible from '#lib/components/Collapsible.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import SearchableDropdown, { type SearchableChoice } from '#lib/components/SearchableDropdown.svelte';
	import TopicBadges from '#lib/components/TopicBadges.svelte';
	import {
		isLawSubject,
		itemsFor,
		lawAddress,
		lawParts,
		lawSubjectLabels,
		lawSubjects,
		type LawItem,
		type LawSubjectChoice,
		type NationLaw
	} from '#lib/find-the-law.ts';
	import { readableDate } from '#lib/readable-date.ts';
	import { noneIdentified } from '#lib/search-status.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';

	const nationChoices: SearchableChoice<string>[] = nationNames.map(([label, id]) => ({ value: id, label }));
	const subjectChoices: { value: LawSubjectChoice; label: string }[] = [
		{ value: 'all', label: 'All subjects' },
		...lawSubjects.map((subject) => ({ value: subject.key, label: subject.label }))
	];

	let nation = $state('');
	let subject = $state<LawSubjectChoice>('all');
	let law = $state<NationLaw | undefined>(undefined);
	let loading = $state(false);
	let loadFailed = $state(false);

	const subjectLabel = $derived(subject === 'all' ? 'All subjects' : lawSubjectLabels[subject]);
	const parts = $derived(law ? lawParts.map((part) => ({ ...part, items: itemsFor(law!, part.key, subject) })) : []);
	// The opinions not sorted by this subject: said in one line, linked to all of them.
	const opinionsUnsorted = $derived(
		law?.opinions && subject !== 'all' && subject !== 'courts' && !law.items.some((item) => item.key.startsWith('opinion-') && item.subjects.includes(subject as never))
	);

	function columnsFor(showSubjects: boolean): TableColumn[] {
		return [
			{ key: 'title', header: 'Title', isRowHeader: true, sortable: true, searchable: true, custom: true },
			{ key: 'kind', header: 'Kind', sortable: true, filterable: true },
			{ key: 'date', header: 'Date', type: 'date', sortable: true },
			...(showSubjects ? [{ key: 'subjects', header: 'Subjects', filterable: true, custom: true }] : [])
		];
	}

	function rowsOf(items: LawItem[]): TableRow[] {
		return items.map((item) => ({
			key: item.key,
			cells: {
				title: { text: [item.title, item.detail].filter(Boolean).join(' '), sortValue: item.title, href: item.link },
				kind: { text: item.everyNation ? `${item.kind}, every nation` : item.kind, values: [item.kind] },
				date: { text: item.date ? readableDate(item.date) : '', sortValue: item.date },
				subjects: {
					text: item.subjects.map((key) => lawSubjectLabels[key]).join(', '),
					values: item.subjects.map((key) => lawSubjectLabels[key])
				}
			}
		}));
	}

	async function load(id: string) {
		law = undefined;
		loadFailed = false;
		if (!id) return;
		loading = true;
		try {
			const response = await fetch(`/nations/law/${id}.json`);
			if (!response.ok) throw new Error(String(response.status));
			const body = (await response.json()) as NationLaw;
			if (id === nation) law = body;
		} catch {
			loadFailed = true;
		} finally {
			loading = false;
		}
	}

	function remember() {
		const next = lawAddress(nation, subject);
		if (next !== `${location.pathname}${location.search}`) history.replaceState(history.state, '', next);
	}

	function pickNation(id: string) {
		nation = id;
		remember();
		void load(id);
	}

	function pickSubject(value: LawSubjectChoice) {
		subject = value;
		remember();
	}

	onMount(() => {
		const search = new URLSearchParams(location.search);
		const asked = search.get('subject');
		subject = isLawSubject(asked) ? asked : 'all';
		const id = search.get('nation') ?? '';
		if (nationChoices.some((choice) => choice.value === id)) {
			nation = id;
			void load(id);
		}
	});
</script>

<svelte:head>
	<title>Find the law · Model Tribal ADR Code</title>
	<meta name="description" content="Pick a Native nation and a subject to see its laws, court decisions, agreements and the federal law that applies." />
</svelte:head>

<div class="find-law">
	<Breadcrumbs trail={[{ label: 'Nations', href: '/nations' }]} />
	<h1>Find the law</h1>
	<p class="lead">Pick a Native nation and a subject to see its laws, court decisions, agreements and the federal law that applies.</p>

	<div class="pickers no-print">
		<div class="nation-picker">
			<SearchableDropdown label="Native nation" choices={nationChoices} value={nation} onchange={pickNation} placeholder="Type a nation’s name" />
		</div>
		<div class="subject-picker">
			<Dropdown label="Subject" choices={subjectChoices} value={subject} onchange={pickSubject} />
		</div>
	</div>

	{#if loading}
		<p class="muted" role="status">Loading…</p>
	{:else if loadFailed}
		<p role="status">This nation’s law could not be loaded. Try again, or open <a href="/nations/{nation}">the nation’s page</a>.</p>
	{:else if law}
		<section class="result" aria-labelledby="result-heading">
			<h2 id="result-heading"><a href="/nations/{law.id}">{law.name}</a><span class="subject-name">{subjectLabel}</span></h2>
			{#if law.codes.length > 0}
				<p class="codes small">
					<span class="muted">Full code:</span>
					{#each law.codes as code, index (code.link)}{index > 0 ? ' · ' : ''}<a href={code.link}>{code.title}<ExternalLink aria-hidden="true" size="0.9em" strokeWidth={1.75} /></a>{/each}
				</p>
			{/if}

			{#each parts as part (part.key)}
				<Collapsible heading={part.heading} identifier="{part.key}-heading" count={part.items.length}>
					{#if part.key === 'decisions' && opinionsUnsorted && law.opinions}
						<p class="small muted unsorted">
							<a href={law.opinions.link}>{law.opinions.count.toLocaleString('en-US')} Tribal court opinions</a> are not sorted by this subject.
						</p>
					{/if}
					{#if part.items.length === 0}
						<p class="empty-section">{noneIdentified.text}</p>
					{:else}
						<DataTable
							identifier="law-{part.key}"
							label="Table: {part.heading}"
							columns={columnsFor(subject === 'all')}
							rows={rowsOf(part.items)}
							defaultSort={{ key: 'date', direction: 'descending' }}
							rowName={['item', 'items']}
							searchLabel={part.items.length > 12 ? `Search ${part.heading.toLocaleLowerCase('en-US')}` : undefined}
							filters
							count={false}
							download="{law.id}-{subject}-{part.key}"
						>
							{#snippet cell(row: TableRow, column: TableColumn)}
								{@const item = part.items.find((candidate) => candidate.key === row.key)}
								{#if item && column.key === 'title'}
									<span class="item-title">{#if item.link}<a href={item.link}>{#if item.italic}<i>{item.title}</i>{:else}{item.title}{/if}</a>{:else if item.italic}<i>{item.title}</i>{:else}{item.title}{/if}</span>
									{#if item.detail}<span class="item-detail small muted">{item.detail}</span>{/if}
								{:else if item && column.key === 'subjects'}
									<TopicBadges topics={item.subjects.map((key) => ({ text: lawSubjectLabels[key], link: lawAddress(law!.id, key) }))} label="Subjects" />
								{/if}
							{/snippet}
						</DataTable>
					{/if}
				</Collapsible>
			{/each}
		</section>
	{/if}
</div>

<style>
	.pickers {
		display: grid;
		grid-template-columns: minmax(0, 24rem) minmax(0, 16rem);
		gap: var(--space-3) var(--space-4);
		align-items: end;
		margin: var(--space-4) 0 var(--space-5);
	}

	.result h2 {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-1) var(--space-3);
		margin-bottom: var(--space-2);
	}

	.subject-name {
		color: var(--color-ink-muted);
		font-size: var(--font-size-body);
		font-weight: normal;
	}

	.codes {
		margin: 0 0 var(--space-4);
	}

	.codes a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.item-title,
	.item-detail {
		display: block;
	}

	.item-detail {
		max-width: var(--layout-measure);
		margin-top: var(--space-1);
		font-weight: normal;
	}

	.unsorted {
		margin: 0 0 var(--space-3);
	}

	.empty-section {
		display: flow-root;
		margin: 0 0 var(--space-5);
		padding: var(--space-3) 0;
		border-top: 1px solid var(--color-line);
		border-bottom: 1px solid var(--color-line);
		font-weight: var(--font-weight-semibold);
	}

	@media (max-width: 40rem) {
		.pickers {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
