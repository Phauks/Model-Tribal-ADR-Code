<!--
	@component
	One court case's page (src/lib/server/case-pages.ts; Trevor approved the
	mockup on Nov. 24, 2026, design/case-pages/). A record page: the case's
	facts in At a glance, its box's parts as sections, then its opinions, the
	parties and nations, where to read it, and where this site cites it.
	Every section folds (Collapsible.svelte).
-->
<script lang="ts">
	import Clock from '@lucide/svelte/icons/clock';
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import Collapsible from '#lib/components/Collapsible.svelte';
	import GlancePanel from '#lib/components/GlancePanel.svelte';
	import ImpactAccounts from '#lib/components/ImpactAccounts.svelte';
	import RecordBoxSections from '#lib/components/RecordBoxSections.svelte';
	import RecordPage from '#lib/components/RecordPage.svelte';
	import SavedText from '#lib/components/SavedText.svelte';
	import SourceList from '#lib/components/SourceList.svelte';
	import StubBadge from '#lib/components/StubBadge.svelte';
	import StubNote from '#lib/components/StubNote.svelte';
	import TopicBadges from '#lib/components/TopicBadges.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const trail = $derived([
		{ label: 'Library', href: '/library' },
		...(data.court
			? [
					{ label: 'Supreme Court', href: '/supreme-court' },
					{ label: data.court.name, href: data.court.link }
				]
			: [])
	]);
	const nationPageLinks = $derived(new Set(data.nationPages.map((nation) => nation.link)));
	const citedCount = $derived(data.essays.length + data.nationPages.length + (data.court ? 1 : 0) + (data.decidedBy ? 1 : 0));
</script>

<svelte:head>
	<title>{data.name} · Cases · Model Tribal ADR Code</title>
	<meta name="description" content="{data.name}, {data.citation}: what the court decided, its opinions, the nations it names and where to read it." />
</svelte:head>

<Breadcrumbs {trail} />

<RecordPage glance={data.facts.length > 0 ? glance : undefined}>
	{#snippet title()}<h1><i>{data.name}</i></h1>{/snippet}
	{#snippet introduction()}
		{#if data.citation}<p class="lead case-citation">{data.citation}</p>{/if}
		{#if data.topics.length > 0 || data.unverified || data.stub}<div class="badge-line">{#if data.stub}<StubBadge stub={data.stub} />{/if}{#if data.unverified}<span class="review-badge"><Clock size={16} strokeWidth={2} aria-hidden="true" />Unverified</span>{/if}{#if data.topics.length > 0}<TopicBadges topics={data.topics.map((text) => ({ text }))} />{/if}</div>{/if}
	{/snippet}

	<RecordBoxSections sections={data.boxSections} />

	{#if data.opinions.length > 0}
		<Collapsible heading="Opinions" identifier="opinions" count={data.opinions.length}>
			<dl class="summary-list">
				{#each data.opinions as opinion, index (index)}
					<div>
						<dt>{opinion.title}</dt>
						<dd>
							{#if opinion.justiceLink}<a href={opinion.justiceLink}>{opinion.justice}</a>{:else}{opinion.justice}{/if}{#if opinion.page}{opinion.justice ? ', ' : ''}{#if opinion.link}<a href={opinion.link}>starting at page {opinion.page}</a>{:else}starting at page {opinion.page}{/if}{/if}
							{#if opinion.note}<span class="fact-detail muted small">{opinion.note}</span>{/if}
						</dd>
					</div>
				{/each}
			</dl>
		</Collapsible>
	{/if}

	{#if data.caption || data.nations.length > 0 || data.people.length > 0}
		<Collapsible heading={data.people.length > 0 ? 'Parties, people and nations' : 'Parties and nations'} identifier="parties">
			<dl class="summary-list">
				{#if data.caption}
					<div>
						<dt>Caption</dt>
						<dd>{data.caption}</dd>
					</div>
				{/if}
				{#each data.people as person (person.link)}
					<div>
						<dt><a href={person.link}>{person.name}</a></dt>
						<dd>{person.role}</dd>
					</div>
				{/each}
				{#each data.nations as nation (nation.id)}
					<div>
						<dt>{#if nationPageLinks.has(`/nations/${nation.id}`)}<a href="/nations/{nation.id}">{nation.name}</a>{:else}{nation.name}{/if}</dt>
						<dd>
							{nation.role}{#if nation.namedAs}<span class="muted">, named as {nation.namedAs}</span>{/if}
							{#if nation.note}<span class="fact-detail muted small">{nation.note}</span>{/if}
						</dd>
					</div>
				{/each}
			</dl>
			{#if data.nationNote}<p class="small muted">{data.nationNote}</p>{/if}
		</Collapsible>
	{/if}

	<ImpactAccounts accounts={data.accounts} />

	{#if data.readingHtml}
		<Collapsible heading="Where to read it" identifier="where-to-read" count={data.readingCount}>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- built from the case's own record -->
			<p class="case-reading">{@html data.readingHtml}</p>
		</Collapsible>
	{/if}

	{#if data.text}<SavedText file={data.text.file} isPdf={data.text.isPdf} name={data.name} identifier="case-text" />{/if}

	{#if citedCount > 0}
		<Collapsible heading="On this site" identifier="on-this-site" count={citedCount}>
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
				{#if data.decidedBy}
					<div>
						<dt>Court</dt>
						<dd><a href={data.decidedBy.link}>{data.decidedBy.name}</a></dd>
					</div>
				{/if}
			</dl>
		</Collapsible>
	{/if}

	{#if data.stub}<StubNote stub={data.stub} />{/if}

	{#snippet sources()}<SourceList sources={data.sources} />{/snippet}
</RecordPage>

{#snippet glance()}
	<GlancePanel>
		<dl class="summary-list glance-facts">
			{#each data.facts as [label, html] (label)}
				<div>
					<dt>{label}</dt>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- built from the case's own record (case-facts.ts) -->
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

	/* The places to read it, open, with the rule down their left side as under a citation. */
	.case-reading :global(.reading-list) {
		margin-top: 0;
		font-size: inherit;
	}

	.summary-list dd :global(p) {
		margin: 0;
	}

	.summary-list .fact-detail {
		display: block;
	}

	.glance-facts {
		margin: 0;
	}
</style>
