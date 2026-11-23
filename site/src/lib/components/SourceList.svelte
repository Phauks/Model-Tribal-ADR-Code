<script lang="ts">
	// The Sources section at the end of a page: each source once, numbered in
	// the order the page first cites it, with every fact on the page it
	// supports (src/lib/server/source-uses.ts). As on Wikipedia, the number
	// links back to the place in the text that cites the source; a source
	// cited in several places also gets a letter for each, a, b, c
	// (Trevor, Nov. 22, 2026). The glossary pages use it too, with each entry
	// in place of a fact. After z the letters go on aa, ab; the accessible
	// name keeps a space before them, so "ab" is a word of it, as WCAG 2.5.3
	// (label in name) asks.
	//
	// To keep the section short (Trevor chose this on Nov. 23, 2026): each
	// source is one row, with its letters on a "Cited 7 times" line under the
	// citation; the facts each source supports wait behind "Show what each
	// source supports"; and a long list folds into groups by the part of the
	// page that first cites each source (src/lib/source-groups.ts). Without
	// scripts the facts show and the groups still open, since they are the
	// browser's own <details>. Printing opens every group (PrintOptions.svelte)
	// and prints every fact.
	import { onMount } from 'svelte';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronsDownUp from '@lucide/svelte/icons/chevrons-down-up';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import { backlinkLetter, sourceAnchor } from '#lib/citation-marks.ts';
	import type { SourceEntry } from '#lib/server/source-uses.ts';
	import { rangesText, sourceGroups } from '#lib/source-groups.ts';
	import Collapsible from './Collapsible.svelte';

	// Trevor asked on Nov. 22, 2026 that the section carry no sentence explaining it.
	let { sources }: { sources: SourceEntry[] } = $props();

	const groups = $derived(sourceGroups(sources));
	let showFacts = $state(false);
	let openGroups = $state(0);
	let groupList: HTMLElement | undefined = $state();

	const groupElements = () => [...(groupList?.querySelectorAll<HTMLDetailsElement>('details.source-group') ?? [])];

	function countOpen(): void {
		openGroups = groupElements().filter((group) => group.open).length;
	}

	function openOrFoldAll(): void {
		const open = openGroups < (groups?.length ?? 0);
		for (const group of groupElements()) group.open = open;
		countOpen();
	}

	/**
	 * Opens the folded sections around a source or a marker before the page
	 * goes to it, so a marker, a link back, or "See it in the Sources list"
	 * never lands on a closed group.
	 */
	function reveal(id: string): void {
		if (!/^(source|cite)-/.test(id)) return;
		let folded = document.getElementById(id)?.parentElement?.closest('details');
		while (folded) {
			folded.open = true;
			folded = folded.parentElement?.closest('details');
		}
	}

	onMount(() => {
		// "Sources groups: Open" in Settings, under Citations (src/lib/reading-settings.ts).
		if (document.documentElement.dataset.sourceGroups === 'open') {
			for (const group of groupElements()) group.open = true;
			countOpen();
		}
		const fromHash = () => reveal(decodeURIComponent(location.hash.slice(1)));
		const onClick = (event: MouseEvent) => {
			const link = (event.target as Element | null)?.closest?.('a[href^="#"]');
			if (link instanceof HTMLAnchorElement) reveal(decodeURIComponent(link.hash.slice(1)));
		};
		fromHash();
		window.addEventListener('hashchange', fromHash);
		// Capture, so the section is open before the browser scrolls to the target.
		document.addEventListener('click', onClick, true);
		return () => {
			window.removeEventListener('hashchange', fromHash);
			document.removeEventListener('click', onClick, true);
		};
	});
</script>

