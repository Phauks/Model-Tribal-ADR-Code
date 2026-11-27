<script lang="ts" generics="OptionIdentifier extends string">
	// The site's shared rounded switch: a few short choices in one rounded
	// track, the chosen one a rounded pill filled in the action color (Trevor,
	// Nov. 27, 2026, mockup B1 in project files design/citation-styles/
	// rounded-switch/: "should create common component"). First used for the
	// citation styles in the Cite dropdown (CiteMenu.svelte).
	//
	// Each choice shows a different panel, so it follows the WAI-ARIA tabs
	// pattern: one tab stop, the arrow keys move between choices and choose,
	// and Home and End jump to the first and last. The page draws the panel
	// itself and gives its id as `panel`.
	interface Option {
		id: OptionIdentifier;
		label: string;
		/** A longer name, shown on hover. */
		title?: string;
	}

	let {
		options,
		selected = $bindable(),
		label,
		panel,
		onchange
	}: {
		options: readonly Option[];
		selected: OptionIdentifier;
		/** The switch's name for screen readers, such as "Citation style". */
		label: string;
		/** The id of the panel the choices show. */
		panel: string;
		onchange?: (id: OptionIdentifier) => void;
	} = $props();

	const identifier = $props.id();

	function choose(id: OptionIdentifier, focus = false): void {
		selected = id;
		onchange?.(id);
		if (focus) document.getElementById(`${identifier}-${id}`)?.focus();
	}

	function onkeydown(event: KeyboardEvent, index: number): void {
		const moves: Record<string, number> = { ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: options.length - 1 };
		if (!(event.key in moves)) return;
		event.preventDefault();
		const count = options.length;
		choose(options[(moves[event.key] + count) % count].id, true);
	}
</script>

<div class="rounded-switch" role="tablist" aria-label={label}>
	{#each options as option, index (option.id)}
		{@const current = option.id === selected}
		<button
			type="button"
			role="tab"
			id="{identifier}-{option.id}"
			class="choice"
			aria-selected={current}
			aria-controls={panel}
			tabindex={current ? 0 : -1}
			title={option.title}
			onclick={() => choose(option.id)}
			onkeydown={(event) => onkeydown(event, index)}
		>
			{option.label}
		</button>
	{/each}
</div>

<style>
	.rounded-switch {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 2px;
		padding: 3px;
		border-radius: 999px;
		background: var(--color-surface);
		box-shadow: inset 0 0 0 1px var(--color-line);
	}

	.choice {
		min-height: 2.25rem;
		padding: 0 var(--space-3);
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--color-ink-muted);
		font: inherit;
		font-size: var(--font-size-small);
		white-space: nowrap;
		cursor: pointer;
	}

	.choice:hover {
		color: var(--color-ink);
	}

	/* The chosen one is marked by fill and weight, not color alone. */
	.choice[aria-selected='true'] {
		background: var(--color-action);
		color: var(--color-action-text);
		font-weight: var(--font-weight-semibold);
	}


	@media (forced-colors: active) {
		.choice[aria-selected='true'] {
			outline: 2px solid ButtonText;
		}
	}
</style>
