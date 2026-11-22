<script lang="ts">
	import { accessLevelLabels } from '#lib/permissions.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const originLabels = { editor: 'Saved', git: 'Brought in from git', restore: 'Restored' } as const;
	let compareFrom = $state<number | undefined>(undefined);
	let compareTo = $state<number | undefined>(undefined);
	$effect.pre(() => {
		compareTo ??= data.versions[0]?.number;
		compareFrom ??= data.versions[1]?.number ?? data.versions[0]?.number;
	});
</script>

<svelte:head>
	<title>{data.title} · Essays · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<nav aria-label="Breadcrumb" class="small"><a href="/workspace/essays">Essays</a> › {data.title}</nav>

<h1>{data.title}</h1>
<p class="small muted">Your access: {accessLevelLabels[data.level].toLocaleLowerCase('en-US')}</p>
<p class="actions">
	<a class="button" href="/workspace/essays/{data.identifier}/edit">{data.canEdit ? 'Edit' : 'Read'}</a>
	{#if data.publications.some((publication) => publication.listed)}
		<a class="button button-quiet" href={data.page}>Published page</a>
	{/if}
</p>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

{#if data.versions.length > 1}
	<form method="get" action="/workspace/essays/{data.identifier}/compare" class="panel compare">
		<h2>Compare two versions</h2>
		<div class="field">
			<label for="compare-from">From</label>
			<select id="compare-from" name="from" bind:value={compareFrom}>
				{#each data.versions as row (row.number)}<option value={row.number}>Version {row.number}</option>{/each}
			</select>
		</div>
		<div class="field">
			<label for="compare-to">To</label>
			<select id="compare-to" name="to" bind:value={compareTo}>
				{#each data.versions as row (row.number)}<option value={row.number}>Version {row.number}</option>{/each}
			</select>
		</div>
		<button class="button button-quiet" type="submit">Compare</button>
	</form>
{/if}

<h2>Saved versions</h2>
<ol class="versions" reversed>
	{#each data.versions as row (row.number)}
		<li>
			<p>
				<strong>Version {row.number}</strong>{#if row.published.length > 0} <span class="tag">published</span>{/if}
				<span class="small muted">{originLabels[row.origin]} by {row.by}, {row.at}</span>
			</p>
			{#if row.note}<p class="small">“{row.note}”</p>{/if}
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
