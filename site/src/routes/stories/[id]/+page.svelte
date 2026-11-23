<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import CitationMarks from '#lib/components/CitationMarks.svelte';
	import Collapsible from '#lib/components/Collapsible.svelte';
	import FactGroups from '#lib/components/FactGroups.svelte';
	import GlancePanel from '#lib/components/GlancePanel.svelte';
	import RecordPage from '#lib/components/RecordPage.svelte';
	import ReviewStatus from '#lib/components/ReviewStatus.svelte';
	import SourceList from '#lib/components/SourceList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const story = $derived(data.story);
	const removal = $derived(
		`/requests?${new URLSearchParams({ kind: 'remove', record: `stories/${story.id}` })
			.toString()
			.replaceAll('%2F', '/')}`
	);
	const quoted = $derived(story.excerpts.filter((excerpt) => excerpt.text));
	const cited = $derived(story.excerpts.filter((excerpt) => !excerpt.text));
	/** The word count of the text shown in full, else the length the record gives (Trevor, Nov. 23, 2026). */
	const length = $derived(
		story.fullText ? `${story.fullText.words.toLocaleString('en-US')} ${story.fullText.words === 1 ? 'word' : 'words'}` : story.length
	);
	const nationNames = $derived(story.nations.map((nation) => nation.name).join(', '));
	/** The story's key facts, for At a glance (site/DESIGN.md, "Record pages"). */
	const glanceFacts = $derived(
		[
			{
				field: 'nations',
				label: story.nations.length === 1 ? 'Nation' : 'Nations',
				items: story.nations.map((nation) => ({ text: nation.name, link: nation.link }))
			},
			{ field: 'community', label: 'Community', items: story.community ? [{ text: story.community }] : [] },
			{ field: 'kind', label: 'Kind', items: [{ text: story.kind }] },
			{ field: 'length', label: 'Length', items: length ? [{ text: length }] : [] },
			{
				field: 'methods',
				label: 'Methods',
				items: story.methods.length > 0 ? [{ text: story.methods.map((method) => method.name).join(', '), badges: story.methods.map((method) => ({ text: method.name, link: method.link })) }] : []
			},
			{ field: 'topics', label: 'Topics', items: story.topics.length > 0 ? [{ text: story.topics.map((topic) => topic.name).join(', '), badges: story.topics.map((topic) => ({ text: topic.name, link: topic.link })) }] : [] }
		].filter((group) => group.items.length > 0)
	);
</script>

<svelte:head>
	<title>{story.title} · Stories · Model Tribal ADR Code</title>
	<meta
		name="description"
		content={story.fullText
			? `${story.kind} from ${nationNames}, in full in the teller’s own words.`
			: `${story.kind} from ${nationNames}, quoted in the teller’s own words with a link to the full telling.`}
	/>
</svelte:head>

<Breadcrumbs trail={[{ label: 'Stories', href: '/stories' }]} />

<!--
	A record page (site/DESIGN.md, "Record pages"): the story itself leads the
	main column, in the teller's words, and its key facts sit in At a glance.
