<!--
	MOCKUP (thread "Give every case its own page", Nov. 24, 2026): a page for
	one court case (src/lib/server/case-pages.ts). Not for merging as it stands.
-->
<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import GlancePanel from '#lib/components/GlancePanel.svelte';
	import RecordPage from '#lib/components/RecordPage.svelte';
	import SourceList from '#lib/components/SourceList.svelte';
	import TopicBadges from '#lib/components/TopicBadges.svelte';
	import { quoteContext } from '#lib/essays/quote-context-view.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const trail = $derived(
		data.court
			? [
					{ label: 'Library', href: '/library' },
					{ label: 'Supreme Court', href: '/supreme-court' },
					{ label: data.court.name, href: data.court.link }
				]
			: [{ label: 'Library', href: '/library' }]
	);
	const citedCount = $derived(data.essays.length + data.nationPages.length + (data.court ? 1 : 0));
</script>

<svelte:head>
	<title>{data.name} · Cases · Model Tribal ADR Code</title>
</svelte:head>

<Breadcrumbs {trail} />

<RecordPage {glance}>
	{#snippet introduction()}
		<h1><i>{data.name}</i></h1>
		<p class="lead case-citation">{data.citation}</p>
		{#if data.topics.length > 0}<div class="badge-line"><TopicBadges topics={data.topics.map((text) => ({ text }))} /></div>{/if}
	{/snippet}

	<div class="essay-text case-body" use:quoteContext={data.bodyHtml}>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- built from the repository's own Markdown -->
		{@html data.bodyHtml}
	</div>

	{#if data.caption || data.nations.length > 0}
		<section aria-labelledby="parties">
			<h2 id="parties">Parties and nations</h2>
			<dl class="summary-list">
				{#if data.caption}
					<div>
						<dt>Caption</dt>
						<dd>{data.caption}</dd>
					</div>
				{/if}
				{#each data.nations as nation (nation.id)}
					<div>
						<dt><a href="/nations/{nation.id}">{nation.name}</a></dt>
						<dd>{nation.role}{#if nation.namedAs}<span class="muted">, named as {nation.namedAs}</span>{/if}</dd>
					</div>
				{/each}
			</dl>
			{#if data.nationNote}<p class="small muted">{data.nationNote}</p>{/if}
		</section>
	{/if}

	<section aria-labelledby="where-to-read">
		<h2 id="where-to-read">Where to read it <CountBadge count={data.readingCount} /></h2>
		<dl class="summary-list">
			{#if data.savedCopy}
				<div>
					<dt>Saved copy</dt>
					<dd><a href={data.savedCopy.page}>{data.savedCopy.what}</a> <span class="muted">·</span> <a href={data.savedCopy.verify}>SHA-256</a></dd>
				</div>
			{/if}
			{#each data.readingGroups as group (group.label)}
				<div>
					<dt>{group.label}</dt>
					<dd>
						{#each group.links as link, index (link.link)}{#if index > 0}<span class="muted">&nbsp;· </span>{/if}<a href={link.link}>{link.label}</a
							>{#if link.access === 'subscription'}<span class="muted" title="Subscription">&nbsp;$</span>{/if}{/each}
					</dd>
				</div>
			{/each}
		</dl>
	</section>

	<section aria-labelledby="on-this-site">
		<h2 id="on-this-site">On this site <CountBadge count={citedCount} /></h2>
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
			{#if data.nationPages.length > 0}
				<div>
					<dt>Nation pages</dt>
					<dd>
						{#each data.nationPages as nation (nation.link)}<p><a href={nation.link}>{nation.name}</a></p>{/each}
					</dd>
				</div>
			{/if}
			{#if data.court}
				<div>
					<dt>Supreme Court</dt>
					<dd><a href="{data.court.link}#cases">{data.court.name}</a></dd>
				</div>
			{/if}
		</dl>
	</section>

	{#snippet sources()}<SourceList sources={data.sources} />{/snippet}
</RecordPage>

{#snippet glance()}
	<GlancePanel>
		<dl class="summary-list glance-facts">
			{#each data.facts as [label, html] (label)}
				<div>
					<dt>{label}</dt>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- built from the case's own record -->
					<dd>{@html html}</dd>
				</div>
			{/each}
		</dl>
	</GlancePanel>
{/snippet}

<style>
	.case-citation {
		margin-top: calc(-1 * var(--space-2));
	}

	.case-body :global(.essay-case-part > .essay-block-label) {
		display: none;
	}

	.case-body :global(.essay-case-part) {
		margin: 0;
		padding: 0;
		border: none;
	}

	.case-body :global(figure) {
		max-width: var(--layout-measure);
	}

	.summary-list dd :global(p) {
		margin: 0;
	}

	.glance-facts {
		margin: 0;
	}
</style>
