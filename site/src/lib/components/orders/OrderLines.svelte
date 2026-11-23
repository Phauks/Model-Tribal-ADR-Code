<script lang="ts">
	// The items in one order, each with an icon for its kind (src/lib/orders.ts).
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Package from '@lucide/svelte/icons/package';
	import type { OrderLine } from '#lib/orders.ts';

	let { lines, showMaker = false }: { lines: OrderLine[]; showMaker?: boolean } = $props();
</script>

<ul class="lines">
	{#each lines as line, index (index)}
		<li>
			<span class="icon" aria-hidden="true">
				{#if line.kind === 'book'}<BookOpen size={18} />{:else}<Package size={18} />{/if}
			</span>
			<span>
				{line.quantity > 1 ? `${line.quantity} × ` : ''}{line.label}<span class="muted">{line.detail ? ` · ${line.detail}` : ''}</span>
				{#if showMaker}
					<br /><span class="small muted"
						>{line.maker}{line.makerJob ? ` job ${line.makerJob}` : ''}{line.makerStatus ? `, ${line.makerStatus}` : ''}</span
					>
				{/if}
			</span>
		</li>
	{/each}
</ul>

<style>
	.lines {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-1);
	}
	li {
		display: flex;
		gap: var(--space-2);
		align-items: baseline;
	}
	.icon {
		flex: none;
		color: var(--color-ink-muted);
		transform: translateY(3px);
	}
</style>
