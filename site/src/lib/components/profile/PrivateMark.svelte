<!-- Marks an answer the project never shows: only the lead author and editors see it (docs/contributor-profiles.md). -->
<script lang="ts">
	import Lock from '@lucide/svelte/icons/lock';
</script>

<span class="private-mark"><Lock size={16} strokeWidth={1.75} aria-hidden="true" /> Private</span>

<style>
	.private-mark {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
		white-space: nowrap;
	}
</style>
