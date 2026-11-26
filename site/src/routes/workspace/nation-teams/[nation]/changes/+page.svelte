<script lang="ts">
	import NationChangeContent from '#lib/components/NationChangeContent.svelte';
	import { changeKindLabels } from '#lib/nation-page-changes.ts';
	import type { PageProps } from './$types';
	import { mediumDateAndTime } from '#lib/readable-date.ts';

	let { data, form }: PageProps = $props();

	const stateLabels = { live: 'On the page now', waiting: 'Waiting to go live', replaced: 'Replaced', cancelled: 'Cancelled', undone: 'Undone by the project' } as const;

</script>

<svelte:head>
	<title>Changes to the page of {data.nation.title} · Workspace · Tribal Law Project</title>
</svelte:head>

<p class="small">
	<a href="/workspace/nation-teams/{data.nation.identifier}/edit">Edit the page</a> ·
	<a href="/workspace/nation-teams/{data.nation.identifier}">Your nation’s team</a> ·
	<a href="/workspace/nation-teams/{data.nation.identifier}/laws-and-cases">Laws and cases</a>
	{#if data.nation.page}· <a href={data.nation.page}>View the page</a>{/if}
</p>
<h1>Changes to the page of {data.nation.title}</h1>
<p>
	Every version your team published, newest first. Only your nation’s team and the project see this history; the
	page itself never shows earlier versions. An editor can put an earlier version back.
</p>

{#if data.paused}
	<div class="notice" role="status">
		<p>The project has paused publishing for this page. <a href="/workspace/nation-teams/{data.nation.identifier}/edit#project-question">See its question</a>.</p>
	</div>
{/if}

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
							{stateLabels[version.state]} · {version.state === 'cancelled' ? '' : mediumDateAndTime(version.publishedAt)}
							{#if version.publishedByName}· published by {version.publishedByName}{/if}
							{#if version.writtenByName && version.writtenByName !== version.publishedByName}· written by {version.writtenByName}{/if}
							{#if version.approvedByName}· approved early by {version.approvedByName}{/if}
							{#if version.restoredFrom}· an earlier version put back{/if}
						</span>
					</summary>
					<div class="version-body">
						{#if version.state === 'undone'}
							<p class="small">The project took this version off the page{#if version.projectNote}: “{version.projectNote}”{/if}.</p>
						{/if}
						<p class="small muted">{changeKindLabels[version.kind]}, credited to {version.credit}.</p>
						<NationChangeContent kind={version.kind} content={version.content} pictureBase="/workspace/nation-teams/{data.nation.identifier}/pictures" />
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
</style>
