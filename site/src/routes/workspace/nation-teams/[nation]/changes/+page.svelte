<script lang="ts">
	import { changeKindLabels, contactKindLabels, hideableSectionLabels, statementSectionLabels, type ChangeContents, type StatementSection } from '#lib/nation-page-changes.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const stateLabels = { live: 'On the page now', waiting: 'Waiting to go live', replaced: 'Replaced', cancelled: 'Cancelled' } as const;

	function when(value: string | null): string {
		return value ? new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '';
	}
</script>

<svelte:head>
	<title>Changes to the page of {data.nation.title} · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<p class="small">
	<a href="/workspace/nation-teams/{data.nation.identifier}/edit">Edit the page</a> ·
	<a href="/workspace/nation-teams/{data.nation.identifier}">Your nation’s team</a>
	{#if data.nation.page}· <a href={data.nation.page}>View the page</a>{/if}
</p>
<h1>Changes to the page of {data.nation.title}</h1>
<p>
	Every version your team published, newest first. Only your nation’s team and the project see this history; the
	page itself never shows earlier versions. An editor can put an earlier version back.
</p>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

{#if data.versions.length === 0}
	<p>Nothing has been published yet.</p>
{:else}
	<ol class="versions">
		{#each data.versions as version (version.identifier)}
			<li>
				<details>
					<summary>
						<strong>{version.summary}</strong>
						<span class="small muted">
							{stateLabels[version.state]} · {version.state === 'cancelled' ? '' : when(version.publishedAt)}
							{#if version.publishedByName}· published by {version.publishedByName}{/if}
							{#if version.writtenByName && version.writtenByName !== version.publishedByName}· written by {version.writtenByName}{/if}
							{#if version.approvedByName}· approved early by {version.approvedByName}{/if}
							{#if version.restoredFrom}· an earlier version put back{/if}
						</span>
					</summary>
					<div class="version-body">
						<p class="small muted">{changeKindLabels[version.kind]}, credited to {version.credit}.</p>
						{#if version.kind === 'about' || version.kind === 'courts'}
							<p class="version-text">{(version.content as ChangeContents['about']).text || '(empty)'}</p>
						{:else if version.kind === 'statements'}
							{#each Object.entries((version.content as ChangeContents['statements']).statements) as [section, text] (section)}
								<p><strong>{statementSectionLabels[section as StatementSection]}:</strong> <span class="version-text">{text}</span></p>
							{/each}
						{:else if version.kind === 'contacts'}
							<ul>
								{#each (version.content as ChangeContents['contacts']).contacts as contact, index (index)}
									<li>{contact.office}: {contactKindLabels[contact.kind]} {contact.value}</li>
								{/each}
							</ul>
						{:else if version.kind === 'pictures'}
							<ul class="version-pictures">
								{#each (version.content as ChangeContents['pictures']).pictures as picture (picture.identifier)}
									<li><img src="/workspace/nation-teams/{data.nation.identifier}/pictures/{picture.identifier}" alt={picture.alt} /></li>
								{/each}
							</ul>
						{:else if version.kind === 'hidden'}
							<p>
								{(version.content as ChangeContents['hidden']).sections.map((section) => hideableSectionLabels[section]).join(', ') || 'Nothing hidden'}
							</p>
						{/if}
						{#if version.canRestore}
							<form method="post" action="?/restore">
								<input type="hidden" name="change" value={version.identifier} />
								<button class="button button-quiet" type="submit">Put this version back</button>
							</form>
						{/if}
					</div>
				</details>
			</li>
		{/each}
	</ol>
{/if}

<style>
	.versions {
		padding: 0;
		list-style: none;
	}

	.versions > li {
		border-bottom: 1px solid var(--color-line);
		padding: var(--space-2) 0;
	}

	summary {
		cursor: pointer;
	}

	summary .small {
		display: block;
	}

	.version-body {
		padding: var(--space-2) 0 var(--space-2) var(--space-4);
	}

	.version-text {
		white-space: pre-wrap;
	}

	.version-pictures {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		padding: 0;
		list-style: none;
	}

	.version-pictures img {
		width: 8rem;
		height: auto;
	}
</style>
