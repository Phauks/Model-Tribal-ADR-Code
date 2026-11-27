<script lang="ts">
	// What keeps outreach from sending, said once at the top of the Outreach pages (design/outreach-redesign). Batches can still be written and scheduled; nothing goes out until the problems are fixed.
	import { outreachBase } from './views.ts';

	let { problems }: { problems: string[] } = $props();
</script>

{#if problems.length}
	<div class="notice readiness" role="status">
		<p>Nothing goes out until the outreach mailbox is set up. Batches can be written and scheduled now.</p>
		<a href="{outreachBase}/settings">Outreach settings</a>
	</div>
{/if}

<style>
	.readiness {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-4);
	}
	.readiness p {
		flex: 1 1 20rem;
		margin: 0;
	}
	.readiness a {
		white-space: nowrap;
	}
</style>
