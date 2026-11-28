<script lang="ts">
	// One page's changes, newest first: in the page's own Changes view
	// (src/routes/[...address]/changes, Trevor's pick of Nov. 27, 2026, option B
	// of design/page-changes-in-page) and on Recent changes for a page no longer
	// on the site. Nation pages and stories name the parts that changed, never
	// earlier wording (Trevor, Nov. 23, 2026); other pages offer their versions
	// to read and compare. On a narrow screen each change is a short block
	// rather than a row, as in the approved phone mockup.
	import Lock from '@lucide/svelte/icons/lock';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import CountBadge from './CountBadge.svelte';
	import { dateTime } from '#lib/change-dates.ts';
	import { requestLink } from '#lib/report-request.ts';
	import { largeChange, siteReleaseName, sizeChangeText, wordingIsShown, type ChangeView } from '#lib/page-history.ts';

	let {
		changes,
		address,
		kind,
		pageOnSite,
		recordedSince,
		heading = false
	}: {
		changes: ChangeView[];
		/** The page's address. */
		address: string;
		/** The kind of page, which decides whether earlier wording may be shown. */
		kind: string | undefined;
		/** Whether the page is still on the site, so "read" can open it. */
		pageOnSite: boolean;
		/** For a page with no changes yet: when its history began. */
		recordedSince: string | undefined;
		/** Whether the list has its own "Changes to This Page" heading, as in the page's Changes view. */
		heading?: boolean;
	} = $props();

	const showsWording = $derived(kind ? wordingIsShown(kind) : true);
	/** Request a Change, filled in with this page, for "Ask for a change or removal". */
	const changeLink = $derived.by(() => {
		const match = /^\/(nations|stories)\/([a-z0-9-]+)$/.exec(address);
		return requestLink(match ? { record: `${match[1] === 'nations' ? 'tribes' : 'stories'}/${match[2]}` } : {});
	});

	let fromChoice = $state<string | undefined>(undefined);
	let toChoice = $state<string | undefined>(undefined);
	const comparable = $derived(changes.filter((change) => change.comparable));
	$effect(() => {
		fromChoice = comparable[1]?.id;
		toChoice = comparable[0]?.id;
	});
</script>

