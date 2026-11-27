<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import { accessLevelLabels } from '#lib/permissions.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// The essay's section, such as Essays or Foundations, now that Workspace › Essays is gone.
	const essayParts: Record<string, { label: string; link: string }> = { foundations: { label: 'Foundations', link: '/foundations' }, essays: { label: 'Essays', link: '/essays' } };
	const section = $derived(essayParts[data.page.split('/')[1]]);

	const originLabels = { editor: 'Saved', git: 'Brought in from git', restore: 'Restored' } as const;

	// Versions the editor saved by itself on an essay page come in runs; a
	// run by one person shows its newest version, with the rest folded under it.
	type Row = (typeof data.versions)[number];
	const isAutoSave = (row: Row) => row.note === 'Auto-saved' && row.published.length === 0;
	const groups = $derived.by(() => {
		const result: { row: Row; folded: Row[] }[] = [];
		for (const row of data.versions) {
			const last = result.at(-1);
			if (last && isAutoSave(row) && isAutoSave(last.row) && last.row.by === row.by) last.folded.push(row);
			else result.push({ row, folded: [] });
		}
		return result;
	});
	const versionChoices = $derived(data.versions.map((row) => ({ value: String(row.number), label: `Version ${row.number}` })));
	let compareFrom = $state<string | undefined>(undefined);
	let compareTo = $state<string | undefined>(undefined);
</script>

<svelte:head>
	<title>{data.title} · Essays · Workspace · Tribal Law Project</title>
</svelte:head>

<Breadcrumbs
	trail={[
		...(section ? [{ label: section.label, href: section.link }] : []),
		{ label: data.title, href: data.page }
	]}
/>

<h1>{data.title}</h1>
<p class="small muted">Your access: {accessLevelLabels[data.level].toLocaleLowerCase('en-US')}</p>
<p class="actions">
	<a class="button" href={data.canEdit ? `${data.page}?edit` : data.page}>{data.canEdit ? 'Edit' : 'Read'}</a>
	{#if data.publications.some((publication) => publication.listed)}
		<a class="button button-quiet" href={data.page}>Published page</a>
	{/if}
</p>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

{#if data.gitConflict}
	<section class="panel" aria-labelledby="git-heading">
		<h2 id="git-heading">Changed both here and in git</h2>
		<p class="small">
			Git changed {data.gitConflict.conflicts === 1 ? 'a paragraph' : `${data.gitConflict.conflicts} paragraphs`} that were also edited here since version {data.gitConflict.latestVersion}, so nothing from git was saved. Edit the paragraphs on the essay page to match what you want, or save the git text as a new version; either way every earlier version stays below to compare.
		</p>
		{#if data.canPublish}
			<form method="post" action="?/bringIn">
				<button class="button button-quiet" type="submit">Use the git text</button>
			</form>
		{/if}
	</section>
{/if}

{#if data.versions.length > 1}
	<form method="get" action="/workspace/essays/{data.identifier}/compare" class="panel compare">
		<h2>Compare two versions</h2>
		<div class="field">
			<Dropdown
				label="From"
				id="compare-from"
				name="from"
				choices={versionChoices}
				bind:value={() => compareFrom ?? String(data.versions[1]?.number ?? data.versions[0]?.number), (number) => (compareFrom = number)}
			/>
		</div>
		<div class="field">
			<Dropdown
				label="To"
				id="compare-to"
				name="to"
				choices={versionChoices}
				bind:value={() => compareTo ?? String(data.versions[0]?.number), (number) => (compareTo = number)}
			/>
		</div>
		<button class="button button-quiet" type="submit">Compare</button>
	</form>
{/if}

<h2>Saved versions</h2>
<ol class="versions" reversed>
	{#each groups as { row, folded } (row.number)}
		<li value={row.number}>
			<p>
				<strong>Version {row.number}</strong>{#if row.published.length > 0} <span class="tag">published</span>{/if}
				<span class="small muted">{isAutoSave(row) ? `Saved by itself for ${row.by}` : `${originLabels[row.origin]} by ${row.by}`}, {row.at}</span>
			</p>
			{#if row.note && !isAutoSave(row)}<p class="small">“{row.note}”</p>{/if}
			{#if folded.length > 0}
				<details class="small">
					<summary>{folded.length} earlier {folded.length === 1 ? 'save' : 'saves'} made by itself</summary>
					<ul>
						{#each folded as earlier (earlier.number)}
							<li><a href="/workspace/essays/{data.identifier}/versions/{earlier.number}">Version {earlier.number}</a>, {earlier.at}</li>
						{/each}
					</ul>
				</details>
			{/if}
			<div class="actions">
				<a class="small" href="/workspace/essays/{data.identifier}/versions/{row.number}">Read</a>
				{#if data.canPublish}
					<form method="post" action="?/publish">
						<input type="hidden" name="version" value={row.number} />
						<button class="button button-quiet" type="submit">Publish this version</button>
					</form>
					{#if row.number !== data.versions[0].number}
						<form method="post" action="?/restore">
							<input type="hidden" name="version" value={row.number} />
							<button class="button button-quiet" type="submit">Restore as a new version</button>
						</form>
					{/if}
				{/if}
			</div>
		</li>
	{/each}
</ol>

<h2>Publications</h2>
{#if data.publications.length === 0}
	<p>Not published yet. Readers see nothing until a version is published.</p>
{:else}
	<ol class="versions" reversed>
		{#each data.publications as publication (publication.number)}
			<li>
				<p>
					<strong>Publication {publication.number}</strong>: version {publication.versionNumber}
					<span class="small muted">by {publication.by}, {publication.at}</span>
					{#if !publication.listed}<span class="tag">held back</span>{/if}
				</p>
				{#if data.canPublish}
					<form method="post" action="?/holdBack" class="actions">
						<input type="hidden" name="publication" value={publication.number} />
						{#if publication.listed}
							<input type="hidden" name="listed" value="no" />
							<label class="small" for="reason-{publication.number}">Reason</label>
							<input id="reason-{publication.number}" type="text" name="reason" required />
							<button class="button button-quiet" type="submit">Hold back from readers</button>
						{:else}
							<input type="hidden" name="listed" value="yes" />
							<button class="button button-quiet" type="submit">List again</button>
						{/if}
					</form>
				{/if}
			</li>
		{/each}
	</ol>
{/if}

<style>
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}

	.actions form {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}

	.versions {
		padding-left: var(--space-5);
	}

	.versions li {
		margin-bottom: var(--space-4);
	}

	.versions p {
		margin: 0 0 var(--space-1);
	}

	.tag {
		font-size: var(--font-size-small);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		padding: 0 var(--space-1);
	}

	.compare {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: var(--space-3);
	}

	.compare h2 {
		flex-basis: 100%;
	}

	.compare .field {
		margin: 0;
	}
</style>