{#snippet entry(source: SourceEntry)}
	<li id={sourceAnchor(source.number)}>
		<span class="source-backlinks"
			>{#if source.backlinks.length > 0}<a
					class="source-number"
					href="#{source.backlinks[0]}"
					aria-label="Source {source.number}: back to {source.backlinks.length > 1
						? 'the first place'
						: 'the place'} it is cited">{source.number}</a
				>{:else}<span class="source-number">{source.number}</span>{/if}</span
		>
		{@html source.html}
		{#if source.backlinks.length > 1}
			<span class="source-cited no-print"
				>Cited {source.backlinks.length} times:{#each source.backlinks as backlink, index (backlink)}{' '}<a
						class="source-letter"
						href="#{backlink}"
						aria-label="Back to citation {source.number} {backlinkLetter(index)}">{backlinkLetter(index)}</a
					>{/each}</span
			>
		{/if}
		<ul class="source-uses">
			{#each source.groups as group, index (index)}
				<li>
					<span class="source-use-section">{group.section}</span>{#if group.where}{' '}<span class="muted"
							>({group.where})</span
						>{/if}: {group.facts.join('; ')}
				</li>
			{/each}
		</ul>
	</li>
{/snippet}

{#if sources.length > 0}
	<div class="notes" class:showing-facts={showFacts} data-print-part="sources">
		<Collapsible heading="Sources" identifier="sources-heading" count={sources.length}>
			<div class="source-tools needs-scripts no-print">
				{#if groups}
					<!-- The open and close symbols, not words (Trevor, Nov. 23, 2026). -->
					{@const allOpen = openGroups === groups.length}
					<button
						class="icon-button"
						type="button"
						aria-label={allOpen ? 'Close all groups' : 'Open all groups'}
						title={allOpen ? 'Close all groups' : 'Open all groups'}
						onclick={openOrFoldAll}
					>
						{#if allOpen}<ChevronsDownUp size={20} aria-hidden="true" />{:else}<ChevronsUpDown size={20} aria-hidden="true" />{/if}
					</button>
				{/if}
				<button class="text-button" type="button" aria-pressed={showFacts} onclick={() => (showFacts = !showFacts)}
					>Show what each source supports</button
				>
			</div>
			{#if groups}
				<div class="source-groups" bind:this={groupList}>
					{#each groups as group (group.part)}
						<details class="source-group" ontoggle={countOpen}>
							<summary>
								<span class="fold-mark no-print"><ChevronDown size={20} /></span>
								<span class="source-group-name">{group.part}</span>
								<span class="source-group-count"
									>{group.sources.length}
									{group.sources.length === 1 ? 'source' : 'sources'} ·
									<span aria-hidden="true">{rangesText(group.ranges)}</span><span class="visually-hidden"
										>numbered {rangesText(group.ranges, ' to ')}</span
									></span
								>
							</summary>
							{#each group.subgroups as subgroup, index (index)}
								{#if subgroup.label}<p class="source-subgroup">{subgroup.label}</p>{/if}
								<ol class="source-list">
									{#each subgroup.sources as source (source.key)}{@render entry(source)}{/each}
								</ol>
							{/each}
						</details>
					{/each}
				</div>
			{:else}
				<ol class="source-list">
					{#each sources as source (source.key)}{@render entry(source)}{/each}
				</ol>
			{/if}
		</Collapsible>
	</div>
{/if}

<style>
	.source-tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-4);
		margin: var(--space-2) 0 var(--space-3);
	}

	.text-button {
		min-height: 1.5rem;
		padding: 0;
		border: 0;
		background: none;
		color: var(--color-link);
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}

	/* The pressed state shows by more than color: the line under the words thickens. */
	.text-button[aria-pressed='true'] {
		text-decoration-thickness: 3px;
		font-weight: var(--font-weight-semibold);
	}

	.source-group {
		border-top: 1px solid var(--color-line);
	}

	.source-group:last-child {
		border-bottom: 1px solid var(--color-line);
	}

	.source-group summary {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		list-style: none;
		cursor: pointer;
	}

	.source-group summary::-webkit-details-marker {
		display: none;
	}

	.source-group-name {
		font-weight: var(--font-weight-semibold);
	}

	.source-group-count {
		margin-left: auto;
		padding-left: var(--space-3);
		color: var(--color-ink-muted);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.fold-mark {
		display: inline-flex;
		flex: none;
		transition: transform var(--motion-duration-short) var(--motion-easing-standard);
	}

	.source-group:not([open]) .fold-mark {
		transform: rotate(-90deg);
	}

	.source-group .source-list {
		margin-bottom: var(--space-3);
	}

	.source-subgroup {
		margin: var(--space-3) 0 0;
		padding-left: 2.5em;
		color: var(--color-ink-muted);
		font-weight: var(--font-weight-semibold);
	}

	@media (prefers-reduced-motion: reduce) {
		.fold-mark {
			transition: none;
		}
	}

	@media print {
		.source-group,
		.source-group:last-child {
			border: 0;
		}

		.source-group summary {
			min-height: 0;
			margin-top: var(--space-3);
		}
	}
</style>
