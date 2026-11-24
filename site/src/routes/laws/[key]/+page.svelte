<!--
	@component
	One federal law's, treaty's or executive order's page
	(src/lib/server/law-pages.ts), on the site's one item layout: the law's
	kind, date and citation At a glance, its box's parts as sections, the
	accounts of its impact, where to read it, and where this site cites it.
-->
<script lang="ts">
	import CountBadge from '#lib/components/CountBadge.svelte';
	import ImpactAccounts from '#lib/components/ImpactAccounts.svelte';
	import InfoPage from '#lib/components/InfoPage.svelte';
	import { quoteContext } from '#lib/essays/quote-context-view.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.name} · Laws · Model Tribal ADR Code</title>
	<meta name="description" content="{data.name}, {data.citation}: what it did, the accounts of its impact and where to read it." />
</svelte:head>

<InfoPage title={data.name} lead={data.citation} glance={data.glance} sources={data.sources} trail={[{ label: 'Library', href: '/library' }]}>
	{#if data.fullTitle}<p class="full-title muted">{data.fullTitle}</p>{/if}

	{#if data.bodyHtml}
		<div class="essay-text law-body" use:quoteContext={data.bodyHtml}>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- built from the repository's own Markdown -->
			{@html data.bodyHtml}
		</div>
	{/if}

	<ImpactAccounts accounts={data.accounts} />

	{#if data.readingHtml}
		<section aria-labelledby="where-to-read">
			<h2 id="where-to-read">Where to read it <CountBadge count={data.readingCount} /></h2>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- built from the law's own record -->
			<p class="law-reading">{@html data.readingHtml}</p>
		</section>
	{/if}

	{#if data.essays.length > 0}
		<section aria-labelledby="on-this-site">
			<h2 id="on-this-site">On this site <CountBadge count={data.essays.length} /></h2>
			<dl class="summary-list">
				<div>
					<dt>Essays</dt>
					<dd>
						{#each data.essays as essay (essay.link)}
							<p><a href={essay.link}>{essay.title}</a>{#if essay.where}<span class="muted">&nbsp;› {essay.where}</span>{/if}</p>
						{/each}
					</dd>
				</div>
			</dl>
		</section>
	{/if}
</InfoPage>

<style>
	.full-title {
		margin-top: 0;
	}

	.law-body :global(.essay-case-part > .essay-block-label) {
		display: none;
	}

	.law-body :global(.essay-case-part) {
		margin: 0;
		padding: 0;
		border: none;
	}

	.law-reading :global(.reading-list) {
		margin-top: 0;
		font-size: inherit;
	}

	.summary-list dd :global(p) {
		margin: 0;
	}
</style>
