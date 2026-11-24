<script lang="ts">
	// A nation's courts and dispute resolution services, one heading per kind
	// of service, so the kind is said once (src/lib/nation-services.ts).
	// Where sources record it, the courts show how appeals move, from the
	// court that hears a case first to the highest court, drawn as boxes
	// joined by "Appeals go to", with peacemaking boxed beside them (nation
	// page review, layout A, Nov. 22, 2026). Each service ends with the
	// markers of its sources (CitationMarks), and "Appeals go to" with the
	// markers of the sources that set the path of appeal. A group of courts,
	// such as a nation's district courts, lists each of its courts under it,
	// with where each one sits.
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Gavel from '@lucide/svelte/icons/gavel';
	import Landmark from '@lucide/svelte/icons/landmark';
	import Users from '@lucide/svelte/icons/users';
	import type { ServiceCategory, ServiceEntry } from '#lib/nation-services.ts';
	// The page's one hidden "Opens in a new tab" note (RecordPage.svelte).
	import { newTabNoteIdentifier } from '#lib/new-tab-links.ts';
	import CitationMarks from './CitationMarks.svelte';

	let { categories }: { categories: ServiceCategory[] } = $props();

	// The courts are drawn as a flow only where sources record a path of appeal;
	// peacemaking then sits beside them instead of in a row of its own.
	const courts = $derived(categories.find((category) => category.id === 'courts' && category.appealPaths.length > 0));
	const beside = $derived(courts ? categories.find((category) => category.id === 'peacemaking') : undefined);
	// The external-link icon and the source markers after it never wrap apart:
	// a browser may break a line after an icon, so they share one unbreakable
	// span, and a word joiner keeps that span on the line of the name's last word.
	const joiner = '\u2060';
	const iconSize = 20;
	const iconStroke = 1.75;
</script>

