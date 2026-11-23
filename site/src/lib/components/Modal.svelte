<script lang="ts" generics="SectionIdentifier extends string">
	// The site's shared modal dialog (site/DESIGN.md, section 6, "Modal"). It
	// is the browser's own <dialog> opened with showModal(): focus moves into
	// it and stays there, Escape closes it, and the page behind is inert.
	//
	// With sections it has two panels: a list of sections on the left and the
	// chosen section on the right. The list follows the WAI-ARIA tabs pattern:
	// arrow keys move between sections, Home and End jump to the first and
	// last. On narrow screens the list wraps above the section. Without
	// sections it shows its children in one panel.
	import type { Component, Snippet } from 'svelte';
	import X from '@lucide/svelte/icons/x';

	interface Section {
		id: SectionIdentifier;
		label: string;
		icon?: Component<{ size?: number; strokeWidth?: number }>;
	}

	let {
		title,
		sections = [],
		selected = $bindable(),
		section,
		children,
		actions,
		fitContent = false,
		onclose
	}: {
		title: string;
		sections?: Section[];
		selected?: SectionIdentifier;
		/** Renders the chosen section. */
		section?: Snippet<[SectionIdentifier]>;
		children?: Snippet;
		/** Buttons along the bottom, such as "Done". */
		actions?: Snippet;
		/** Sizes the dialog to what it holds, for a short form, instead of a fixed height. */
		fitContent?: boolean;
		onclose?: () => void;
	} = $props();

	const identifier = $props.id();
	let dialog: HTMLDialogElement | undefined = $state();
	const current = $derived(selected ?? sections[0]?.id);

	export function open(): void {
		dialog?.showModal();
	}

	export function close(): void {
		dialog?.close();
	}

	function choose(index: number): void {
		const count = sections.length;
		const next = sections[(index + count) % count];
		selected = next.id;
		document.getElementById(`${identifier}-tab-${next.id}`)?.focus();
	}

	function onTabKey(event: KeyboardEvent, index: number): void {
		const moves: Record<string, number> = {
			ArrowDown: index + 1,
			ArrowRight: index + 1,
			ArrowUp: index - 1,
			ArrowLeft: index - 1,
			Home: 0,
			End: sections.length - 1
		};
		if (event.key in moves) {
			event.preventDefault();
			choose(moves[event.key]);
		}
	}
</script>

<dialog bind:this={dialog} class="modal" class:fit-content={fitContent} aria-labelledby="{identifier}-title" {onclose}>
	<div class="modal-top">
		<h2 id="{identifier}-title">{title}</h2>
		<button class="icon-button close-button" type="button" aria-label="Close" title="Close" onclick={close}>
			<X size={24} />
		</button>
	</div>

	{#if sections.length > 0 && section && current}
		<div class="modal-body two-panels">
			<div class="section-list" role="tablist" aria-orientation="vertical" aria-label="{title} sections">
				{#each sections as item, index (item.id)}
					{@const isCurrent = item.id === current}
					<button
						type="button"
						role="tab"
						id="{identifier}-tab-{item.id}"
						aria-selected={isCurrent}
						aria-controls="{identifier}-panel"
						tabindex={isCurrent ? 0 : -1}
						onclick={() => (selected = item.id)}
						onkeydown={(event) => onTabKey(event, index)}
					>
						{#if item.icon}<item.icon size={20} strokeWidth={1.75} />{/if}
						<span>{item.label}</span>
					</button>
				{/each}
			</div>
			<div
				class="section-panel"
				role="tabpanel"
				id="{identifier}-panel"
				aria-labelledby="{identifier}-tab-{current}"
			>
				{@render section(current)}
			</div>
		</div>
	{:else}
		<div class="modal-body">
			<div class="section-panel">{@render children?.()}</div>
		</div>
	{/if}

	{#if actions}
		<div class="modal-actions">{@render actions()}</div>
	{/if}
</dialog>

<style>
	/* A dialog sits in the top layer but inherits from where it is in the
	   page, so it sets its own colors. */
	.modal {
		width: min(58rem, calc(100% - 2 * var(--space-4)));
		height: min(46rem, calc(100% - 2 * var(--space-4)));
		max-width: none;
		max-height: none;
		padding: 0;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-panel);
		background: var(--color-paper);
		color: var(--color-ink);
		overflow: hidden;
	}

	.modal.fit-content {
		width: min(36rem, calc(100% - 2 * var(--space-4)));
		/* "auto" would stretch a dialog to the full window; this follows its content. */
		height: fit-content;
		max-height: calc(100% - 2 * var(--space-4));
	}

	/* Opening fades the dialog in as it rises into place (site/DESIGN.md, section 6, "Motion"). */
	.modal[open] {
		display: flex;
		flex-direction: column;
		transition:
			opacity var(--motion-duration-medium) var(--motion-easing-enter),
			translate var(--motion-duration-medium) var(--motion-easing-enter);

		@starting-style {
			opacity: 0;
			translate: 0 var(--space-2);
		}
	}

	.modal::backdrop {
		background: var(--color-band);
		opacity: 0.6;
		transition: opacity var(--motion-duration-medium) var(--motion-easing-enter);
	}

	.modal[open]::backdrop {
		@starting-style {
			opacity: 0;
		}
	}

	.modal :global(label) {
		color: var(--color-ink);
	}

	.modal-top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-5);
		border-bottom: 1px solid var(--color-line);
	}

	.modal-top h2 {
		margin: 0;
	}

	.modal-actions :global(.button) {
		gap: var(--space-2);
	}

	/* An X alone, as Trevor asked on Nov. 22, 2026; its name, "Close", comes from aria-label. */
	.close-button {
		flex-shrink: 0;
	}

	.modal-body {
		flex: 1;
		min-height: 0;
		display: flex;
	}

	.section-list {
		flex: 0 0 auto;
		width: 15rem;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-3);
		border-right: 1px solid var(--color-line);
		background: var(--color-surface);
		overflow-y: auto;
	}

	.section-list button {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		padding: var(--space-2) var(--space-3);
		border: 0;
		border-left: 4px solid transparent;
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.section-list button:hover {
		text-decoration: underline;
	}

	/* The chosen section is marked by weight and a bar, not color alone. */
	.section-list button[aria-selected='true'] {
		border-left-color: var(--color-action);
		background: var(--color-paper);
		font-weight: var(--font-weight-bold);
	}

	.section-panel {
		flex: 1;
		min-width: 0;
		overflow-y: auto;
		padding: var(--space-4) var(--space-5) var(--space-5);
	}

	.modal-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-5);
		border-top: 1px solid var(--color-line);
	}

	@media (max-width: 40rem) {
		.modal {
			width: calc(100% - 2 * var(--space-2));
			height: calc(100% - 2 * var(--space-2));
		}

		.modal.fit-content {
			height: fit-content;
		}

		.two-panels {
			flex-direction: column;
		}

		.section-list {
			width: auto;
			flex-direction: row;
			flex-wrap: wrap;
			border-right: 0;
			border-bottom: 1px solid var(--color-line);
			padding: var(--space-2);
		}

		.section-list button {
			border-left: 0;
			border-bottom: 4px solid transparent;
		}

		.section-list button[aria-selected='true'] {
			border-bottom-color: var(--color-action);
		}

		.modal-top,
		.section-panel,
		.modal-actions {
			padding-left: var(--space-3);
			padding-right: var(--space-3);
		}
	}
</style>
