<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import CitationMarks from '#lib/components/CitationMarks.svelte';
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
	const nationNames = $derived(story.nations.map((nation) => nation.name).join(', '));
</script>

<svelte:head>
	<title>{story.title} · Stories · Model Tribal ADR Code</title>
	<meta name="description" content="{story.kind} from {nationNames}, quoted in the teller’s own words with a link to the full telling." />
</svelte:head>

<nav aria-label="Breadcrumb" class="small">
	<a href="/stories">Stories</a> › {story.title}
</nav>

<div class="reading">
	<h1>{story.title}</h1>
	{#each story.titlesInLanguage as title (title.text)}
		<p class="lead"><span lang={title.language}>{title.text}</span><CitationMarks marks={title.citations} /></p>
	{/each}

	{#if story.awaitsReview}
		<div class="notice" role="note">
			<p>
				<strong>Not yet reviewed by the nation.</strong> {nationNames} {story.nations.length === 1 ? 'has' : 'have'} not reviewed this page. It is shown while the nation is asked to review it. If this story should not be here, <a href={removal}>ask for it to be removed</a>. It is taken out of public view before the request is reviewed.
			</p>
		</div>
	{:else}
		<p class="small no-print">Should this story not be here? <a href={removal}>Ask for it to be removed</a>.</p>
	{/if}

	<dl class="summary-list">
		<div>
			<dt>{story.nations.length === 1 ? 'Nation' : 'Nations'}</dt>
			<dd>
				{#each story.nations as nation, index (nation.id)}
					{#if index > 0}, {/if}{#if nation.link}<a href={nation.link}>{nation.name}</a>{:else}{nation.name}{/if}
				{/each}
			</dd>
		</div>
		{#if story.community}
			<div>
				<dt>Community</dt>
				<dd>{story.community}</dd>
			</div>
		{/if}
		<div>
			<dt>Kind</dt>
			<dd>{story.kind}</dd>
		</div>
		{#if story.length}
			<div>
				<dt>Length of the telling</dt>
				<dd>{story.length}</dd>
			</div>
		{/if}
		{#if story.methods.length > 0}
			<div>
				<dt>Ways of resolving disputes</dt>
				<dd>{story.methods.join(', ')}</dd>
			</div>
		{/if}
		{#if story.topics.length > 0}
			<div>
				<dt>Topics</dt>
				<dd>{story.topics.join(', ')}</dd>
			</div>
		{/if}
	</dl>

	{#if quoted.length > 0}
		<h2>In the teller’s words</h2>
		{#each quoted as excerpt, index (index)}
			<blockquote>
				<p>{excerpt.text}</p>
				<footer class="small">{excerpt.credit} ({excerpt.locator})<CitationMarks marks={excerpt.citations} /></footer>
			</blockquote>
		{/each}
	{/if}

	{#if cited.length > 0}
		<h2>Passages cited, not quoted</h2>
		<p>These passages are not quoted here, because the telling is a law, a court opinion or a publication that asks to be asked first. Read them where they were published.</p>
		<ul>
			{#each cited as excerpt, index (index)}
				<li>
					{excerpt.credit}, {excerpt.locator}<CitationMarks marks={excerpt.citations} />{#if excerpt.link}{'. '}<a href={excerpt.link.href}>Read it at {excerpt.link.host}<ExternalLink aria-hidden="true" size="0.85em" class="inline-icon" /></a>{/if}
				</li>
			{/each}
		</ul>
	{/if}

	<h2>Where it is told</h2>
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
						<dt>Whose voice</dt>
						<dd>{telling.authority}</dd>
					</div>
					{#if telling.locator}
						<div>
							<dt>Where in it</dt>
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

	{#if story.protocols.length > 0}
		<h2>Cultural protocols</h2>
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
	{/if}

	<SourceList sources={story.sources} />
</div>

<style>
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