{#snippet size(change: ChangeView)}
	{#if change.sizeChange !== undefined}
		<span
			class="size"
			class:up={change.sizeChange > 0}
			class:down={change.sizeChange < 0}
			class:large={Math.abs(change.sizeChange) >= largeChange}
			title="{change.size !== undefined ? `${change.size.toLocaleString('en-US')} bytes after the change` : 'Change in size'}"
			>{sizeChangeText(change.sizeChange)}<span class="visually-hidden"> bytes</span></span
		>
	{/if}
{/snippet}

<div class="page-history" class:with-notes={!showsWording} class:parts-only={!showsWording}>
	<div class="history-main">
		{#if heading}
			<h2 id="page-changes-heading">Changes to This Page{#if changes.length > 0}<CountBadge count={changes.length} />{/if}</h2>
		{/if}
		{#if !showsWording}
			<p class="lede">When this page changed, who changed it and which parts.</p>
		{:else}
			<p class="lede">Every version readers have seen. Choose two to compare, or open one to read it as it stood.</p>
		{/if}

		{#if changes.length === 0 && !recordedSince}
			<p>No changes to this page have been recorded.</p>
		{:else}
			<form method="get" action="/changes/compare" class="history-form">
				{#if showsWording && comparable.length > 1}
					<p><button type="submit" class="button">Compare the two chosen versions</button></p>
				{/if}
				<div class="table-scroll">
					<table class="history">
						<thead>
							<tr>
								{#if showsWording}<th scope="col"><span class="visually-hidden">Compare from, to</span>Compare</th>{/if}
								<th scope="col">When</th>
								<th scope="col">Who</th>
								{#if showsWording}<th scope="col">Size</th>{:else}<th scope="col">Parts changed</th>{/if}
								<th scope="col">Summary</th>
								{#if showsWording}<th scope="col"><span class="visually-hidden">Links</span></th>{/if}
							</tr>
						</thead>
						<tbody>
							{#each changes as change, index (change.id)}
								<tr class:struck={change.textHidden}>
									{#if showsWording}
										<td class="radios">
											{#if change.comparable}
												<input
													type="radio"
													name="from"
													value={change.id}
													bind:group={fromChoice}
													aria-label="Compare from {dateTime(change.madeAt)}"
												/>
												<input
													type="radio"
													name="to"
													value={change.id}
													bind:group={toChoice}
													aria-label="Compare to {dateTime(change.madeAt)}"
												/>
											{/if}
										</td>
									{/if}
									<td class="when"
										><time datetime={change.madeAt}>{dateTime(change.madeAt)}</time>{#if index === 0 && change.change !== 'removed'}
											<span class="tag new">Current</span>{/if}</td
									>
									<td class="who">
										{#if change.whoHidden}<span class="hidden-part">name hidden</span>{:else}{change.who}{/if}
										{#if change.id.startsWith('nation-')}<span class="tag nation">Nation’s own edit</span>{/if}
									</td>
									{#if showsWording}
										<td class="numbers">
											{#if change.textHidden}<span class="hidden-part">size hidden</span>{:else}{change.size?.toLocaleString('en-US') ?? ''} {@render size(change)}{/if}
										</td>
									{:else}
										<td class="parts">
											{#if change.textHidden}<span class="part-chip hidden-part">parts hidden</span>
											{:else if change.change === 'new'}<span class="part-chip">New page</span>
											{:else if change.change === 'removed'}<span class="part-chip">Page removed</span>
											{:else}<ul class="part-chips">{#each change.parts ?? [] as part (part)}<li class="part-chip">{part}</li>{/each}</ul>{/if}
										</td>
									{/if}
									<td class="about">
										{#if change.summaryHidden}<span class="hidden-part">summary hidden</span>{:else if change.summary}<span class="summary">{change.summary}</span>{/if}
										{#if change.hiddenReason}<span class="tag"><EyeOff size={13} aria-hidden="true" />{change.hiddenReason}</span>{/if}
									</td>
									{#if showsWording}<td class="links">
											{#if change.comparable}
												<a href="/changes/{change.id}/version">read</a> · <a href="/changes/{change.id}">changes</a>
											{/if}
										</td>{/if}
								</tr>
							{/each}
							{#if changes.length === 0 && recordedSince}
								<!-- A page that has not changed since the history began: the one version readers have seen. -->
								<tr>
									{#if showsWording}<td class="radios"></td>{/if}
									<td class="when"><time datetime={recordedSince}>{dateTime(recordedSince)}</time> <span class="tag new">Current</span></td>
									<td class="who">{siteReleaseName}</td>
									<td class:parts={!showsWording}>{#if !showsWording}No changes yet{/if}</td>
									<td class="about"><span class="summary">The page as it stood when the site began keeping its history. It has not changed since.</span></td>
									{#if showsWording}<td class="links">{#if pageOnSite}<a href={address}>read</a>{/if}</td>{/if}
								</tr>
							{/if}
						</tbody>
					</table>
				</div>
			</form>
		{/if}
		<p class="small muted history-start">
			The history begins on Nov. 22, 2026.
			{#if showsWording}Versions saved while writing, before they were published, are kept in the workspace and are not listed here.{/if}
			{#if heading}<a href="/changes">All recent changes</a>{/if}
		</p>
	</div>
	{#if !showsWording}
		<!-- Why a nation page or story keeps no earlier wording, and where to ask for a change (approved mockup 5, design/recent-changes). -->
		<aside class="history-notes" aria-label="About this history">
			<div class="history-note">
				<p class="note-title"><Lock size={16} aria-hidden="true" /><strong>Why there is no earlier wording here.</strong></p>
				<p>
					A nation can ask us to take something off its page. Showing older versions would put that text back in view, so
					{kind === 'story' ? 'stories keep' : 'nation pages keep'} their history private.
				</p>
			</div>
			<div class="history-note">
				<p class="note-title"><strong>Something wrong on this page?</strong></p>
				<p><a href={changeLink}>Ask for a change or removal</a></p>
			</div>
		</aside>
	{/if}
</div>

<style>
	h2 {
		margin-block: 0 var(--space-1);
	}

	.lede {
		max-width: var(--layout-measure);
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	/* The table, with why there is no earlier wording beside it (approved mockup B, design/page-changes-in-page). */
	.page-history.with-notes {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 19rem;
		gap: var(--space-6);
		align-items: start;
	}

	.history-notes {
		display: grid;
		gap: var(--space-3);
	}

	.history-note {
		background: var(--color-surface);
		border-radius: var(--radius-panel);
		padding: var(--space-3) var(--space-4);
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
	}

	.history-note p {
		margin: 0;
	}

	.history-note p + p {
		margin-block-start: var(--space-1);
	}

	.note-title {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--color-ink);
	}

	.note-title :global(svg) {
		color: var(--color-ink);
		flex: none;
	}

	.history td {
		vertical-align: top;
	}

	.summary {
		color: var(--color-ink-muted);
		font-style: italic;
	}

	.tag {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		font-style: normal;
		padding: 0 var(--space-2);
		border-radius: 999px;
		border: 1px solid var(--color-line);
		color: var(--color-ink-muted);
	}

	.tag.new {
		background: var(--color-added-background);
		border-color: transparent;
		color: var(--color-ink);
	}

	/* "Current" sits under the date in the table, beside it on a phone. */
	.when .tag.new {
		display: flex;
		width: fit-content;
		margin-block-start: var(--space-1);
		font-size: 0.8rem;
	}

	.tag.nation {
		background: var(--color-notice-background);
		border-color: var(--color-link);
		color: var(--color-link);
	}

	.hidden-part {
		color: var(--color-ink-muted);
		text-decoration: line-through;
	}

	.part-chips {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-1);
	}

	.part-chip {
		display: inline-block;
		white-space: nowrap;
		padding: 0 var(--space-2);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		background: var(--color-surface);
		font-size: var(--font-size-small);
	}

	.radios,
	.links {
		white-space: nowrap;
	}

	.numbers {
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	/* Links break anywhere elsewhere on the site; here a short word such as "read" stays whole. */
	.links a {
		overflow-wrap: normal;
		word-break: normal;
	}

	.size {
		display: inline-block;
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-bold);
		font-variant-numeric: tabular-nums;
		padding: 0 var(--space-1);
		border-radius: var(--radius-control);
		margin-inline: var(--space-1);
	}

	.size.up {
		background: var(--color-added-background);
	}

	.size.down {
		background: var(--color-removed-background);
	}

	.size.large {
		outline: 2px solid currentColor;
	}

	.history-start {
		margin-block-start: var(--space-4);
	}

	@container page (max-width: 62rem) {
		.page-history.with-notes {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-4);
		}
	}

	/*
	 * A phone: each change of a nation page or story is a block, its date in
	 * bold with "Current" beside it, then who, the parts and the summary
	 * (approved phone mockup B).
	 */
	@container page (max-width: 40rem) {
		.parts-only .table-scroll {
			overflow: visible;
		}

		.parts-only .history,
		.parts-only .history tbody,
		.parts-only .history tr,
		.parts-only .history td {
			display: block;
		}

		.parts-only .history thead {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
		}

		.parts-only .history tr {
			padding-block: var(--space-3);
			border-block-end: 1px solid var(--color-line);
		}

		.parts-only .history td {
			padding: 0;
			border: 0;
			background: none;
		}

		.parts-only .when {
			font-weight: var(--font-weight-bold);
		}

		.parts-only .when .tag.new {
			display: inline-flex;
			margin: 0 0 0 var(--space-1);
		}

		.parts-only .who {
			color: var(--color-ink-muted);
			margin-block-end: var(--space-2);
		}

		.parts-only .part-chips {
			flex-direction: row;
			flex-wrap: wrap;
			margin-block-end: var(--space-1);
		}
	}
</style>