-->
<RecordPage {glance}>
	{#snippet introduction()}
		<h1>{story.title}</h1>
		{#each story.titlesInLanguage as title (title.text)}
			<p class="lead"><span lang={title.language}>{title.text}</span><CitationMarks marks={title.citations} /></p>
		{/each}

		<!-- Where the story stands with the nation: the same status line as a nation's page (src/lib/review-status.ts). -->
		<ReviewStatus status={story.review} description="Review by the nation:" data-print-part="reviewStatus">
			<a class="no-print" href={removal}>Request removal</a>
		</ReviewStatus>
	{/snippet}

	{#if story.fullText}
		<Collapsible heading="Content" identifier="story-heading">
			<p class="small muted">
				{story.fullText.credit} ({story.fullText.locator})<CitationMarks marks={story.fullText.citations} />.
			</p>
			<blockquote class="full-text">
				{#each story.fullText.paragraphs as paragraph, index (index)}
					{#if 'text' in paragraph}
						<p>{paragraph.text}</p>
					{:else}
						<p class="omission small" role="note">[{paragraph.omitted} ({paragraph.locator})]</p>
					{/if}
				{/each}
			</blockquote>
			<p class="small muted">
				About this text: {story.fullText.transcribedFrom}{#each story.fullText.notes as note (note)}{' '}{note}{/each}
			</p>
		</Collapsible>
	{/if}

	{#if quoted.length > 0}
		<Collapsible heading={story.fullText ? 'In other tellings' : 'In the teller’s words'} identifier="excerpts-heading">
			{#each quoted as excerpt, index (index)}
				<blockquote>
					<p>{excerpt.text}</p>
					<footer class="small">{excerpt.credit} ({excerpt.locator})<CitationMarks marks={excerpt.citations} /></footer>
				</blockquote>
			{/each}
		</Collapsible>
	{/if}

	{#if cited.length > 0}
		<Collapsible heading="Passages cited, not quoted" identifier="cited-heading">
			<p>These passages are not quoted here, because the telling is a law, a court opinion or a publication that asks to be asked first. Read them where they were published.</p>
			<ul>
				{#each cited as excerpt, index (index)}
					<li>
						{excerpt.credit}, {excerpt.locator}<CitationMarks marks={excerpt.citations} />{#if excerpt.link}{'. '}<a href={excerpt.link.href}>Read it at {excerpt.link.host}<ExternalLink aria-hidden="true" size="0.85em" class="inline-icon" /></a>{/if}
					</li>
				{/each}
			</ul>
		</Collapsible>
	{/if}

	<Collapsible heading="Source" identifier="tellings-heading">
		{#if story.tellings.length > 1}
			<p>The nation’s own telling is listed first, where there is one.</p>
		{/if}
		<ul class="tellings">
			{#each story.tellings as telling (telling.id)}
				<li>
					<p>
						<strong>{telling.publishedBy ?? telling.teller ?? telling.credit}</strong>{#if telling.date}{', '}{telling.date}{/if}<CitationMarks marks={telling.citations} />
					</p>
					<dl class="summary-list">
						{#if telling.teller && telling.publishedBy}
							<div>
								<dt>Told or written by</dt>
								<dd>{telling.teller}</dd>
							</div>
						{/if}
						<div>
							<dt>Medium</dt>
							<dd>{telling.authority}</dd>
						</div>
						{#if telling.locator}
							<div>
								<dt>Pin cite</dt>
								<dd>{telling.locator}</dd>
							</div>
						{/if}
					</dl>
					{#if telling.link}
						<p><a href={telling.link.href}>Read the full telling at {telling.link.host}<ExternalLink aria-hidden="true" size="0.85em" class="inline-icon" /></a></p>
					{/if}
				</li>
			{/each}
		</ul>
	</Collapsible>

	{#if story.protocols.length > 0}
		<Collapsible heading="Cultural protocols" identifier="protocols-heading">
			<p>What the nation or its people say about how this story, or what it touches, may be shared, and how this site follows it.</p>
			<dl class="summary-list">
				{#each story.protocols as protocol, index (index)}
					<div>
						<dt>{protocol.kind}</dt>
						<dd>
							{protocol.statement}<CitationMarks marks={protocol.citations} />
							{#if protocol.howFollowed}<br /><span class="muted">On this site:</span> {protocol.howFollowed}{/if}
						</dd>
					</div>
				{/each}
			</dl>
		</Collapsible>
	{/if}

	{#snippet sources()}
		<SourceList sources={story.sources} />
	{/snippet}
</RecordPage>

{#snippet glance()}
	<GlancePanel>
		<FactGroups groups={glanceFacts} />
	</GlancePanel>
{/snippet}

<style>
	.full-text p {
		margin: 0 0 var(--space-3);
	}

	.full-text .omission {
		font-style: italic;
	}

	.tellings {
		padding: 0;
		list-style: none;
	}

	.tellings > li {
		margin: var(--space-4) 0;
	}

	.tellings p {
		margin: var(--space-1) 0;
	}

	:global(.inline-icon) {
		margin-left: 0.2em;
		vertical-align: -0.1em;
	}
</style>
