<!--
	@component
	One federal law's, treaty's or executive order's page
	(src/lib/server/law-pages.ts), on the site's one item layout: the law's
	kind, date and citation At a glance (with an order's number and President,
	and the nations whose pages cite it), its box's parts as sections, the
	accounts of its impact, where to read it, the text this site keeps of it,
	and where this site cites it.
-->
<script lang="ts">
	import Collapsible from '#lib/components/Collapsible.svelte';
	import ImpactAccounts from '#lib/components/ImpactAccounts.svelte';
	import InfoPage from '#lib/components/InfoPage.svelte';
	import RecordBoxSections from '#lib/components/RecordBoxSections.svelte';
	import StubBadge from '#lib/components/StubBadge.svelte';
	import StubNote from '#lib/components/StubNote.svelte';
	import TileMap from '#lib/components/TileMap.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let cededMapWanted = $state(true);
	let cededMapReady = $state(false);

	/** Past this many, the nation pages wait behind a summary line. */
	const longList = 12;
</script>

{#snippet nationList()}
	{#each data.nations as nation (nation.id)}
		<p><a href="/nations/{nation.id}">{nation.name}</a>{#if nation.what.length > 0}<span class="muted">&nbsp;› {nation.what.join('; ')}</span>{/if}</p>
	{/each}
{/snippet}

<svelte:head>
	<title>{data.name} · Laws · Model Tribal ADR Code</title>
	<meta name="description" content="{data.name}, {data.citation}: what it did, the accounts of its impact and where to read it." />
</svelte:head>

<!-- The land a treaty ceded, drawn under At a glance (Trevor, 2026-11-26, historic maps mockup 7). With no map on the device, At a glance's Land ceded row says the same in words. -->
{#snippet cededMap()}
	{#if data.landCeded && cededMapWanted}
		<div class="ceded-map no-print" class:ready={cededMapReady}>
			<TileMap
				view="lands"
				label="Land ceded by {data.name}"
				data={data.landCeded.map}
				opening={data.landCeded.bounds}
				cessionsShown={data.landCeded.royce}
				cessionsAlways
				onready={() => (cededMapReady = true)}
				onfail={() => (cededMapWanted = false)}
			/>
		</div>
	{/if}
{/snippet}

<InfoPage title={data.name} lead={data.citation} glance={data.glance} panels={data.landCeded ? cededMap : undefined} sources={data.sources} trail={[{ label: 'Library', href: '/library' }]} status={data.stub ? stubStatus : undefined}>
	{#if data.fullTitle}<p class="full-title muted">{data.fullTitle}</p>{/if}

	<RecordBoxSections sections={data.boxSections} />

	<ImpactAccounts accounts={data.accounts} />

	{#if data.readingHtml}
		<Collapsible heading="Where to read it" identifier="where-to-read" count={data.readingCount}>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- built from the law's own record -->
			<p class="law-reading">{@html data.readingHtml}</p>
		</Collapsible>
	{/if}

	{#if data.text}
		<Collapsible heading="Text" identifier="law-text">
			<!-- Its own block, so the frame takes the width beside At a glance instead of dropping below it. -->
			<div class="law-frame-box">
				{#if data.text.isPdf}
					<iframe class="law-frame" src={data.text.file} title="{data.name} (PDF)" loading="lazy"></iframe>
				{:else}
					<!-- The saved text or web page runs nothing and loads nothing (src/lib/server/public-copy-serving.ts). -->
					<iframe class="law-frame law-frame-text" src={data.text.file} title={data.name} sandbox="" referrerpolicy="no-referrer" loading="lazy"></iframe>
				{/if}
			</div>
		</Collapsible>
	{/if}

	{#if data.essays.length + data.nations.length + data.signers.length > 0}
		<Collapsible heading="On this site" identifier="on-this-site" count={data.essays.length + data.nations.length + data.signers.length}>
			<dl class="summary-list">
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

	{#if data.stub}<StubNote stub={data.stub} />{/if}
</InfoPage>

{#snippet stubStatus()}{#if data.stub}<StubBadge stub={data.stub} />{/if}{/snippet}

<style>
	/* The map takes its place once it has drawn, so a device that cannot draw it never shows an empty frame. */
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

	.law-frame-box {
		display: flow-root;
	}

	.law-frame {
		display: block;
		width: 100%;
		height: 70vh;
		min-height: 24rem;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		background: var(--color-surface-raised);
	}

	/* A short text needs no tall frame. */
	.law-frame-text {
		height: 24rem;
	}
</style>
