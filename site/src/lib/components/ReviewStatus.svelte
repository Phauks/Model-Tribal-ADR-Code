<script lang="ts">
	// The status line for a page about a nation: the badge, then the working
	// links (src/lib/review-status.ts). Attributes such as id or
	// data-print-part pass through to the line.
	import Check from '@lucide/svelte/icons/check';
	import Clock from '@lucide/svelte/icons/clock';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { ReviewStatus } from '#lib/review-status.ts';

	let {
		status,
		description,
		children,
		...attributes
	}: {
		status: ReviewStatus;
		/** Read before the badge by screen readers, such as "Who keeps this page:". */
		description: string;
		children?: Snippet;
	} & HTMLAttributes<HTMLParagraphElement> = $props();
</script>

<p class="review-status small" {...attributes}>
	<span class="visually-hidden">{description}</span>
	<span class="review-badge" class:review-badge-verified={status.verified}
		>{#if status.verified}<Check size={16} strokeWidth={2} aria-hidden="true" />{:else}<Clock
				size={16}
				strokeWidth={2}
				aria-hidden="true"
			/>{/if}{status.label}</span
	>
	{@render children?.()}
</p>
