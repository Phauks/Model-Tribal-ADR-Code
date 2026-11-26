<!--
	@component
	The one page layout for an item on the site, as a wiki's article with its
	infobox (Trevor, Nov. 24, 2026: "We should create and use a generalized
	wiki info page for all items"). It puts together the parts every item page
	shares, so a person, a court, a case or an office reads alike: the
	breadcrumbs, the title with any other names and a one-line lead, a status
	badge, At a glance (a picture with its credit, then the key facts, each
	with its source markers), the page's own sections, and References.

	It builds on RecordPage, which lays the parts out (site/DESIGN.md, "Record
	pages"); a page with needs of its own, such as a nation's map, can still use
	RecordPage directly.

	Use:
	<InfoPage title={data.name} lead={data.summary} picture={data.portrait} glance={data.glance} sources={data.sources} {trail}>
		<section aria-labelledby="cases"><h2 id="cases">Cases</h2>…</section>
	</InfoPage>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { InfoName, InfoPicture } from '#lib/info-page.ts';
	import { imageViewerAttributes } from '#lib/image-viewer.ts';
	import Breadcrumbs from './Breadcrumbs.svelte';
	import CitationMarks from './CitationMarks.svelte';
	import FactGroups from './FactGroups.svelte';
	import GlancePanel from './GlancePanel.svelte';
	import RecordPage from './RecordPage.svelte';
	import SourceList from './SourceList.svelte';

	interface Props {
		title: string;
		/** One line under the title, such as "Chief Justice, 1801–1835". */
		lead?: string;
		names?: InfoName[];
		trail?: { label: string; href: string }[];
		picture?: InfoPicture;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- FactGroups' own type
		glance?: any[];
		/** Short panels under At a glance, such as contacts. */
		panels?: Snippet;
		/** A status badge beside the title, such as "Unverified". */
		status?: Snippet;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- SourceList's own type
		sources?: any[];
		children?: Snippet;
	}

	let { title: titleText, lead, names = [], trail, picture, glance = [], panels, status, sources = [], children }: Props = $props();
	// The panel's picture snippet shares the prop's name.
	const pictureView = $derived(picture);
	const hasGlance = $derived(picture !== undefined || glance.length > 0 || panels !== undefined);
</script>

{#if trail}<Breadcrumbs {trail} />{/if}

<RecordPage glance={hasGlance ? glancePart : undefined} sources={sources.length > 0 ? sourcesPart : undefined}>
	{#snippet title()}<h1>{titleText}</h1>{/snippet}
	{#snippet introduction()}
		{#if names.length > 0}
			<p class="other-names">
				{#each names as other, index (other.name)}{#if index > 0}{'; '}{/if}<span lang={other.language ?? 'und'}><strong>{other.name}</strong></span>{#if other.note}<span class="muted">, {other.note}</span>{/if}<CitationMarks marks={other.citations ?? []} />{/each}
			</p>
		{/if}
		{#if lead}<p class="lead">{lead}</p>{/if}
		{#if status}<div class="info-status">{@render status()}</div>{/if}
	{/snippet}

	{@render children?.()}
</RecordPage>

{#snippet glancePart()}
	<GlancePanel>
		{#snippet picture()}
			{#if pictureView}
				<figure class="info-picture">
					<a href={pictureView.src} {...imageViewerAttributes(pictureView.alt, { title: titleText, credit: pictureView.credit, original: pictureView.original })}>
						<img src={pictureView.src} alt={pictureView.alt} width={pictureView.width} height={pictureView.height} loading="lazy" decoding="async" />
					</a>
					{#if pictureView.credit}
						<figcaption class="small muted">{#if pictureView.original}<a href={pictureView.original}>{pictureView.credit}</a>{:else}{pictureView.credit}{/if}</figcaption>
					{/if}
				</figure>
			{/if}
		{/snippet}
		{#if glance.length > 0}<div class="facts"><FactGroups groups={glance} /></div>{/if}
	</GlancePanel>
	{@render panels?.()}
{/snippet}

{#snippet sourcesPart()}
	<SourceList {sources} />
{/snippet}

<style>
	.other-names {
		margin-top: calc(-1 * var(--space-2));
	}

	.info-status {
		margin-top: var(--space-2);
	}

	.info-picture {
		margin: 0 0 var(--space-3);
		text-align: center;
	}

	.info-picture a:has(img) {
		display: block;
		width: fit-content;
		margin: 0 auto;
		border-radius: var(--radius-control);
		cursor: zoom-in;
	}

	.info-picture img {
		display: block;
		width: auto;
		height: auto;
		max-width: min(12rem, 100%);
		max-height: 15rem;
		border-radius: var(--radius-control);
	}

	.info-picture figcaption {
		margin-top: var(--space-2);
	}

	/* A source mark wide enough to be a full target whatever font draws it (axe-core target-size). */
	.facts :global(.summary-list .note-marker) {
		padding-left: 3px;
	}
</style>
