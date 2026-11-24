<script lang="ts">
	// A nation's documents that have recorded versions (decision record 0018),
	// oldest version first, with what each version did to the ones before it.
	// No clause summaries or comparisons are shown (Trevor, Nov. 22, 2026).
	// Each version's name links to a public copy of its text where the source
	// has one, and its label ends with the markers of its sources. A heading
	// given by the page, such as "Gaming compact with Arizona", already says
	// what kind of document it is, so the kind is not repeated under it, and a
	// status the sources do not record is left out rather than shown as "Unknown".
	// A document none of whose versions is in effect says how and when it
	// ended, and names what took its place, such as Secretarial Procedures, so
	// a reader can find what governs now (Trevor, Nov. 23, 2026).
	// On a nation's page, a version the nation chose to cite only links to
	// where the original is kept, and one it chose to hide is left out, with
	// a document none of whose versions is left (src/lib/nation-restrictions.ts).
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import type { DocumentHistoryView } from '#lib/server/document-history.ts';
	import { noPageRestrictions, versionItemId, type PageRestrictions } from '#lib/nation-restrictions.ts';
	import CitationMarks from './CitationMarks.svelte';

	let {
		documents,
		restrictions = noPageRestrictions
	}: { documents: (DocumentHistoryView & { heading?: string })[]; restrictions?: PageRestrictions } = $props();

	const idOf = (document: DocumentHistoryView, version: DocumentHistoryView['versions'][number]) => versionItemId(version.link, document.id, version.id);
	const shown = $derived(
		documents
			.map((document) => ({ ...document, versions: document.versions.filter((version) => restrictions.levels[idOf(document, version)] !== 'hide') }))
			.filter((document) => document.versions.length > 0)
	);
</script>

{#each shown as document (document.id)}
	<section class="document-history" aria-labelledby="document-{document.id}">
		<h3 id="document-{document.id}">{document.heading ?? document.title}</h3>
		{#if document.heading}
			{#if document.inEffect}<p class="small muted">In effect: {document.inEffect}.</p>{/if}
		{:else}
			<p class="small muted">
				{document.kind}{#if document.inEffect}. In effect: {document.inEffect}{/if}.
			</p>
		{/if}
		{#if document.ended || document.replacedBy.length > 0}
			<p class="small">
				{#if document.ended}{document.ended}.{/if}
				{#each document.replacedBy as other (other.id)}
					Replaced by <a href="#document-{other.id}">{other.heading}</a>{#if other.inEffect}, in effect{/if}.
				{/each}
			</p>
		{/if}
		{#if document.replaces.length > 0}
			<p class="small muted">
				{#each document.replaces as other (other.id)}
					Took the place of the <a href="#document-{other.id}">{other.heading.charAt(0).toLocaleLowerCase('en-US') + other.heading.slice(1)}</a>.
				{/each}
			</p>
		{/if}
		<ol class="version-list" class:single={document.versions.length === 1}>
			{#each document.versions as version (version.id)}
				{@const id = idOf(document, version)}
				{@const cited = restrictions.levels[id] === 'cite'}
				<li data-restrict-item={id}>
					<p class="version-heading">
						<strong
							>{#if cited}{#if restrictions.originals[id]}<a class="original" href={restrictions.originals[id]} rel="noopener noreferrer"
										>{version.label}<ExternalLink size={14} aria-hidden="true" /></a
									>{:else}{version.label}{/if}{:else if version.link}<a href={version.link}>{version.label}</a>{:else}{version.label}{/if}</strong
						><CitationMarks marks={version.citations} />
						{#if version.inEffect || version.status !== 'Unknown'}
							<span class="version-status" class:in-effect={version.inEffect}
								>{version.inEffect ? 'In effect' : version.status}</span
							>
						{/if}
						<span class="muted small">{version.event}</span>
					</p>
					{#if version.dates}<p class="small">{version.dates}.</p>{/if}
					{#if version.relation}<p class="small">{version.relation}.</p>{/if}
				</li>
			{/each}
		</ol>
	</section>
{/each}

<style>
	.version-list {
		padding-left: var(--space-5);
	}

	.original {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	/* One version needs no number (Trevor, Nov. 23, 2026: no list marks unless it is a real list). */
	.version-list.single {
		padding-left: 0;
		list-style: none;
	}

	.version-list > li + li {
		margin-top: var(--space-3);
	}

	.version-list p {
		margin: 0;
	}

	/* "In effect" is filled; other statuses are outlined, so color is not the only cue. */
	.version-status {
		display: inline-block;
		margin: 0 var(--space-1);
		padding: 0 var(--space-2);
		border: 1px solid var(--color-control-border);
		border-radius: 999px;
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		line-height: 1.5;
		color: var(--color-ink-muted);
	}

	.version-status.in-effect {
		background: var(--color-link);
		border-color: var(--color-link);
		color: var(--color-paper);
	}
</style>
