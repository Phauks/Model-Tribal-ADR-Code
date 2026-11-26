<script lang="ts" generics="Value extends string">
	// A setting picked on a slider (site/DESIGN.md, section 6, "Settings"):
	// text size and text width, in the Settings dialog and in the cog's Page
	// settings popover (PageSettings.svelte), so both show the same control.
	// It steps through the choices in order; arrow keys move one step, Home
	// and End jump to the ends. The current choice shows beside the label and
	// is read out as words. Text size shows a small and a large "A" at its
	// ends, at a fixed size, since the setting changes text (Trevor, Nov. 22,
	// 2026); text width shows Narrow and Full.
	import type { Choice } from '#lib/reading-settings.ts';

	let {
		id,
		label,
		choices,
		value,
		fallback,
		valueText,
		ends,
		onchange
	}: {
		id: string;
		label: string;
		choices: Choice<Value>[];
		value: Value;
		/** The choice shown when the stored one is not among the choices. */
		fallback: Value;
		/** What a screen reader reads for a choice, such as "100 percent". */
		valueText: (choice: Choice<Value>) => string;
		/** "letters" for a small and a large A, or the words at the two ends. */
		ends: 'letters' | [string, string];
		onchange: (value: Value) => void;
	} = $props();

	const values = $derived(choices.map((choice) => choice.value));
	const index = $derived(values.includes(value) ? values.indexOf(value) : values.indexOf(fallback));
	const current = $derived(choices[index]);
</script>

<div class="setting-slider">
	<div class="slider-label">
		<label for={id}>{label}</label>
		<output for={id} aria-hidden="true">{current.label}</output>
	</div>
	<div class="slider-row">
		{#if ends === 'letters'}
			<span class="slider-end slider-end-small" aria-hidden="true">A</span>
		{:else}
			<span class="slider-end slider-end-word" aria-hidden="true">{ends[0]}</span>
		{/if}
		<input
			type="range"
			{id}
			min="0"
			max={choices.length - 1}
			step="1"
			value={index}
			aria-valuetext={valueText(current)}
			oninput={(event) => onchange(values[Number(event.currentTarget.value)])}
		/>
		{#if ends === 'letters'}
			<span class="slider-end slider-end-large" aria-hidden="true">A</span>
		{:else}
			<span class="slider-end slider-end-word" aria-hidden="true">{ends[1]}</span>
		{/if}
	</div>
</div>

<style>
	.slider-label {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
		margin-bottom: var(--space-1);
	}

	.slider-label label {
		font-weight: var(--font-weight-bold);
	}

	.slider-label output {
		font-weight: var(--font-weight-semibold);
		font-variant-numeric: tabular-nums;
	}

	.slider-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.slider-row input {
		flex: 1;
		min-width: 0;
		min-height: var(--layout-target-minimum);
		margin: 0;
		accent-color: var(--color-action);
		cursor: pointer;
	}

	/* The ends show which way is smaller or narrower; they stay a fixed size, since the setting changes text. */
	.slider-end {
		flex: none;
		line-height: 1;
		color: var(--color-ink-muted);
	}

	.slider-end-word {
		font-size: var(--font-size-small);
	}

	.slider-end-small {
		font-size: 1rem;
	}

	.slider-end-large {
		font-size: 1.5rem;
	}
</style>
