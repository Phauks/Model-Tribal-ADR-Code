<script lang="ts">
	// Two versions of a page, compared paragraph by paragraph and, inside a
	// changed paragraph, word by word (src/lib/essays/compare.ts). Side by side
	// on wide screens, or in one column; unchanged paragraphs fold away.
	import type { BlockChange } from '#lib/essays/compare.ts';

	let { blocks, beforeLabel, afterLabel }: { blocks: BlockChange[]; beforeLabel: string; afterLabel: string } = $props();

	let layout = $state<'columns' | 'single'>('columns');

	type Run = { kind: 'same'; items: string[] } | { kind: 'change'; change: Exclude<BlockChange, { kind: 'same' }> };

	/** Unchanged paragraphs in a row are folded together, keeping one on each side of a change for context. */
	const runs = $derived.by(() => {
		const out: Run[] = [];
		for (const block of blocks) {
			if (block.kind === 'same') {
				const last = out.at(-1);
				if (last?.kind === 'same') last.items.push(block.text);
				else out.push({ kind: 'same', items: [block.text] });
			} else out.push({ kind: 'change', change: block });
		}
		return out;
	});

	const counts = $derived({
		changed: blocks.filter((block) => block.kind === 'changed').length,
		added: blocks.filter((block) => block.kind === 'added').length,
		removed: blocks.filter((block) => block.kind === 'removed').length
	});
</script>

<div class="layout-choice" role="group" aria-label="How to show the changes">
	<button type="button" class="chip" aria-pressed={layout === 'columns'} onclick={() => (layout = 'columns')}>Side by side</button>
	<button type="button" class="chip" aria-pressed={layout === 'single'} onclick={() => (layout = 'single')}>One column</button>
</div>

<p class="small muted">
	{counts.changed} {counts.changed === 1 ? 'paragraph' : 'paragraphs'} changed, {counts.added} added, {counts.removed} taken out.
	<span class="key"><ins>Added words</ins> and <del>words taken out</del> are marked.</span>
</p>

{#if blocks.every((block) => block.kind === 'same')}
	<p>The two versions have the same text.</p>
{:else}
	<div class="comparison" class:single={layout === 'single'}>
		<div class="heads" aria-hidden="true"><div>{beforeLabel}</div><div>{afterLabel}</div></div>
		{#each runs as run, index (index)}
			{#if run.kind === 'same'}
				<details class="same">
					<summary>{run.items.length} unchanged {run.items.length === 1 ? 'paragraph' : 'paragraphs'}</summary>
					{#each run.items as text, at (at)}<p class="row"><span class="cell both">{text}</span></p>{/each}
				</details>
			{:else if run.change.kind === 'added'}
				<div class="row">
					<div class="cell empty" aria-hidden="true"></div>
					<div class="cell added"><span class="visually-hidden">Added: </span><ins>{run.change.text}</ins></div>
				</div>
			{:else if run.change.kind === 'removed'}
				<div class="row">
					<div class="cell removed"><span class="visually-hidden">Taken out: </span><del>{run.change.text}</del></div>
					<div class="cell empty" aria-hidden="true"></div>
				</div>
			{:else}
				{@const pieces = run.change.pieces}
				<div class="row">
					<div class="cell before" aria-hidden={layout === 'single' ? 'true' : undefined}>
						{#each pieces as piece, at (at)}{#if piece.kind === 'same'}{piece.text}{:else if piece.kind === 'removed'}<del>{piece.text}</del>{/if}{/each}
					</div>
					<div class="cell after">
						{#if layout === 'single'}
							{#each pieces as piece, at (at)}{#if piece.kind === 'same'}{piece.text}{:else if piece.kind === 'added'}<ins>{piece.text}</ins>{:else}<del>{piece.text}</del>{/if}{/each}
						{:else}
							{#each pieces as piece, at (at)}{#if piece.kind === 'same'}{piece.text}{:else if piece.kind === 'added'}<ins>{piece.text}</ins>{/if}{/each}
						{/if}
					</div>
				</div>
			{/if}
		{/each}
	</div>
{/if}

<style>
	.layout-choice {
		display: flex;
		gap: var(--space-2);
		margin-block: var(--space-3);
	}

	.chip {
		border: 1px solid var(--color-control-border);
		border-radius: 999px;
		padding: 0 var(--space-3);
		min-height: var(--layout-target-minimum);
		background: var(--color-paper);
		color: var(--color-ink);
		font: inherit;
	}

	.chip[aria-pressed='true'] {
		background: var(--color-notice-background);
		font-weight: var(--font-weight-semibold);
	}

	.comparison {
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		overflow: hidden;
	}

	.heads,
	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}

	.heads > div {
		background: var(--color-surface);
		padding: var(--space-2) var(--space-3);
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-small);
		border-bottom: 1px solid var(--color-line);
	}

	.row {
		margin: 0;
		border-bottom: 1px solid var(--color-line);
	}

	.cell {
		padding: var(--space-2) var(--space-3);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.cell + .cell {
		border-left: 1px solid var(--color-line);
	}

	.cell.both {
		grid-column: 1 / -1;
		color: var(--color-ink-muted);
	}

	.cell.empty {
		background: var(--color-surface);
	}

	.same summary {
		background: var(--color-surface);
		padding: var(--space-1) var(--space-3);
		text-align: center;
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
		border-bottom: 1px solid var(--color-line);
		cursor: pointer;
	}

	ins {
		background: var(--color-added-background);
		color: var(--color-ink);
		text-decoration: underline;
		text-decoration-thickness: 1px;
	}

	del {
		background: var(--color-removed-background);
		color: var(--color-ink);
	}

	.single .heads,
	.single .cell.before,
	.single .cell.empty {
		display: none;
	}

	.single .heads,
	.single .row {
		grid-template-columns: 1fr;
	}

	.single .cell + .cell {
		border-left: 0;
	}

	@media (max-width: 48rem) {
		.heads {
			display: none;
		}

		.row {
			grid-template-columns: 1fr;
		}

		.cell + .cell {
			border-left: 0;
			border-top: 1px dashed var(--color-line);
		}

		.cell.empty {
			display: none;
		}
	}
</style>