{#snippet service(entry: ServiceEntry)}
	{#if entry.link}<a href={entry.link} target="_blank" rel="noopener noreferrer" aria-describedby={newTabNoteIdentifier}
			>{entry.text}</a
		><span class="link-tail"
			>{joiner}<ExternalLink class="external-icon" size={14} strokeWidth={iconStroke} aria-hidden="true" />{#if !entry.detail}<CitationMarks
					marks={entry.citations}
				/>{/if}</span
		>{:else}{entry.text}{#if !entry.detail}<CitationMarks marks={entry.citations} />{/if}{/if}{#if entry.detail}{' '}<span
			class="muted small">({entry.detail})</span
		><CitationMarks marks={entry.citations} />{/if}{#if entry.location}{' '}<span class="muted small location"
			>{entry.location}</span
		>{/if}
	{#if entry.members && entry.members.length > 0}
		<ul class="members stacked-list" aria-label={`The ${entry.members.length} courts of ${entry.text}`}>
			{#each entry.members as member, index (index)}
				<li>{@render service(member)}</li>
			{/each}
		</ul>
	{/if}
{/snippet}

{#snippet entries(category: ServiceCategory)}
	<ul class="stacked-list">
		{#each category.entries as entry, index (index)}
			<li>{@render service(entry)}</li>
		{/each}
	</ul>
{/snippet}

<dl class="summary-list services">
	{#each categories as category (category.id)}
		{#if category === courts}
			<div class="flow-row">
				<dt class="visually-hidden">{category.heading}</dt>
				<dd>
					<div class="court-flow" class:has-beside={beside !== undefined}>
						<div>
							{#each category.appealPaths as path, pathIndex (pathIndex)}
								<ol class="appeal-path" aria-label="How appeals move between courts">
									<li>
										<span class="flow-label small muted">Cases start in</span>
										{#each path.first as entry, index (index)}
											<div class="court-box">
												<Gavel size={iconSize} strokeWidth={iconStroke} aria-hidden="true" />
												<div>{@render service(entry)}</div>
											</div>
										{/each}
									</li>
									{#each path.then as step, index (index)}
										<li>
											<span class="appeal-step small muted"
												><ArrowDown aria-hidden="true" size="1em" /><span
													>Appeals go to<CitationMarks marks={step.citations} /></span
												></span
											>
											<div class="court-box">
												<Landmark size={iconSize} strokeWidth={iconStroke} aria-hidden="true" />
												<div>{@render service(step.court)}</div>
											</div>
										</li>
									{/each}
								</ol>
							{/each}
							{#if category.entries.length > 0}
								<p class="small muted other">Other courts</p>
								{@render entries(category)}
							{/if}
						</div>
						{#if beside}
							<div>
								<span class="flow-label small muted">Beside the courts</span>
								<ul class="beside" aria-label={beside.heading}>
									{#each beside.entries as entry, index (index)}
										<li class="court-box">
											<Users size={iconSize} strokeWidth={iconStroke} aria-hidden="true" />
											<div>{@render service(entry)}</div>
										</li>
									{/each}
								</ul>
							</div>
						{/if}
					</div>
				</dd>
			</div>
		{:else if category !== beside}
			<div>
				<dt>{category.heading}</dt>
				<dd>
					{#if category.appealPaths.length > 0}
						<p class="small muted other">Other courts</p>
					{/if}
					{@render entries(category)}
				</dd>
			</div>
		{/if}
	{/each}
</dl>

<style>
	/*
	 * A source marker after a service's name stays on the name's line: room
	 * from padding rather than an inline block, which would let the line
	 * break before it. The padding gives the marker a 24 pixel target
	 * (WCAG 2.2, 2.5.8), as in FactGroups.svelte; two pixels above and below
	 * a link make each of its lines a full target too.
	 */
	.services :global(.note-marker) {
		padding: 5px 9px 5px 0.05em;
	}

	.services a {
		padding-block: 2px;
	}

	.services :global(.external-icon) {
		display: inline;
		margin-left: 0.2em;
		vertical-align: -0.1em;
	}

	/* The flow takes the row's whole width, with no label column. */
	.flow-row dd {
		grid-column: 1 / -1;
		padding-right: 0;
		container-type: inline-size;
	}

	/* The courts on the left and, from 30 rem, peacemaking beside them on the right. */
	.court-flow {
		display: grid;
		gap: var(--space-4) var(--space-5);
	}

	@container (min-width: 30rem) {
		.court-flow.has-beside {
			grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
		}
	}

	.flow-label {
		display: block;
		margin-bottom: var(--space-1);
	}

	.appeal-path,
	.beside {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.appeal-path + .appeal-path {
		margin-top: var(--space-4);
	}

	.court-box {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--space-3);
		align-items: start;
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-panel);
	}

	.court-box + .court-box {
		margin-top: var(--space-2);
	}

	.court-box > :global(svg) {
		margin-top: 0.15em;
		color: var(--color-link);
	}

	.beside .court-box {
		border-left: 4px solid var(--color-track-peacemaking);
	}

	/* "Appeals go to" sits on the line that joins one box to the next. Its space keeps its marker clear of the court's link under it, so both stay easy to tap (WCAG 2.2, 2.5.8). */
	.appeal-step {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		margin-left: var(--space-5);
		padding: var(--space-2) 0 var(--space-2) var(--space-4);
		border-left: 2px solid var(--color-line);
	}

	.link-tail {
		white-space: nowrap;
	}

	/* A court's place stays together, on the name's line where it fits or whole on the next. */
	.location {
		white-space: nowrap;
	}

	.members {
		margin: var(--space-1) 0 0;
		padding-left: var(--space-4);
	}

	/* A long list of courts takes two columns where each can be 16rem wide. */
	.members:has(> li:nth-child(7)) {
		columns: var(--layout-card-min) 2;
		column-gap: var(--space-5);
	}

	.members > li {
		break-inside: avoid;
	}

	.other {
		margin: var(--space-3) 0 var(--space-1);
	}

	dd > ul:not(.stacked-list),
	.court-flow ul:not(.beside, .members, .stacked-list) {
		margin: 0;
		padding-left: var(--space-5);
	}

	@media print {
		.court-box {
			break-inside: avoid;
		}
	}
</style>
