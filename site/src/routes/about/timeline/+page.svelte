<script lang="ts">
	// The timeline to public review: where the model code stands and the steps
	// ahead (src/lib/review-timeline.ts). Status is always said in words, not
	// only by color or shape. Motion answers only what the reader does: a
	// step's details open and close by their height, and the step a link goes
	// to arrives highlighted (site/DESIGN.md, section 6, "Motion").
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import SourceList from '#lib/components/SourceList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const currentIndex = $derived(data.steps.findIndex((step) => step.status === 'now'));
	const current = $derived(data.steps[currentIndex]);
	const next = $derived(data.steps.find((step) => step.status === 'next'));
	const checksDone = $derived(current?.checks?.filter((check) => check.done).length ?? 0);
	const firstPublic = $derived(data.steps.findIndex((step) => step.publicReview));
</script>

<svelte:head>
	<title>{data.title} · Tribal Law Project</title>
</svelte:head>

<div class="timeline-page">
	<Breadcrumbs trail={[{ label: 'About', href: '/about' }]} />
	<h1>{data.title}</h1>
	<div class="lead reading">{@html data.introductionHtml}</div>

	{#if current}
		<section class="standing" aria-labelledby="standing-heading">
			<h2 id="standing-heading">Where things stand</h2>
			<dl>
				<div>
					<dt>Now</dt>
					<dd>
						<a href="#{current.id}">Step {currentIndex + 1}: {current.title}</a>
						{#if current.checks}
							<span class="standing-detail">{checksDone} of {current.checks.length} checks done</span>
						{/if}
					</dd>
				</div>
				{#if next}
					<div>
						<dt>Next</dt>
						<dd><a href="#{next.id}">Step {data.steps.indexOf(next) + 1}: {next.title}</a></dd>
					</div>
				{/if}
				<div>
					<dt>Public review</dt>
					<dd>
						<a href="#{data.steps[firstPublic].id}">Begins at step {firstPublic + 1}</a>, when drafts are posted here
					</dd>
				</div>
			</dl>
			<p class="updated">Updated {data.updated}</p>
		</section>
	{/if}

	<ol class="timeline">
		{#each data.steps as step, index (step.id)}
			<li
				id={step.id}
				class="step {step.status}"
				class:public={step.publicReview}
				class:public-start={index === firstPublic}
				class:public-end={step.publicReview && !data.steps[index + 1]?.publicReview}
				aria-current={step.status === 'now' ? 'step' : undefined}
			>
				<span class="node" aria-hidden="true">
					{#if step.status === 'done'}<Check size={20} strokeWidth={3} />{:else}{index + 1}{/if}
				</span>
				<div class="card">
					{#if index === firstPublic}
						<p class="public-label"><ArrowDown size={16} aria-hidden="true" /> Public review from here on</p>
					{/if}
					<p class="meta">
						<span class="visually-hidden">Step {index + 1}</span>
						{#if step.gate}<span class="gate">{step.gate}</span>{/if}
						<span class="status">{step.statusLabel}</span>
					</p>
					<h2>{step.title}</h2>
					{#if step.when}<p class="when">{step.when}</p>{/if}
					<div class="summary">{@html step.summaryHtml}</div>

					{#if step.checks}
						{@const done = step.checks.filter((check) => check.done).length}
						<div class="checks">
							<p class="checks-count" id="{step.id}-checks">{done} of {step.checks.length} checks done</p>
							<meter min="0" max={step.checks.length} value={done} aria-labelledby="{step.id}-checks"></meter>
							<ul>
								{#each step.checks as check (check.label)}
									<li class:done={check.done}>
										<span class="check-mark" aria-hidden="true">
											{#if check.done}<Check size={16} strokeWidth={3} />{/if}
										</span>
										<span class="check-label">
											{check.label}
											<span class="check-state">
												{#if check.done}Done{#if check.date}, {check.date}{/if}{:else if check.note}{check.note}{:else}Still to do{/if}
											</span>
										</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					{#if step.detailsHtml}
						<details class="more">
							<summary>
								<span class="fold-mark no-print"><ChevronDown size={20} /></span>
								How this step works
							</summary>
							<div class="more-body">{@html step.detailsHtml}</div>
						</details>
					{/if}
				</div>
			</li>
		{/each}
	</ol>

	<section class="reading comparison" aria-labelledby="comparison-heading">
		<h2 id="comparison-heading">How long this can take</h2>
		{@html data.comparisonHtml}
	</section>

	<div class="reading">
		<SourceList sources={data.sources} />
	</div>
</div>

<style>
	.timeline-page {
		max-width: var(--layout-measure);
	}

	/* Where things stand */
	.standing {
		background: var(--color-notice-background);
		border-left: 6px solid var(--color-action);
		border-radius: var(--radius-control);
		padding: var(--space-3) var(--space-4);
		margin: var(--space-5) 0 var(--space-6);
	}

	.standing h2 {
		font-size: var(--font-size-heading-3);
		margin: 0 0 var(--space-2);
	}

	.standing dl {
		margin: 0;
		display: grid;
		gap: var(--space-2);
	}

	.standing dl > div {
		display: grid;
		grid-template-columns: 8rem 1fr;
		gap: var(--space-3);
	}

	.standing dt {
		font-weight: var(--font-weight-semibold);
	}

	.standing dd {
		margin: 0;
	}

	.standing-detail {
		display: block;
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	.updated {
		margin: var(--space-3) 0 0;
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
	}

	/* The timeline: a numbered rail on the left, a card for each step. */
	.timeline {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.step {
		position: relative;
		display: grid;
		grid-template-columns: 2.75rem 1fr;
		gap: var(--space-4);
		padding-bottom: var(--space-5);
		border-radius: var(--radius-panel);
	}

	/* The rail joining each node to the next. Steps already taken get a solid line. */
	.step::before {
		content: '';
		position: absolute;
		left: calc(1.375rem - 1.5px);
		top: 2.75rem;
		bottom: 0;
		border-left: 3px dashed var(--color-line);
	}

	.step.done::before {
		border-left-style: solid;
		border-left-color: var(--color-link);
	}

	.step:last-child::before {
		display: none;
	}

	.node {
		position: relative;
		z-index: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 50%;
		border: 3px solid var(--color-control-border);
		background: var(--color-paper);
		color: var(--color-ink-muted);
		font-weight: var(--font-weight-bold);
	}

	.step.done .node {
		background: var(--color-link);
		border-color: var(--color-link);
		color: var(--color-paper);
	}

	.step.now .node {
		background: var(--color-action);
		border-color: var(--color-action);
		color: var(--color-action-text);
		box-shadow: 0 0 0 5px var(--color-paper), 0 0 0 8px var(--color-action);
	}

	.step.next .node {
		border-color: var(--color-action);
		color: var(--color-ink);
	}

	.card {
		min-width: 0;
		padding-top: var(--space-1);
	}

	.step.now .card {
		background: var(--color-surface-raised);
		border: 1px solid var(--color-line);
		border-top: 4px solid var(--color-action);
		border-radius: var(--radius-panel);
		padding: var(--space-3) var(--space-4) var(--space-4);
	}

	/* Public review: the steps where drafts are open to everyone share a band. */
	.step.public .card {
		border-left: 4px solid var(--color-track-peacemaking);
		padding-left: var(--space-4);
	}

	.public-label {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		margin: 0 0 var(--space-2);
		color: var(--color-link);
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-small);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0;
		font-size: var(--font-size-small);
	}

	.gate,
	.status {
		border-radius: 999px;
		padding: 0 var(--space-2);
		border: 1px solid var(--color-control-border);
		color: var(--color-ink);
	}

	.step.now .status {
		background: var(--color-action);
		border-color: var(--color-action);
		color: var(--color-action-text);
		font-weight: var(--font-weight-semibold);
	}

	.step.done .status {
		border-color: var(--color-link);
		color: var(--color-link);
	}

	.gate {
		border-style: dashed;
		color: var(--color-ink-muted);
	}

	.card h2 {
		margin: var(--space-1) 0 0;
		font-size: var(--font-size-heading-3);
	}

	.when {
		margin: 0;
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	.summary :global(p) {
		margin: var(--space-2) 0;
	}

	/* The checks inside a gate. */
	.checks {
		margin-top: var(--space-3);
	}

	.checks-count {
		margin: 0 0 var(--space-1);
		font-weight: var(--font-weight-semibold);
	}

	meter {
		appearance: none;
		display: block;
		width: 100%;
		height: 0.75rem;
		border: 1px solid var(--color-control-border);
		border-radius: 999px;
		background: var(--color-surface);
		overflow: hidden;
	}

	meter::-webkit-meter-bar {
		background: var(--color-surface);
		border: none;
		border-radius: 999px;
	}

	meter::-webkit-meter-optimum-value,
	meter::-webkit-meter-suboptimum-value,
	meter::-webkit-meter-even-less-good-value {
		background: var(--color-link);
		border-radius: 999px;
	}

	meter::-moz-meter-bar {
		background: var(--color-link);
		border-radius: 999px;
	}

	.checks ul {
		list-style: none;
		margin: var(--space-3) 0 0;
		padding: 0;
		display: grid;
		gap: var(--space-2);
	}

	.checks li {
		display: grid;
		grid-template-columns: 1.5rem 1fr;
		gap: var(--space-2);
		align-items: start;
	}

	.check-mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: var(--radius-control);
		border: 2px solid var(--color-control-border);
		margin-top: 0.15rem;
	}

	.checks li.done .check-mark {
		background: var(--color-link);
		border-color: var(--color-link);
		color: var(--color-paper);
	}

	.checks li:not(.done) .check-mark {
		border-color: var(--color-action);
		border-style: dashed;
	}

	.check-state {
		display: block;
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
	}

	.checks li:not(.done) .check-state {
		color: var(--color-action);
		font-weight: var(--font-weight-semibold);
	}

	/* "How this step works": opens and closes by its height, as Collapsible does. */
	.more {
		margin-top: var(--space-2);
		interpolate-size: allow-keywords;
	}

	.more::details-content {
		block-size: 0;
		overflow-y: clip;
		transition:
			block-size var(--motion-duration-medium) var(--motion-easing-standard),
			content-visibility var(--motion-duration-medium) allow-discrete;
	}

	.more[open]::details-content {
		block-size: auto;
	}

	.more summary {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--layout-target-minimum);
		list-style: none;
		cursor: pointer;
		color: var(--color-link);
		font-weight: var(--font-weight-semibold);
	}

	.more summary::-webkit-details-marker {
		display: none;
	}

	.fold-mark {
		display: inline-flex;
		transition: transform var(--motion-duration-short) var(--motion-easing-standard);
	}

	.more:not([open]) .fold-mark {
		transform: rotate(-90deg);
	}

	.more-body :global(p:first-child) {
		margin-top: 0;
	}

	/* The step a link has just gone to arrives highlighted, as a citation does (global.css). */
	.step:target .card {
		animation: arrived var(--motion-duration-highlight) var(--motion-easing-standard);
	}

	.comparison {
		margin-top: var(--space-6);
	}

	@media (max-width: 36rem) {
		.standing dl > div {
			grid-template-columns: 1fr;
			gap: 0;
		}

		.step {
			grid-template-columns: 2.25rem 1fr;
			gap: var(--space-3);
		}

		.node {
			width: 2.25rem;
			height: 2.25rem;
		}

		.step::before {
			left: calc(1.125rem - 1.5px);
			top: 2.25rem;
		}
	}

	@media print {
		.more::details-content {
			block-size: auto;
		}
	}
</style>
