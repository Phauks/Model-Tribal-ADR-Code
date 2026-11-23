<script lang="ts">
	// The status badge on a page about a nation (src/lib/review-status.ts). The
	// badge is the control: selecting it opens a small panel with who keeps the
	// page or reviewed it and what a reader can do, such as claim the page
	// (Trevor, Nov. 23, 2026). It is a <details> element, so it works without
	// scripts; with scripts, a click elsewhere or Escape closes it. The Worker
	// draws the same markup for a claimed nation page
	// (src/lib/server/nation-page-overlay.ts), and the closing code here serves
	// both. The panel never prints.
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Clock from '@lucide/svelte/icons/clock';
	import { onMount, type Snippet } from 'svelte';
	import type { HTMLDetailsAttributes } from 'svelte/elements';
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
		/** The panel's contents. */
		children: Snippet;
	} & HTMLDetailsAttributes = $props();

	onMount(() => {
		const close = (except?: EventTarget | null) => {
			for (const open of document.querySelectorAll<HTMLDetailsElement>('details.status-popover[open]')) {
				if (!(except instanceof Node && open.contains(except))) open.open = false;
			}
		};
		const onClick = (event: MouseEvent) => close(event.target);
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			const open = document.querySelector<HTMLDetailsElement>('details.status-popover[open]');
			if (!open) return;
			open.open = false;
			open.querySelector('summary')?.focus();
		};
		document.addEventListener('click', onClick);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('click', onClick);
			document.removeEventListener('keydown', onKey);
		};
	});
</script>

<details class="status-popover" {...attributes}>
	<summary class="review-badge" class:review-badge-verified={status.verified}
		><span class="visually-hidden">{description}</span>{#if status.verified}<Check
				size={16}
				strokeWidth={2}
				aria-hidden="true"
			/>{:else}<Clock size={16} strokeWidth={2} aria-hidden="true" />{/if}{status.label}<ChevronDown
			class="status-popover-mark"
			size={14}
			strokeWidth={2}
			aria-hidden="true"
		/></summary
	>
	<div class="status-panel">
		{@render children()}
	</div>
</details>
