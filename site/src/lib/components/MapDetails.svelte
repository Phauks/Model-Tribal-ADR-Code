<!--
	@component
	The details of the place or nation a reader chose on a map (Trevor, 2026-11-24, mockups 3A and 5). On the Map page they take the side column, with a back arrow to the table; on a nation's page they sit under the map. Each fact is a row of its name and value. A count of nations is a button that opens its nations right under it, each linked to its page or to the part of it that holds the fact and its sources, with a filter box when the list is long. The panel grows with the page rather than scrolling in a box of its own.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import Search from '@lucide/svelte/icons/search';
	import CountBadge from './CountBadge.svelte';
	import RecognitionBadges from './RecognitionBadges.svelte';
	import { imageViewerAttributes } from '#lib/image-viewer.ts';
	import type { MapDetails, MapDetailsContact, MapDetailsLine, MapDetailsNation } from '#lib/map-details.ts';

	let {
		details,
		image,
		contact = [],
		back
	}: {
		details: MapDetails;
		/** The nation's seal or logo, where it may be shown. */
		image?: { src: string; alt: string };
		contact?: MapDetailsContact[];
		/** The back arrow, on the Map page, which brings back the table. */
		back?: { label: string; onclick: () => void };
	} = $props();

	const identifier = $props.id();
	let heading = $state<HTMLElement | undefined>();
	let hiddenImage = $state<string | undefined>();

	/** Which counts are open, and what each one's list is filtered by. A new place starts with all closed. */
	let open = $state<Record<string, boolean>>({});
	let filters = $state<Record<string, string>>({});
	let shownFor = '';
	$effect.pre(() => {
		const key = `${details.kind}\n${details.title}`;
		if (key === shownFor) return;
		shownFor = key;
		open = {};
		filters = {};
	});

	/** A list this long gets a filter box. */
	const filterFrom = 12;
	function filtered(line: MapDetailsLine): MapDetailsNation[] {
		const words = (filters[line.label] ?? '').toLowerCase().split(/\s+/).filter(Boolean);
		return (line.nations ?? []).filter((nation) => words.every((word) => nation.name.toLowerCase().includes(word)));
	}

	/** Moves the reader to the details, as when a place is chosen on the map. */
	export async function focus(): Promise<void> {
		await tick();
		heading?.focus({ preventScroll: true });
		heading?.closest('section')?.scrollIntoView({ block: 'nearest' });
	}
</script>

