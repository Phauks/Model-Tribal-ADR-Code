<script lang="ts">
	/**
	 * What one version of a nation's change says, for the team's history and the
	 * project's review. Pictures come from a private address given by the page.
	 */
	import {
		contactKindLabels,
		hideableSectionLabels,
		statementSectionLabels,
		type ChangeContent,
		type ChangeContents,
		type ChangeKind,
		type StatementSection
	} from '#lib/nation-page-changes.ts';

	let { kind, content, pictureBase }: { kind: ChangeKind; content: ChangeContent; pictureBase: string } = $props();
</script>

{#if kind === 'about' || kind === 'courts'}
	<p class="change-text">{(content as ChangeContents['about']).text || '(empty)'}</p>
{:else if kind === 'statements'}
	{#each Object.entries((content as ChangeContents['statements']).statements) as [section, text] (section)}
		<p><strong>{statementSectionLabels[section as StatementSection]}:</strong> <span class="change-text">{text}</span></p>
	{:else}
		<p>(no statements)</p>
	{/each}
{:else if kind === 'contacts'}
	<ul>
		{#each (content as ChangeContents['contacts']).contacts as contact, index (index)}
			<li>{contact.office}: {contactKindLabels[contact.kind]} {contact.value}</li>
		{:else}
			<li>(no contacts)</li>
		{/each}
	</ul>
{:else if kind === 'pictures'}
	<ul class="change-pictures">
		{#each (content as ChangeContents['pictures']).pictures as picture (picture.identifier)}
			<li>
				<img src="{pictureBase}/{picture.identifier}" alt={picture.alt} />
				{#if picture.caption || picture.credit}
					<span class="small">{[picture.caption, picture.credit ? `Credit: ${picture.credit}` : null].filter(Boolean).join(' ')}</span>
				{/if}
			</li>
		{:else}
			<li>(no pictures)</li>
		{/each}
	</ul>
{:else if kind === 'hidden'}
	<p>
		{(content as ChangeContents['hidden']).sections.map((section) => hideableSectionLabels[section]).join(', ') || 'Nothing hidden'}
	</p>
{/if}

<style>
	.change-text {
		white-space: pre-wrap;
	}

	.change-pictures {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		padding: 0;
		list-style: none;
	}

	.change-pictures li {
		display: grid;
		gap: var(--space-1);
		max-width: 10rem;
	}

	.change-pictures img {
		width: 8rem;
		height: auto;
	}
</style>
