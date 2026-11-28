<!--
	@component
	A case's opinions, each in a folding section of its own with its writer,
	pages and length, the Opinion of the Court open first (Trevor, Nov. 27,
	2026: readers "should be able to directly read the majority and minority
	opinions of cases on our website"; he chose design B in
	design/case-opinion-reader/ the same day).

	The opinions' text is not in the page: it is read from the copy this site
	serves (src/routes/cases/[id]/opinions.json) when the section comes near
	the screen or a reader opens an opinion. A long opinion shows its first
	part, with a button to show all of it. Without the text (no copy, or the
	copy cannot be read), each opinion keeps its link to where it starts in
	the official report.

	It is only ever the body of the case's Text card (DocumentText.svelte),
	which gives it its section and heading, the copy's header, tools and
	footer, and the official report's scan beside it.
-->
<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import FileText from '@lucide/svelte/icons/file';
	import type { CaseOpinion } from '#lib/server/case-pages.ts';
	import type { CaseOpinionTexts } from '#lib/opinion-text.ts';

	interface Props {
		/** The case's key, for /cases/<key>/opinions.json. */
		caseKey: string;
		opinions: CaseOpinion[];
		/** The page of the served copy that holds the text, for a reader the text could not be read for. */
		copyPage?: string;
	}

	let { caseKey, opinions, copyPage }: Props = $props();

	/** Opinions longer than this show their first part, with a button for the rest. */
	const longOpinion = 600;
	const wordsPerMinute = 230;

	let texts = $state<string[] | undefined>();
	let failed = $state(false);
	let asked = false;
	let shownWhole = $state<Record<number, boolean>>({});
	let section = $state<HTMLElement>();

	function load() {
		if (asked) return;
		asked = true;
		fetch(`/cases/${encodeURIComponent(caseKey)}/opinions.json`)
			.then((response) => (response.ok ? (response.json() as Promise<CaseOpinionTexts>) : Promise.reject(new Error(String(response.status)))))
			.then((answer) => (texts = answer.opinions.map((opinion) => opinion.html)))
			.catch(() => (failed = true));
	}

	$effect(() => {
		if (!section) return;
		// Read once the section is near the screen, so a reader who never scrolls to it does not wait for it.
		const watcher = new IntersectionObserver((entries) => {
			if (entries.some((entry) => entry.isIntersecting)) {
				load();
				watcher.disconnect();
			}
		}, { rootMargin: '800px 0px' });
		watcher.observe(section);
		return () => watcher.disconnect();
	});

	function pages(opinion: CaseOpinion): string {
		if (opinion.page === undefined) return '';
		if (opinion.lastPage === undefined || opinion.lastPage === opinion.page) return `Page ${opinion.page}`;
		return `Pages ${opinion.page}–${opinion.lastPage}`;
	}

	function minutes(words: number): string {
		const total = Math.max(1, Math.round(words / wordsPerMinute));
		if (total < 90) return `About ${total} min`;
		const hours = Math.floor(total / 60);
		const rest = Math.round((total % 60) / 5) * 5;
		return `About ${hours} hr${rest ? ` ${rest} min` : ''}`;
	}

	function textFor(opinion: CaseOpinion): string | undefined {
		return opinion.position === undefined ? undefined : texts?.[opinion.position];
	}
</script>

