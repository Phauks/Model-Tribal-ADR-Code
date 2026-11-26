<!--
	@component
	One federal law's, treaty's or executive order's page
	(src/lib/server/law-pages.ts), on the site's one item layout: the law's
	kind, date and citation At a glance, its box's parts as sections, the
	accounts of its impact, where to read it, and where this site cites it.
-->
<script lang="ts">
	import Collapsible from '#lib/components/Collapsible.svelte';
	import ImpactAccounts from '#lib/components/ImpactAccounts.svelte';
	import InfoPage from '#lib/components/InfoPage.svelte';
	import RecordBoxSections from '#lib/components/RecordBoxSections.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.name} · Laws · Model Tribal ADR Code</title>
	<meta name="description" content="{data.name}, {data.citation}: what it did, the accounts of its impact and where to read it." />
</svelte:head>

<InfoPage title={data.name} lead={data.citation} glance={data.glance} sources={data.sources} trail={[{ label: 'Library', href: '/library' }]}>
	{#if data.fullTitle}<p class="full-title muted">{data.fullTitle}</p>{/if}

	<RecordBoxSections sections={data.boxSections} />

	<ImpactAccounts accounts={data.accounts} />

	{#if data.readingHtml}
		<Collapsible heading="Where to read it" identifier="where-to-read" count={data.readingCount}>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- built from the law's own record -->
			<p class="law-reading">{@html data.readingHtml}</p>
		</Collapsible>
	{/if}

	{#if data.essays.length + data.signers.length > 0}
		<Collapsible heading="On this site" identifier="on-this-site" count={data.essays.length + data.signers.length}>
			<dl class="summary-list">
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

<style>
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
</style>
