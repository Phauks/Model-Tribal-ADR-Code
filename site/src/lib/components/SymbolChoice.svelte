<script lang="ts" generics="Value extends string">
	// A setting picked by symbol (site/DESIGN.md, section 6, "Settings"): text
	// alignment, and the theme in the cog's Page settings popover
	// (PageSettings.svelte). Each symbol is a radio button whose name is read
	// out, with a tooltip; the symbols sit side by side in one bordered
	// strip, and the picked one is filled and has a bar under its symbol, not
	// color alone. With hints, the picked choice's name and hint show in words
	// below (the Settings dialog); without, the strip sits beside its legend
	// on one line (the popover).
	import type { Component } from 'svelte';
	import type { Choice } from '#lib/reading-settings.ts';

	let {
		legend,
		name,
		choices,
		icons,
		value,
		hints = true,
		onchange
	}: {
		legend: string;
		/** The radio group's name, unique on the page. */
		name: string;
		choices: Choice<Value>[];
		icons: Record<Value, Component<{ size?: number }>>;
		value: Value;
		hints?: boolean;
		onchange: (value: Value) => void;
	} = $props();
</script>

<fieldset class="symbol-setting" class:inline={!hints}>
	<legend>{legend}</legend>
	<div class="symbol-choices">
		{#each choices as choice (choice.value)}
			{@const Icon = icons[choice.value]}
			<label class="symbol-choice" title={choice.label}>
				<input
					class="visually-hidden"
					type="radio"
					{name}
					value={choice.value}
					checked={value === choice.value}
					aria-describedby={hints && choice.hint ? `${name}-${choice.value}-hint` : undefined}
					onchange={() => onchange(choice.value)}
				/>
				<Icon size={24} />
				<span class="visually-hidden">{choice.label}</span>
			</label>
		{/each}
	</div>
	{#if hints}
		{#each choices as choice (choice.value)}
			<p class="hint symbol-hint" id="{name}-{choice.value}-hint" hidden={value !== choice.value}>
				<strong>{choice.label}.</strong>
				{choice.hint}
			</p>
		{/each}
	{/if}
</fieldset>

<style>
	.symbol-setting {
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}

	legend {
		font-weight: var(--font-weight-bold);
		margin-bottom: var(--space-1);
		padding: 0;
	}

	/* In the popover the legend and the strip share a line: the legend floats left, the strip sits at the right. */
	.inline {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.inline legend {
		float: left;
		margin: 0;
	}

	.inline .symbol-choices {
		margin-left: auto;
	}

	.symbol-choices {
		display: inline-flex;
		border: 2px solid var(--color-control-border);
		border-radius: var(--radius-control);
		overflow: hidden;
	}

	.symbol-choice {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: var(--layout-target-minimum);
		min-height: var(--layout-target-minimum);
		padding: var(--space-1) var(--space-3);
		box-sizing: border-box;
		background: var(--color-paper);
		color: var(--color-ink);
		cursor: pointer;
	}

	.symbol-choice + .symbol-choice {
		border-left: 2px solid var(--color-control-border);
	}

	.symbol-choice:has(input:checked) {
		background: var(--color-action);
		color: var(--color-action-text);
		box-shadow: inset 0 -4px 0 var(--color-action-text);
	}

	.symbol-choice:has(input:focus-visible) {
		outline: 3px solid var(--focus-ring);
		outline-offset: -3px;
	}

	.symbol-hint {
		margin: var(--space-1) 0 0;
	}
</style>