<section class="map-details" aria-labelledby="{identifier}-title">
	{#if back}
		<button type="button" class="back" onclick={back.onclick}>
			<ArrowLeft aria-hidden="true" size={20} />{back.label}
		</button>
	{/if}
	<p class="kind">{details.kind}</p>
	<div class="head">
		{#if image && hiddenImage !== image.src}
			{@const src = image.src}
			<img class="image image-backing" {src} alt={image.alt} width="64" height="64" onerror={() => (hiddenImage = src)} />
		{/if}
		<h3 id="{identifier}-title" tabindex="-1" bind:this={heading}>
			{details.title}{#if details.badges}{' '}<RecognitionBadges badges={details.badges} size="small" />{/if}
		</h3>
	</div>
	{#if details.pill}<p class="pill-line"><span class="move-pill">{details.pill}</span></p>{/if}
	{#if details.summary}<p class="summary">{details.summary}</p>{/if}
	{#each details.lines as line, index (line.label)}
		<div class="fact">
			{#if line.nations && line.nations.length > 0}
				{@const listIdentifier = `${identifier}-list-${index}`}
				<div class="row">
					<span id="{listIdentifier}-label">{line.label}</span>
					<button
						type="button"
						class="count"
						aria-expanded={open[line.label] ? 'true' : 'false'}
						aria-controls={listIdentifier}
						aria-label="{line.label}: {line.value} {line.nations.length === 1 ? (line.noun?.one ?? 'nation') : (line.noun?.many ?? 'nations')}"
						onclick={() => (open[line.label] = !open[line.label])}
					>
						{line.value}<ChevronDown aria-hidden="true" size={16} />
					</button>
				</div>
				<div class="list" id={listIdentifier} hidden={!open[line.label]}>
					{#if open[line.label]}
						{#if line.nations.length >= filterFrom}
							<div class="filter">
							<Search aria-hidden="true" size={18} />
							<input
								type="search"
								autocomplete="off"
								placeholder="Filter {line.nations.length.toLocaleString('en-US')} {line.noun?.many ?? 'nations'}"
								aria-label="Filter the {line.nations.length.toLocaleString('en-US')} {line.noun?.many ?? 'nations'}: {line.label}"
								bind:value={filters[line.label]}
							/>
							</div>
						{/if}
						{@const shown = filtered(line)}
						<ul aria-labelledby="{listIdentifier}-label">
							{#each shown as nation (nation.id)}
								<li><a href={nation.href}>{nation.name}</a></li>
							{/each}
						</ul>
						{#if shown.length === 0}
							<p class="small muted">{line.noun ? 'No name has these words.' : 'No nation’s name has these words.'}</p>
						{/if}
					{/if}
				</div>
			{:else if line.counts}
				<div class="row">
					<span>{line.label}</span>
					<span class="value counts">
						{#each line.counts as entry (entry.label)}<span class="count-row">{entry.label}<CountBadge count={entry.count} /></span>{/each}
					</span>
				</div>
			{:else if line.block}
				<div class="block">
					<span class="label">{line.label}</span>
					{#each line.block as part, partIndex (partIndex)}
						<span class="block-line" class:small={part.small}>{#if part.href}<a href={part.href}>{part.text}</a>{:else}{part.text}{/if}</span>
					{/each}
				</div>
			{:else if line.links?.length === 1 && line.links[0].external && !line.value}
				{@const link = line.links[0]}
				<div class="row">
					<span>{line.label}</span>
					<span class="value"><a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}<ExternalLinkIcon class="external-icon" aria-label="(opens in a new tab)" size={14} /></a></span>
				</div>
			{:else if line.links || line.pictures || line.after || details.table}
				<!-- Links and pictures are long, so the fact's name sits beside them as in a table (historic maps mockup 2A). -->
				<div class="row wide">
					<span class="label">{line.label}</span>
					<span class="value">
						{#each line.links ?? [] as link, linkIndex (linkIndex)}{#if linkIndex > 0}{', '}{/if}{#if link.href && link.external}<a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}<ExternalLinkIcon class="external-icon" aria-label="(opens in a new tab)" size={14} /></a>{:else if link.href}<a href={link.href}>{link.label}</a>{:else}{link.label}{/if}{/each}{#if line.value}{line.links?.length ? ', ' : ''}{line.value}{/if}
						{#if line.after}<a class="after" href={line.after.href}>{line.after.label}</a>{/if}
						{#if line.pictures}
							<span class="pictures">
								{#each line.pictures as picture (picture.href)}
									<a href={picture.href} {...imageViewerAttributes(picture.label, { title: picture.label, original: picture.original })}>
										<img class="image-backing" src={picture.src} alt={picture.label} loading="lazy" />
										<span>{picture.label}</span>
									</a>
								{/each}
							</span>
						{/if}
					</span>
				</div>
			{:else}
				<div class="row">
					<span>{line.label}</span>
					<span class="value">{line.value}</span>
				</div>
			{/if}
		</div>
	{/each}
	{#each contact as entry (entry.label)}
		<div class="fact">
			<div class="row">
				<span>{entry.label}</span>
				<span class="value contact">
					{#if entry.link}
						<a href={entry.link} target={entry.external ? '_blank' : undefined} rel={entry.external ? 'noopener noreferrer' : undefined}>{#each entry.lines as text, lineIndex (lineIndex)}{#if lineIndex > 0}<br />{/if}{text}{/each}</a>
					{:else}
						{#each entry.lines as text, lineIndex (lineIndex)}{#if lineIndex > 0}<br />{/if}{text}{/each}
					{/if}
				</span>
			</div>
		</div>
	{/each}
	{#if details.page}
		<p class="actions"><a class="button" href={details.page.href}>{details.page.label}</a></p>
	{/if}
</section>

<style>
	.map-details {
		margin: 0 0 var(--space-4);
		padding: var(--space-4);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-paper);
	}

	/* The back arrow reads as a link, like the sidebar's back control. */
	.back {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--layout-target-minimum);
		margin: calc(-1 * var(--space-2)) 0 var(--space-1);
		padding: 0;
		border: 0;
		background: none;
		color: var(--color-link);
		font: inherit;
		font-weight: var(--font-weight-bold);
		cursor: pointer;
	}

	/* A fact written under its name, such as an address. */
	.block {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-1) 0;
	}

	.block-line {
		line-height: var(--line-height-tight, 1.4);
	}

	.block-line.small {
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
	}

	.map-details :global(.external-icon) {
		margin-left: 0.2em;
		vertical-align: -0.1em;
	}

	.kind {
		margin: 0;
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	.head {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin: var(--space-1) 0 var(--space-3);
	}

	.image {
		flex: none;
		width: 64px;
		height: 64px;
		object-fit: contain;
	}

	h3 {
		margin: 0;
		font-size: var(--font-size-heading-2);
	}

	.fact {
		padding: var(--space-2) 0;
		border-top: 1px solid var(--color-line);
	}

	.row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.value {
		text-align: right;
	}

	.pill-line {
		margin: calc(-1 * var(--space-2)) 0 var(--space-2);
	}

	.summary {
		margin: 0 0 var(--space-3);
	}

	.counts {
		display: grid;
		justify-items: end;
		gap: var(--space-1);
	}

	.row.wide {
		display: grid;
		align-items: start;
		grid-template-columns: minmax(6rem, 2fr) 5fr;
	}

	.row.wide .label {
		font-weight: var(--font-weight-bold);
	}

	.row.wide .value {
		text-align: left;
	}

	.after {
		display: block;
	}

	.pictures {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}

	.pictures a {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		width: 7rem;
		text-align: center;
	}

	.pictures img {
		width: 100%;
		height: auto;
		border: 1px solid var(--color-line);
	}

	.contact a {
		overflow-wrap: anywhere;
	}

	/* A count is a button that reads as a link, with an arrow that turns when its list is open. */
	.count {
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: var(--space-1);
		min-height: 24px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--color-link);
		font: inherit;
		font-weight: var(--font-weight-bold);
		font-variant-numeric: tabular-nums;
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.18em;
		white-space: nowrap;
		cursor: pointer;
	}

	.count :global(svg) {
		transition: transform var(--motion-duration-short) var(--motion-easing-standard);
	}

	.count[aria-expanded='true'] :global(svg) {
		transform: rotate(180deg);
	}

	.list {
		margin: var(--space-2) 0 var(--space-1);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-control);
		background: var(--color-surface);
	}

	/* The filter box, with a magnifying glass inside it. */
	.filter {
		position: relative;
		margin-bottom: var(--space-2);
	}

	.filter :global(svg) {
		position: absolute;
		top: 50%;
		left: var(--space-3);
		transform: translateY(-50%);
		color: var(--color-ink-muted);
		pointer-events: none;
	}

	.filter input {
		padding-left: calc(var(--space-3) + 18px + var(--space-2));
	}

	.list ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.list li {
		padding: var(--space-1) 0;
	}

	.list p {
		margin: 0;
	}

	.actions {
		margin: var(--space-3) 0 0;
	}
</style>
