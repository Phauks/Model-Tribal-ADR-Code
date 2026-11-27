<!--
	@component
	The filters beside a long list, held apart from it so the reader can change
	them at any point in the list (Trevor, Nov. 27, 2026: "when scrolling
	through timeline, only scroll through timeline part, do not scroll through
	the filters"). On wide screens they are a column that stays in view while
	the page scrolls and scrolls on its own when it is taller than the window.
	On narrow screens they are put away behind a Filters button the page keeps
	in its held toolbar, and open as a sheet along the bottom of the window
	that scrolls on its own, as the case card does (CaseVoteCard.svelte), with
	the list still in view above it.

	The sheet is not modal, so the list above it changes as the reader ticks.
	Opening it moves focus into it; Escape, the Close button or moving focus
	out of it closes it, so focus never sits behind it (WCAG 2.2, 2.4.11), and
	closing it with Escape or Close sends focus back to the Filters button. The
	button is the page's own, with aria-controls naming `id` and aria-expanded
	bound to `open`.

	Use:
	<FilterSheet id="timeline-filters" bind:open count={filterCount}>…fieldsets…</FilterSheet>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import X from '@lucide/svelte/icons/x';
	import CountBadge from './CountBadge.svelte';

	interface Props {
		/** The form's id, which the page's Filters button names in aria-controls. */
		id: string;
		/** Whether the sheet is open on a narrow screen. */
		open?: boolean;
		/** How many filters are set, shown beside the sheet's heading. */
		count?: number;
		children: Snippet;
	}

	let { id, open = $bindable(false), count = 0, children }: Props = $props();

	let form = $state<HTMLFormElement>();
	const headingId = $derived(`${id}-heading`);

	const opener = () => document.querySelector<HTMLElement>(`[aria-controls="${id}"]`);
	/** The sheet is shown only on narrow screens; on wide ones the column is always there. */
	const isSheet = () => !!form && getComputedStyle(form).position === 'fixed';

	function close(returnFocus: boolean) {
		open = false;
		if (returnFocus) opener()?.focus();
	}

	$effect(() => {
		if (open && form && isSheet()) form.querySelector<HTMLElement>('.sheet-heading')?.focus();
	});

	// Listened for on the form itself, which holds the controls, rather than through attributes on a non-interactive element.
	$effect(() => {
		if (!form) return;
		const target = form;
		target.addEventListener('keydown', onkeydown);
		target.addEventListener('focusout', onfocusout);
		return () => {
			target.removeEventListener('keydown', onkeydown);
			target.removeEventListener('focusout', onfocusout);
		};
	});

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open && isSheet()) {
			event.stopPropagation();
			close(true);
		}
	}

	function onfocusout(event: FocusEvent) {
		const next = event.relatedTarget as Node | null;
		// A searchable dropdown's list sits in the top layer, outside the form, so focus there stays inside.
		if (!open || !isSheet() || !next || form?.contains(next) || next === opener()) return;
		if ((next as Element).closest?.('[popover]')) return;
		close(false);
	}
</script>

<form bind:this={form} class="filter-sheet no-print" class:open {id} aria-labelledby={headingId} onsubmit={(event) => event.preventDefault()}>
	<div class="sheet-bar">
		<span class="grip" aria-hidden="true"></span>
		<h2 class="sheet-heading" id={headingId} tabindex="-1">Filters{#if count > 0}<CountBadge {count} label={count === 1 ? 'filter set' : 'filters set'} />{/if}</h2>
		<button type="button" class="icon-button close" aria-label="Close filters" title="Close filters" onclick={() => close(true)}>
			<X size={20} aria-hidden="true" />
		</button>
	</div>
	{@render children()}
</form>

<style>
	/* Beside the list: held below the top of the window, scrolling on its own when taller than it. */
	.filter-sheet {
		--held-top: var(--masthead-stuck, 0px);
		position: sticky;
		top: calc(var(--held-top) + var(--space-3));
		max-height: calc(100dvh - var(--held-top) - 2 * var(--space-3));
		overflow-y: auto;
		overscroll-behavior: contain;
		scrollbar-gutter: stable;
		/* Room for the focus ring of the controls at its edges. */
		padding: 3px var(--space-2) 3px 3px;
		margin: -3px 0 0 -3px;
		font-size: var(--font-size-small);
	}

	/* Between 52rem and 64rem the side column's Menu bar is held at the top of the window too. */
	@media (max-width: 63.99rem) {
		.filter-sheet {
			--held-top: calc(var(--masthead-stuck, 0px) + var(--layout-target-minimum) + 1px);
		}
	}

	.sheet-bar {
		display: none;
	}

	.sheet-heading {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
		font-size: 1.1rem;
	}

	.sheet-heading:focus {
		outline: none;
	}

	.sheet-heading:focus-visible {
		outline: var(--focus-ring);
		outline-offset: 2px;
	}

	/* Narrow screens: behind the page's Filters button, as a sheet along the bottom of the window. */
	@media (max-width: 52rem) {
		.filter-sheet {
			display: none;
			position: fixed;
			z-index: 20;
			left: 0;
			right: 0;
			bottom: 0;
			top: auto;
			max-height: 70dvh;
			margin: 0;
			padding: 0 var(--space-4) var(--space-4);
			border: 1px solid var(--color-line);
			border-bottom: 0;
			border-radius: 14px 14px 0 0;
			background: var(--color-paper);
			box-shadow: 0 -6px 24px color-mix(in srgb, var(--color-ink) 22%, transparent);
		}

		.filter-sheet.open {
			display: block;
		}

		/* The sheet's heading and Close stay at its top while its filters scroll under them. */
		.sheet-bar {
			position: sticky;
			top: 0;
			z-index: 1;
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin: 0 calc(-1 * var(--space-4)) var(--space-2);
			padding: var(--space-4) var(--space-2) var(--space-2) var(--space-4);
			border-bottom: 1px solid var(--color-line);
			background: var(--color-paper);
		}

		.grip {
			position: absolute;
			top: 6px;
			left: 50%;
			transform: translateX(-50%);
			width: 40px;
			height: 4px;
			border-radius: 2px;
			background: var(--color-line);
		}
	}

	@media (forced-colors: active) {
		.filter-sheet {
			border-color: CanvasText;
		}
	}
</style>
