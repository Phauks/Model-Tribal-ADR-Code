<!--
	@component
	One federal law's, treaty's or executive order's page
	(src/lib/server/law-pages.ts), on the site's one item layout: the law's
	kind, date and citation Key facts (with an order's number and President,
	and the nations whose pages cite it), its box's parts as sections, the
	accounts of its impact, where to read it, the text this site keeps of it,
	and where this site cites it.
-->
<script lang="ts">
	import Collapsible from '#lib/components/Collapsible.svelte';
	import ImpactAccounts from '#lib/components/ImpactAccounts.svelte';
	import InfoPage from '#lib/components/InfoPage.svelte';
	import RecordBoxSections from '#lib/components/RecordBoxSections.svelte';
	import SavedText from '#lib/components/SavedText.svelte';
	import StubBadge from '#lib/components/StubBadge.svelte';
	import TileMap from '#lib/components/TileMap.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let cededMapReady = $state(false);
	/** If the map cannot start it says so in its frame, with Try again (Trevor, 2026-11-27), so the frame shows then too. */
	let cededMapFailed = $state(false);

	/** Past this many, the nation pages wait behind a summary line. */
	const longList = 12;
</script>

{#snippet nationList()}
	{#each data.nations as nation (nation.id)}
		<p><a href="/nations/{nation.id}">{nation.name}</a>{#if nation.what.length > 0}<span class="muted">&nbsp;› {nation.what.join('; ')}</span>{/if}</p>
	{/each}
{/snippet}

{#snippet enactedList()}
	{#each data.enacted as section (section.link)}
		<p><a href={section.link}>{section.label}</a><span class="muted">&nbsp;› {section.heading}</span></p>
	{/each}
{/snippet}

{#snippet sectionRow(section: NonNullable<typeof data.sections>['inForce'][number])}
	<div>
		<dt id={section.anchor}>{#if section.link}<a href={section.link}>{section.label}</a>{:else}{section.label}{/if}</dt>
		<dd>{section.heading}{#if section.act}<span class="muted">&nbsp;› {#if section.act.link}<a href={section.act.link}>{section.act.name}</a>{:else}{section.act.name}{/if}</span>{/if}</dd>
	</div>
{/snippet}

<svelte:head>
	<title>{data.name} · Laws · Tribal Law Project</title>
	<meta name="description" content="{data.name}, {data.citation}: what it did, the accounts of its impact and where to read it." />
</svelte:head>

<!-- The land a treaty ceded, drawn under Key facts (Trevor, 2026-11-26, historic maps mockup 7). Key facts' Land ceded row says the same in words. -->
{#snippet cededMap()}
	{#if data.landCeded}
		<div class="ceded-map no-print" class:ready={cededMapReady || cededMapFailed}>
			<TileMap
				view="lands"
				label="Land ceded by {data.name}"
				data={data.landCeded.map}
				opening={data.landCeded.bounds}
				cessionsShown={data.landCeded.royce}
				cessionsAlways
				onready={() => (cededMapReady = true)}
				onfail={() => (cededMapFailed = true)}
			/>
		</div>
	{/if}
{/snippet}

<InfoPage title={data.name} lead={data.citation} glance={data.glance} panels={data.landCeded ? cededMap : undefined} sources={data.sources} trail={[data.kind === 'state-statute' ? { label: 'Library', href: '/library' } : { label: 'Federal law', href: '/laws' }]} status={data.stub ? stubStatus : undefined}>
	{#if data.fullTitle}<p class="full-title muted">{data.fullTitle}</p>{/if}

	<RecordBoxSections sections={data.boxSections} />

	<ImpactAccounts accounts={data.accounts} />

	{#if data.readingHtml}
		<Collapsible heading="Where to read it" identifier="where-to-read" count={data.readingCount}>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- built from the law's own record -->
			<p class="law-reading">{@html data.readingHtml}</p>
		</Collapsible>
	{/if}

	{#if data.sections}
		<Collapsible heading="Sections" identifier="sections" count={data.sections.inForce.length}>
			<dl class="summary-list section-list">
				{#each data.sections.inForce as section (section.anchor)}
					{@render sectionRow(section)}
				{/each}
			</dl>
			{#if data.sections.notInForce.length > 0}
				<details class="sections-gone">
					<summary>{data.sections.notInForce.length.toLocaleString('en-US')} repealed, transferred or omitted</summary>
					<dl class="summary-list section-list">
						{#each data.sections.notInForce as section (section.anchor)}
							{@render sectionRow(section)}
						{/each}
					</dl>
				</details>
			{/if}
		</Collapsible>
	{/if}

	{#if data.text}<SavedText file={data.text.file} isPdf={data.text.isPdf} name={data.name} identifier="law-text" />{/if}

	{#if data.essays.length + data.nations.length + data.signers.length + data.enacted.length + data.legislativeHistory.length > 0}
		<Collapsible heading="On this site" identifier="on-this-site" count={data.essays.length + data.nations.length + data.signers.length + data.enacted.length + data.legislativeHistory.length}>
			<dl class="summary-list">
				{#if data.enacted.length > 0}
					<div>
						<dt>United States Code</dt>
						<dd>
							{#if data.enacted.length > longList}
								<details>
									<summary>{data.enacted.length.toLocaleString('en-US')} sections of Title 25</summary>
									{@render enactedList()}
								</details>
							{:else}
								{@render enactedList()}
							{/if}
						</dd>
					</div>
				{/if}
				{#if data.legislativeHistory.length > 0}
					<div>
						<dt>Legislative history</dt>
						<dd>
							{#each data.legislativeHistory as document (document.link)}
								<p><a href={document.link}>{document.name}</a><span class="muted">&nbsp;› {document.detail}</span></p>
							{/each}
						</dd>
					</div>
				{/if}
				{#if data.nations.length > 0}
					<div>
						<dt>Nation pages</dt>
						<dd>
							{#if data.nations.length > longList}
								<details>
									<summary>{data.nations.length.toLocaleString('en-US')} nation pages</summary>
									{@render nationList()}
								</details>
							{:else}
								{@render nationList()}
							{/if}
						</dd>
					</div>
				{/if}
				{#if data.essays.length > 0}
					<div>
						<dt>Essays</dt>
						<dd>
							{#each data.essays as essay (essay.link)}
								<p><a href={essay.link}>{essay.title}</a>{#if essay.where}<span class="muted">&nbsp;› {essay.where}</span>{/if}</p>
							{/each}
						</dd>
					</div>
				{/if}
				{#if data.signers.length > 0}
					<div>
						<dt>Signers</dt>
						<dd>
							{#each data.signers as signer (signer.link)}
								<p><a href={signer.link}>{signer.name}</a>{#if signer.detail}<span class="muted">, for {signer.detail}</span>{/if}</p>
							{/each}
						</dd>
					</div>
				{/if}
			</dl>
		</Collapsible>
	{/if}
</InfoPage>

{#snippet stubStatus()}{#if data.stub}<StubBadge stub={data.stub} />{/if}{/snippet}

<style>
	/* The map takes its place once it has drawn, or once it says it could not load, so the page never shows an empty frame. */
	.ceded-map {
		margin-top: var(--space-3);
	}

	.ceded-map:not(.ready) {
		visibility: hidden;
		height: 0;
		overflow: hidden;
	}

	.full-title {
		margin-top: 0;
	}

	.law-reading :global(.reading-list) {
		margin-top: 0;
		font-size: inherit;
	}

	.summary-list dd :global(p) {
		margin: 0;
	}

	/* The row a link from an Act's page lands on, below the sticky header. */
	.section-list dt {
		scroll-margin-top: 4.5rem;
	}

	/* Shaded for a moment, then not (src/lib/arrival-highlight.ts); without scripts, while the address points to it. */
	:global(:root:not([data-scripts='on'])) .section-list dt:target,
	:global(:root:not([data-scripts='on'])) .section-list dt:target + dd,
	.section-list dt:global([data-arrived]),
	.section-list dt:global([data-arrived]) + dd {
		background: var(--color-surface-raised);
	}

	.sections-gone {
		margin-top: 1rem;
	}
</style>