<div class="case-opinions" bind:this={section}>
	{#each opinions as opinion, index (index)}
		{@const summaryLine = [pages(opinion), opinion.words ? `${opinion.words.toLocaleString('en-US')} words` : ''].filter(Boolean).join(' · ')}
		{@const text = textFor(opinion)}
		{@const clipped = !!opinion.words && opinion.words > longOpinion && !shownWhole[index]}
		<details class="opinion-fold" open={index === 0} ontoggle={(event) => (event.currentTarget as HTMLDetailsElement).open && load()}>
			<summary>
				<span class="fold-mark" aria-hidden="true"><ChevronDown size={20} strokeWidth={2} /></span>
				<h3>{opinion.title}{#if opinion.justice}<span class="writer">{` · ${opinion.justice}`}</span>{/if}</h3>
				{#if summaryLine}<span class="summary-detail">{summaryLine}</span>{/if}
			</summary>
			<p class="opinion-meta">
				{#if opinion.justice}<span>{#if opinion.justiceLink}<a href={opinion.justiceLink}>{opinion.justice}</a>{:else}{opinion.justice}{/if}</span>{/if}
				{#if opinion.words}<span>{minutes(opinion.words)}</span>{/if}
				{#if opinion.link}<a class="opinion-scan" href={opinion.link} title="Page {opinion.page} in the official report"><FileText size={14} strokeWidth={2} aria-hidden="true" />PDF</a>{/if}
			</p>
			{#if opinion.note}<p class="opinion-note">{opinion.note}</p>{/if}
			{#if opinion.position !== undefined}
				{#if text !== undefined}
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- the served copy's text, cleaned to a short list of elements (src/lib/opinion-text.ts) -->
					<div class="opinion-text" class:opinion-clip={clipped}>{@html text}</div>
					{#if clipped}
						<p class="opinion-more"><button type="button" onclick={() => (shownWhole[index] = true)}>Show all {opinion.words?.toLocaleString('en-US')} words</button></p>
					{/if}
				{:else if failed}
					<p class="opinion-note">The text could not be read just now.{#if copyPage} <a href={copyPage}>Read it in the saved copy</a>.{/if}</p>
				{:else}
					<p class="opinion-note" aria-live="polite">Loading the opinion…</p>
				{/if}
			{/if}
		</details>
	{/each}
</div>

<style>
	.opinion-fold {
		border-top: 1px solid var(--color-line);
	}

	.opinion-fold:last-child {
		border-bottom: 1px solid var(--color-line);
	}

	.opinion-fold > summary {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-3);
		padding: var(--space-3) 0;
		min-height: var(--layout-target-minimum);
		cursor: pointer;
	}

	.opinion-fold > summary::-webkit-details-marker {
		display: none;
	}

	.fold-mark {
		display: inline-flex;
		align-self: center;
		transition: transform var(--motion-duration-short) var(--motion-easing-standard);
	}

	.opinion-fold:not([open]) > summary .fold-mark {
		transform: rotate(-90deg);
	}

	.opinion-fold h3 {
		margin: 0;
		font-size: 1.125em;
	}

	.writer {
		font-weight: 400;
	}

	.summary-detail,
	.opinion-meta,
	.opinion-note {
		color: var(--color-ink-muted);
	}

	.summary-detail {
		font-size: 0.875em;
	}

	.opinion-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-4);
		margin: 0 0 var(--space-3);
		font-size: 0.9375em;
	}

	.opinion-scan {
		display: inline-flex;
		align-items: center;
		gap: 0.3em;
		padding: 0.1em 0.5em;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		color: var(--color-ink);
		font-size: 0.875em;
		text-decoration: none;
	}

	.opinion-note {
		margin: 0 0 var(--space-3);
		font-size: 0.875em;
	}

	.opinion-text {
		max-width: var(--layout-measure);
		font-family: var(--font-family-reading);
		line-height: var(--font-line-height-reading);
	}

	.opinion-text :global(p) {
		margin: 0 0 var(--space-3);
	}

	.opinion-text :global(.opinion-author) {
		font-variant: small-caps;
		letter-spacing: 0.02em;
	}

	.opinion-text :global(blockquote) {
		margin: 0 0 var(--space-3);
		padding: 0 0 0 var(--space-4);
		border-left: 4px solid var(--color-line);
	}

	.opinion-text :global(.page-mark) {
		display: inline-block;
		margin: 0 0.3em;
		padding: 0 0.45em;
		border: 1px solid var(--color-line);
		border-radius: 999px;
		color: var(--color-ink-muted);
		font-size: 0.75em;
		line-height: 1.4;
		vertical-align: 0.1em;
	}

	.opinion-text :global(aside.footnote) {
		margin: var(--space-3) 0;
		padding-top: var(--space-2);
		border-top: 1px solid var(--color-line);
		color: var(--color-ink-muted);
		font-size: 0.875em;
	}

	.opinion-text :global(img) {
		max-width: 100%;
		height: auto;
	}

	.opinion-clip {
		position: relative;
		max-height: 30rem;
		overflow: hidden;
	}

	.opinion-clip::after {
		content: '';
		position: absolute;
		right: 0;
		bottom: 0;
		left: 0;
		height: 6rem;
		background: linear-gradient(transparent, var(--color-paper));
	}

	.opinion-more {
		margin: var(--space-2) 0 var(--space-4);
	}

	.opinion-more button {
		min-height: var(--layout-target-minimum);
		padding: var(--space-1) var(--space-3);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: none;
		color: var(--color-link);
		font: inherit;
		cursor: pointer;
	}

	@media print {
		.opinion-clip {
			max-height: none;
		}

		.opinion-clip::after,
		.opinion-more {
			display: none;
		}
	}
</style>
