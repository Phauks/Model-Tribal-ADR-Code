<!--
	A dropdown that holds several choices at once, such as how a person is
	connected to a nation ("member, and works there"). It is a <details> with
	checkboxes, so it opens, closes and sends its choices before scripts run;
	with scripts it also closes on Escape or a click outside it. The closed
	box lists what is ticked.
-->
<script lang="ts" generics="Value extends string">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';

	let {
		name,
		label,
		choices,
		labels,
		chosen = $bindable([]),
		placeholder = 'Choose'
	}: {
		name: string;
		/** What a screen reader hears for the box, such as "Your connection to Navajo Nation". */
		label: string;
		choices: readonly Value[];
		labels: Record<Value, string>;
		chosen?: Value[];
		placeholder?: string;
	} = $props();

	const identifier = $props.id();
	let details: HTMLDetailsElement | undefined = $state();

	const summary = $derived(
		choices
			.filter((choice) => chosen.includes(choice))
			.map((choice) => labels[choice])
			.join(', ')
	);

	function toggle(choice: Value, on: boolean): void {
		chosen = on ? [...chosen, choice] : chosen.filter((value) => value !== choice);
	}

	function closeOutside(event: PointerEvent): void {
		if (details?.open && !details.contains(event.target as Node)) details.open = false;
	}

	function closeOnEscape(event: KeyboardEvent): void {
		if (event.key === 'Escape' && details?.open) {
			event.stopPropagation();
			details.open = false;
			details.querySelector('summary')?.focus();
		}
	}
</script>

<svelte:document onpointerdown={closeOutside} />

<!-- Escape closes the open list, as in the site's other dropdowns; the <summary> inside is the control. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<details class="check-dropdown" bind:this={details} onkeydown={closeOnEscape}>
	<summary aria-label="{label}: {summary || 'none chosen'}">
		<span class="check-dropdown-value" class:empty={!summary}>{summary || placeholder}</span>
		<ChevronDown size={20} strokeWidth={1.75} aria-hidden="true" />
	</summary>
	<fieldset class="check-dropdown-list">
		<legend class="visually-hidden">{label}</legend>
		{#each choices as choice (choice)}
			<label class="check-dropdown-choice" for="{identifier}-{choice}">
				<input
					type="checkbox"
					id="{identifier}-{choice}"
					{name}
					value={choice}
					checked={chosen.includes(choice)}
					onchange={(event) => toggle(choice, event.currentTarget.checked)}
				/>
				{labels[choice]}
			</label>
		{/each}
	</fieldset>
</details>

<style>
	.check-dropdown {
		position: relative;
		width: 100%;
	}

	.check-dropdown summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		box-sizing: border-box;
		padding: var(--space-1) var(--space-2) var(--space-1) var(--space-3);
		border: 2px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink);
		cursor: pointer;
		list-style: none;
	}

	.check-dropdown summary::-webkit-details-marker {
		display: none;
	}

	.check-dropdown[open] summary :global(svg) {
		transform: rotate(180deg);
	}

	.check-dropdown-value {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.check-dropdown-value.empty {
		color: var(--color-ink-muted);
	}

	.check-dropdown-list {
		position: absolute;
		z-index: 3;
		top: calc(100% + var(--space-1));
		left: 0;
		min-width: 100%;
		box-sizing: border-box;
		margin: 0;
		padding: var(--space-1) 0;
		border: 2px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-surface-raised);
	}

	.check-dropdown-choice {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		white-space: nowrap;
		cursor: pointer;
	}

	.check-dropdown-choice:hover {
		background: color-mix(in srgb, currentColor 10%, transparent);
	}

	.check-dropdown-choice input {
		width: 1.25rem;
		height: 1.25rem;
		margin: 0;
		flex: none;
	}
</style>
