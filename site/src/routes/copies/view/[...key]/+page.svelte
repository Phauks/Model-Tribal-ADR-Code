<!--
	@component
	A copy's own page, on the site's item layout (Trevor chose design B on
	Nov. 27, 2026, design/document-text/ in the project files): its title and
	citation, then the copy in the same Text card as every law's and case's
	page (DocumentText.svelte), and where else to read it, its original
	publisher first.
-->
<script lang="ts">
	import { courtPagePath } from '#lib/court-pages.ts';
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import Collapsible from '#lib/components/Collapsible.svelte';
	import DocumentText from '#lib/components/DocumentText.svelte';
	import RecordPage from '#lib/components/RecordPage.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const details = $derived(data.details);
	const opinion = $derived(details?.opinion);
	const italic = $derived(Boolean(opinion || details?.isCase));
	const nations = $derived(details?.nations ?? []);
</script>

<svelte:head>
	<title>{data.title} · Source documents · Tribal Law Project</title>
</svelte:head>

<Breadcrumbs
	trail={[
		{ label: 'Source documents', href: '/copies' },
		...(details ? [{ label: details.list.title, href: `/copies/list/${details.list.slug}` }] : [])
	]}
	current={data.title}
/>

<RecordPage>
	{#snippet title()}<h1>{#if italic}<i>{data.title}</i>{:else}{data.title}{/if}</h1>{/snippet}
	{#snippet introduction()}
		{#if opinion}
			<p class="lead">
				{opinion.citation} (<a href={courtPagePath(opinion.court)}>{opinion.court}</a>{data.decidedText ? `, decided ${data.decidedText}` : ''}){#if opinion.docket}<span class="small muted">
						· Docket {opinion.docket}</span
					>{/if}{#if nations.length > 0}<span class="lead-facts">{' · '}{nations.length === 1 ? 'Nation' : 'Nations'}{' '}{#each nations as nation, index (nation.id)}{index > 0 ? '; ' : ''}<a href="/nations/{nation.id}">{nation.name}</a>{/each}</span>{/if}
			</p>
		{:else if details?.citation || nations.length > 0}
			<!-- How the project cites it (Trevor, Nov. 24, 2026: "we should include more info, such as the citation on this page"). -->
			<p class="lead citation">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- the project's own citation, built at build time from its source records -->
				{#if details?.citation}{@html details.citation}{/if}{#if nations.length > 0}<span class="lead-facts"
						>{details?.citation ? ' · ' : ''}{nations.length === 1 ? 'Nation' : 'Nations'}{' '}{#each nations as nation, index (nation.id)}{index > 0 ? '; ' : ''}<a href="/nations/{nation.id}">{nation.name}</a>{/each}</span
					>{/if}{#if details?.casePage}<a class="case-link small" href={details.casePage}>Case page</a>{/if}
			</p>
		{/if}
	{/snippet}

	<DocumentText file={data.file} identifier="text" name={data.title} {italic} citation={opinion?.citation} citeOnly={data.citeOnly} original={data.original} />

	{#if data.original}
		<Collapsible heading="Where to read it" identifier="where-to-read" count={1}>
			<p class="reading-list copy-reading"><span class="reading-line"><a href={data.original.link} rel="noopener noreferrer">{data.original.name.replace(/^the /, '').replace(/^./, (first) => first.toUpperCase())}</a></span></p>
		</Collapsible>
	{/if}
</RecordPage>

<style>
	h1 {
		overflow-wrap: anywhere;
	}

	.lead {
		margin-top: 0;
	}

	.lead-facts {
		color: var(--color-ink-muted);
	}

	.citation .case-link {
		margin-left: var(--space-3);
		white-space: nowrap;
	}

	.copy-reading {
		margin-top: 0;
		font-size: inherit;
	}
</style>
