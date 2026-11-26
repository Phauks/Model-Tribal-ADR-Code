<script lang="ts">
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
				{@const more = result.details.length > 0 || Boolean(result.fix && result.state !== 'working') || Boolean(result.binding)}
				<li class="row state-{result.state}">
					<details open={result.state === 'problem' || result.state === 'warning'}>
						<summary class:plain={!more}>
							<span class="row-icon" title={stateLabels[result.state]}>{@render stateIcon(result.state, 20)}<span class="visually-hidden">{stateLabels[result.state]}:</span></span>
							<span class="row-name">{result.name}</span>
							<span class="row-summary">{result.summary}</span>
							<span class="row-time muted small">{result.milliseconds} ms</span>
						</summary>
						{#if more}
							<div class="row-more small">
								{#if result.binding}<p>Binding <code>{result.binding}</code></p>{/if}
								{#if result.details.length > 0}
									<ul>
										{#each result.details as detail (detail)}<li>{detail}</li>{/each}
									</ul>
								{/if}
								{#if result.fix && result.state !== 'working'}<p class="fix"><strong>What to do:</strong> {result.fix}</p>{/if}
							</div>
						{/if}
					</details>
				</li>
			{/each}
		</ul>
	</Collapsible>
{/each}

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

	.row summary {
		display: grid;
		grid-template-columns: auto minmax(10rem, 14rem) 1fr auto;
		gap: var(--space-3);
		align-items: baseline;
		padding: var(--space-2) var(--space-3);
		cursor: pointer;
		list-style: none;
	}

	.row summary::-webkit-details-marker {
		display: none;
	}

	.row summary.plain {
		cursor: default;
	}

	.row-icon {
		align-self: center;
		display: inline-flex;
	}

	.row-name {
		font-weight: var(--font-weight-semibold);
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

		.row summary {
			grid-template-columns: auto 1fr auto;
			grid-template-areas: 'icon name time' '. summary summary';
			row-gap: 0;
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
