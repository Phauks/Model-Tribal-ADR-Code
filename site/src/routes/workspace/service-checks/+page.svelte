<script lang="ts">
	import Archive from '@lucide/svelte/icons/archive';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleDashed from '@lucide/svelte/icons/circle-dashed';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Collapsible from '#lib/components/Collapsible.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type State = 'problem' | 'warning' | 'off' | 'working';
	const order: State[] = ['problem', 'warning', 'off', 'working'];
	const stateLabels: Record<State, string> = {
		working: 'Working',
		warning: 'Needs a look',
		problem: 'Not working',
		off: 'Not set up'
	};

	let shown = $state<State | 'all'>('all');

	/** Kinds named as Cloudflare names them, shown in code type. */
	const codeKinds = new Set(['D1 database', 'R2 bucket', 'Worker', 'Static assets', 'Rate limit', 'Setting', 'Secret']);

	const counts = $derived(Object.fromEntries(order.map((state) => [state, data.results.filter((result) => result.state === state).length])) as Record<State, number>);
	const visible = $derived(shown === 'all' ? data.results : data.results.filter((result) => result.state === shown));
	const groups = $derived([...new Set(visible.map((result) => result.group))]);
	const checkedAt = $derived(
		new Date(data.checkedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Los_Angeles' })
	);
</script>

{#snippet stateIcon(state: State, size: number)}
	{#if state === 'working'}<CircleCheck {size} aria-hidden="true" />
	{:else if state === 'warning'}<TriangleAlert {size} aria-hidden="true" />
	{:else if state === 'problem'}<CircleX {size} aria-hidden="true" />
	{:else}<CircleDashed {size} aria-hidden="true" />{/if}
{/snippet}

{#snippet target(item: { name: string; kind: string; part?: string })}
	<!-- Names a Cloudflare resource or setting in code type, an outside service in plain type. -->
	<span class="row-target muted small">{#if codeKinds.has(item.kind)}<code class="target-name">{item.name}</code>{:else}<span class="target-name">{item.name}</span>{/if}{' · '}{item.kind}{#if item.part}{' · '}{item.part}{/if}</span>
{/snippet}

<svelte:head>
	<title>Service checks · Workspace · Tribal Law Project</title>
</svelte:head>

<div class="title-row">
	<h1>Service checks</h1>
	<a class="icon-button" href="/workspace/service-checks" aria-label="Check again" title="Check again"><RefreshCw size={20} aria-hidden="true" /></a>
</div>
<p class="small muted checked">
	{checkedAt} Pacific{#if data.buildCommit} · build <code>{data.buildCommit.slice(0, 7)}</code>{/if} · {data.results.length} checks
</p>

<div class="tally" role="radiogroup" aria-label="Show">
	{#each order as state (state)}
		<button
			type="button"
			role="radio"
			aria-checked={shown === state}
			class="tally-item tally-{state}"
			disabled={counts[state] === 0}
			onclick={() => (shown = shown === state ? 'all' : state)}
		>
			{@render stateIcon(state, 20)}
			<span class="tally-count">{counts[state]}</span>
			<span class="tally-label">{stateLabels[state]}</span>
		</button>
	{/each}
</div>

{#each groups as group (group)}
	{@const rows = visible.filter((result) => result.group === group)}
	<Collapsible heading={group} identifier="group-{group.toLowerCase().replaceAll(' ', '-')}" count={rows.length}>
		<ul class="rows">
			{#each rows as result (result.key)}
				<li class="row state-{result.state}">
					<details open={result.state === 'problem' || result.state === 'warning'}>
						<summary>
							<span class="row-icon" title={stateLabels[result.state]}>{@render stateIcon(result.state, 20)}<span class="visually-hidden">{stateLabels[result.state]}:</span></span>
							<span class="row-name">
								<span class="row-title">{result.name}</span>
								{@render target(result.target)}
							</span>
							<span class="row-summary">{result.summary}</span>
							<span class="row-time muted small">{result.milliseconds} ms</span>
						</summary>
						<div class="row-more small">
							<dl class="row-facts">
								<dt>Used for</dt>
								<dd>{result.use}</dd>
								<dt>How it checks</dt>
								<dd>{result.test}</dd>
								{#if result.binding}
									<dt>Binding</dt>
									<dd><code>{result.binding}</code></dd>
								{/if}
							</dl>
							{#if result.details.length > 0}
								<ul>
									{#each result.details as detail (detail)}<li>{detail}</li>{/each}
								</ul>
							{/if}
							{#if result.fix && result.state !== 'working'}<p class="fix"><strong>What to do:</strong> {result.fix}</p>{/if}
						</div>
					</details>
				</li>
			{/each}
		</ul>
	</Collapsible>
{/each}

{#if shown === 'all' && data.oldResources.length > 0}
	<Collapsible heading="Old, kept until deleted" identifier="group-old" count={data.oldResources.length} open={false}>
		<p class="small muted old-note">The site no longer uses these, so nothing here checks them.</p>
		<ul class="rows">
			{#each data.oldResources as item (item.name)}
				<li class="row state-old">
					<div class="old-row">
						<span class="row-icon" title="Old"><Archive size={20} aria-hidden="true" /></span>
						<span class="row-name">
							<span class="row-title">{item.title}</span>
							{@render target(item)}
						</span>
						<span class="row-summary">Replaced by <code>{item.replacedBy}</code>.{#if item.note}{' '}{item.note}{/if}</span>
					</div>
				</li>
			{/each}
		</ul>
	</Collapsible>
{/if}

<style>
	.title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.title-row h1 {
		margin-bottom: 0;
	}

	.checked {
		margin-top: var(--space-1);
	}

	/* The tally: one button for each state, which shows only the checks in it. */
	.tally {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--space-3);
		margin: var(--space-4) 0 var(--space-5);
	}

	.tally-item {
		display: grid;
		grid-template-columns: auto 1fr;
		grid-template-rows: auto auto;
		column-gap: var(--space-2);
		align-items: center;
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--color-line);
		border-top-width: 4px;
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
		color: var(--color-ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.tally-item:disabled {
		cursor: default;
		opacity: 0.6;
	}

	.tally-item[aria-checked='true'] {
		outline: 2px solid currentColor;
		outline-offset: 1px;
	}

	.tally-count {
		font-size: var(--font-size-heading-2);
		font-weight: var(--font-weight-semibold);
		font-variant-numeric: tabular-nums;
		line-height: 1.1;
	}

	.tally-label {
		grid-column: 1 / -1;
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	.tally-problem {
		border-top-color: var(--color-danger);
	}

	.tally-problem :global(svg) {
		color: var(--color-danger);
	}

	.tally-warning {
		border-top-color: var(--color-status-draft-rule);
	}

	.tally-warning :global(svg) {
		color: var(--color-status-draft);
	}

	.tally-off :global(svg) {
		color: var(--color-ink-muted);
	}

	.tally-working {
		border-top-color: var(--color-status-published-rule);
	}

	.tally-working :global(svg) {
		color: var(--color-status-published);
	}

	/* A folding section for each group, one line for each check (Trevor chose this design, A, on Nov. 23, 2026). */
	.rows {
		list-style: none;
		padding: 0;
		margin: 0 0 var(--space-4);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
	}

	.row + .row {
		border-top: 1px solid var(--color-line);
	}

	/* Each row names what it checks under its title: the bucket, database, Worker, setting or outside service (Trevor, Nov. 26, 2026). */
	.row summary,
	.old-row {
		display: grid;
		grid-template-columns: auto minmax(14rem, 22rem) 1fr auto;
		gap: var(--space-3);
		align-items: start;
		padding: var(--space-2) var(--space-3);
		list-style: none;
	}

	.row summary {
		cursor: pointer;
	}

	.row summary::-webkit-details-marker {
		display: none;
	}

	.row-icon {
		display: inline-flex;
		padding-top: 0.1em;
	}

	.row-name {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.row-title {
		font-weight: var(--font-weight-semibold);
	}

	.row-target {
		overflow-wrap: anywhere;
	}

	.row-target .target-name {
		color: var(--color-ink);
	}

	.row-facts {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0 var(--space-3);
		margin: 0 0 var(--space-1);
	}

	.row-facts dt {
		font-weight: var(--font-weight-semibold);
	}

	.row-facts dd {
		margin: 0;
	}

	.old-note {
		margin: 0 0 var(--space-2);
	}

	.state-old .row-icon {
		color: var(--color-ink-muted);
	}

	.row-time {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.row-more {
		padding: 0 var(--space-3) var(--space-3) calc(var(--space-3) * 2 + 20px);
	}

	.row-more p,
	.row-more ul {
		margin: 0 0 var(--space-1);
	}

	.state-working .row-icon {
		color: var(--color-status-published);
	}

	.state-warning .row-icon {
		color: var(--color-status-draft);
	}

	.row.state-warning summary {
		background: var(--color-status-draft-background);
	}

	.state-problem .row-icon {
		color: var(--color-danger);
	}

	.row.state-problem summary {
		background: var(--color-removed-background);
	}

	.state-off .row-icon,
	.state-off .row-summary {
		color: var(--color-ink-muted);
	}

	@media (max-width: 40rem) {
		.tally {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.row summary,
		.old-row {
			grid-template-columns: auto 1fr auto;
			grid-template-areas: 'icon name time' '. summary summary';
			row-gap: var(--space-1);
		}

		.row-icon {
			grid-area: icon;
		}

		.row-name {
			grid-area: name;
		}

		.row-time {
			grid-area: time;
		}

		.row-summary {
			grid-area: summary;
		}

		.row-more {
			padding-left: calc(var(--space-3) * 2 + 20px);
		}
	}
</style>
