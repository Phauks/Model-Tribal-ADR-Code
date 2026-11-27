<!--
	@component
	A code section's status as a small label that says it in words, so it does
	not rely on color (design/title-25-navigation, option A): "In force",
	"Repealed", "Moved to § 5321", "Omitted".
-->
<script lang="ts">
	import { statusLabels, type SectionStatus } from '#lib/code-outline.ts';

	let { status, movedTo }: { status: SectionStatus; movedTo?: { label: string; link?: string } } = $props();
</script>

<span class="status-tag status-{status.replace(' ', '-')}">{statusLabels[status]}{#if status === 'moved' && movedTo}{' '}to {#if movedTo.link}<a href={movedTo.link}>{movedTo.label}</a>{:else}{movedTo.label}{/if}{/if}</span>

<style>
	.status-tag {
		display: inline-block;
		border: 1px solid currentColor;
		border-radius: 999px;
		padding: 0.05rem 0.45rem;
		font-family: var(--font-family-interface, inherit);
		font-size: 0.75rem;
		font-style: normal;
		font-weight: 600;
		line-height: 1.4;
		white-space: nowrap;
		vertical-align: 0.08em;
		color: var(--color-ink-muted);
	}

	.status-tag a {
		color: inherit;
	}

	.status-in-force {
		color: var(--color-status-published);
		background: var(--color-status-published-background);
		border-color: var(--color-status-published-rule);
	}

	.status-repealed {
		color: var(--color-danger);
	}

	.status-moved {
		color: var(--color-link);
	}
</style>
