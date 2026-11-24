<script lang="ts" module>
	import type { Choice } from '#lib/reading-settings.ts';

	/** One choice in a dropdown. Choices with the same group are listed together under the group's name, in the order given. */
	export interface DropdownChoice<Value extends string> extends Choice<Value> {
		group?: string;
	}
</script>

<script lang="ts" generics="Value extends string">
	// A dropdown for picking one choice (site/DESIGN.md, section 6,
	// "Dropdown"). It follows the WAI-ARIA select-only combobox pattern
	// (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/)
	// rather than the browser's own <select>, because a <select> list cannot
	// show each choice in its own typeface on every browser and device, and
	// the font setting needs that. Keys: Down, Up, Enter, Space or a letter
	// opens the list; Up and Down move; Home and End jump to the first and
	// last; Enter, Space or Tab picks; Escape closes the list without
	// closing the dialog around it.
	//
	// Given a name, it is a form field: a hidden input sends the picked
	// value, and without scripts the browser's own <select> stands in for
	// it, so the form still works. With the label inside, the label sits in
	// the box before the picked choice and the box fills its column, as in
	// the gift panel on the Sponsorship page.
	//
	// A pick also sends a change event from the hidden input, so a form that
	// listens for changes (a filter bar that applies itself, or one that sends
	// itself on change) hears the dropdown as it heard the <select>. An icon
	// can sit before the picked choice, as in the Recent changes filters.
	//
	// As a form field it does what the <select> it replaced did: required
	// (an empty choice stops the form, marks the box and moves to it),
	// disabled (not sent, not focusable), invalid with the error it is
	// described by, a field of another form (form), a label for screen
	// readers only, and choices in named groups.
	import { onMount, tick, type Component, type Snippet } from 'svelte';
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';

	let {
		label,
		choices,
		value = $bindable(),
		onchange,
		choiceStyle,
		name,
		labelInside = false,
		icon: Icon,
		id,
		required = false,
		disabled = false,
		invalid = false,
		describedBy,
		form,
		hideLabel = false,
		message
	}: {
		label: string;
		choices: DropdownChoice<Value>[];
		value: Value;
		onchange?: (value: Value) => void;
		/** Inline style for a choice, such as its own font-family. The closed dropdown uses the picked choice's style too. */
		choiceStyle?: (value: Value) => string | undefined;
		/** The form field's name, for a dropdown inside a form. */
		name?: string;
		/** Puts the label inside the box, before the picked choice, and lets the box fill its column. */
		labelInside?: boolean;
		/** A Lucide icon drawn before the picked choice. */
		icon?: Component<{ size?: string | number; strokeWidth?: number; 'aria-hidden'?: 'true' }>;
		/** The box's id, so an error summary or a link can move to it. */
		id?: string;
		/** An empty choice ('') stops the form from being sent, as a required <select> does. */
		required?: boolean;
		/** Not sent with the form and not focusable, as a disabled <select>. */
		disabled?: boolean;
		/** Marks the box as having an error (aria-invalid and the danger border). */
		invalid?: boolean;
		/** The ids of the elements that describe the box, such as its hint and error. */
		describedBy?: string;
		/** The id of the form the field belongs to, when it sits outside it. */
		form?: string;
		/** Keeps the label for screen readers only, as in a row whose heading already names the box. */
		hideLabel?: boolean;
		/** The field's hint or error, drawn between the label and the box, where other fields show theirs. */
		message?: Snippet;
	} = $props();

	// The <select> sends the value until scripts run; then the hidden input does.
	let scripted = $state(false);

	const identifier = $props.id();
	const boxId = $derived(id ?? `${identifier}-combobox`);
	let expanded = $state(false);
	let active = $state(0);
	let missing = $state(false);
	let combobox: HTMLDivElement | undefined = $state();
	let list: HTMLUListElement | undefined = $state();
	let field: HTMLInputElement | undefined = $state();
	let typed = '';
	let typedTimer: ReturnType<typeof setTimeout> | undefined;

	// A value that is not one of the choices shows and sends the first choice, as a <select> does.
	const selectedIndex = $derived(Math.max(0, choices.findIndex((choice) => choice.value === value)));
	const selected = $derived(choices[selectedIndex] as DropdownChoice<Value> | undefined);
	/** The choices in their groups, keeping the order the groups first appear in. */
	const groups = $derived.by(() => {
		const found = new Map<string, { choice: DropdownChoice<Value>; index: number }[]>();
		choices.forEach((choice, index) => {
			const group = choice.group ?? '';
			if (!found.has(group)) found.set(group, []);
			found.get(group)?.push({ choice, index });
		});
		return [...found.entries()].map(([group, entries]) => ({ group, entries }));
	});
	const describers = $derived([describedBy, selected?.hint ? `${identifier}-hint` : undefined].filter(Boolean).join(' ') || undefined);

	onMount(() => {
		scripted = true;
		if (!required || !name) return;
		// A required dropdown with nothing picked stops its form, as a required <select> would; the browser's own check cannot see a hidden input. A form that checks its own answers (novalidate) is left to do so.
		const owner = form ? document.getElementById(form) : combobox?.closest('form');
		if (!(owner instanceof HTMLFormElement)) return;
		const check = (event: SubmitEvent) => {
			if (disabled || owner.noValidate || event.submitter?.hasAttribute('formnovalidate') || (selected?.value ?? value) !== '') return;
			event.preventDefault();
			event.stopImmediatePropagation();
			missing = true;
			combobox?.focus();
		};
		owner.addEventListener('submit', check, { capture: true });
		return () => owner.removeEventListener('submit', check, { capture: true });
	});

	function optionId(index: number): string {
		return `${identifier}-option-${index}`;
	}

	function show(index = selectedIndex): void {
		if (disabled || choices.length === 0) return;
		expanded = true;
		active = index;
		queueMicrotask(() => {
			// On a short screen the list can open below the fold of the scrolling panel.
			list?.scrollIntoView({ block: 'nearest' });
			scrollActiveIntoView();
		});
	}

	function hide(): void {
		expanded = false;
	}

	function pick(index: number): void {
		const choice = choices[index];
		if (choice && choice.value !== value) {
			value = choice.value;
			missing = false;
			onchange?.(choice.value);
			// After the hidden input holds the new value, as a <select> would have it.
			void tick().then(() => field?.dispatchEvent(new Event('change', { bubbles: true })));
		}
		hide();
	}

	function move(index: number): void {
		active = Math.min(choices.length - 1, Math.max(0, index));
		scrollActiveIntoView();
	}

	function scrollActiveIntoView(): void {
		list?.querySelector(`#${CSS.escape(optionId(active))}`)?.scrollIntoView({ block: 'nearest' });
	}

	/** Type-ahead: letters typed within half a second find the next choice that starts with them. */
	function find(letter: string): number | undefined {
		clearTimeout(typedTimer);
		typed += letter.toLowerCase();
		typedTimer = setTimeout(() => (typed = ''), 500);
		const start = expanded ? active : selectedIndex;
		const ordered = [...choices.keys()].map((offset) => (start + offset + 1) % choices.length);
		const allSame = typed.split('').every((character) => character === typed[0]);
		const match = (search: string) =>
			ordered.find((index) => choices[index].label.trim().toLowerCase().startsWith(search));
		return match(typed) ?? (allSame ? match(typed[0]) : undefined);
	}

	function onKeydown(event: KeyboardEvent): void {
		if (disabled) return;
		const { key, altKey, ctrlKey, metaKey } = event;
		if (!expanded) {
			const opens: Record<string, number | undefined> = {
				ArrowDown: undefined,
				ArrowUp: undefined,
				Enter: undefined,
				' ': undefined,
				Home: 0,
				End: choices.length - 1
			};
			if (key in opens) {
				event.preventDefault();
				show(opens[key]);
			} else if (key.length === 1 && !ctrlKey && !metaKey && !altKey) {
				const found = find(key);
				show(found ?? selectedIndex);
			}
			return;
		}
		if (key === 'Escape') {
			// Keeps the Escape for the list: a cancelled key press does not
			// close the dialog around it.
			event.preventDefault();
			event.stopPropagation();
			hide();
		} else if (key === 'Enter' || key === ' ' || (key === 'ArrowUp' && altKey)) {
			event.preventDefault();
			pick(active);
		} else if (key === 'Tab') {
			pick(active);
		} else if (key === 'ArrowDown') {
			event.preventDefault();
			move(active + 1);
		} else if (key === 'ArrowUp') {
			event.preventDefault();
			move(active - 1);
		} else if (key === 'Home' || key === 'PageUp') {
			event.preventDefault();
			move(0);
		} else if (key === 'End' || key === 'PageDown') {
			event.preventDefault();
			move(choices.length - 1);
		} else if (key.length === 1 && !ctrlKey && !metaKey && !altKey) {
			const found = find(key);
			if (found !== undefined) move(found);
		}
	}
</script>

<div class="dropdown" class:label-inside={labelInside} class:disabled>
	{#if !labelInside}
		<!-- The label is not a <label>, since the combobox is not a form field; selecting it moves focus to the combobox, as a <label> would. The keyboard reaches the combobox itself, so the label needs no keys. -->
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="dropdown-label" class:visually-hidden={hideLabel} id="{identifier}-label" onclick={() => combobox?.focus()}>{label}</div>
	{/if}
	{@render message?.()}
	{#if name}
		<input bind:this={field} type="hidden" name={scripted ? name : undefined} value={selected?.value ?? value} {disabled} {form} />
		<label class="dropdown-fallback">
			<span class:visually-hidden={!labelInside || hideLabel}>{label}</span>
			<select
				name={scripted ? undefined : name}
				{required}
				{disabled}
				{form}
				aria-invalid={invalid ? 'true' : undefined}
				aria-describedby={describedBy}
			>
				{#each groups as { group, entries } (group)}
					{#if group}
						<optgroup label={group}>
							{#each entries as { choice } (choice.value)}
								<option value={choice.value} selected={choice.value === value}>{choice.label}</option>
							{/each}
						</optgroup>
					{:else}
						{#each entries as { choice } (choice.value)}
							<option value={choice.value} selected={choice.value === value}>{choice.label}</option>
						{/each}
					{/if}
				{/each}
			</select>
		</label>
	{/if}
	<div class="dropdown-control" class:needs-scripts={Boolean(name)}>
		<div
			bind:this={combobox}
			class="dropdown-button"
			id={boxId}
			role="combobox"
			tabindex={disabled ? -1 : 0}
			aria-controls="{identifier}-list"
			aria-expanded={expanded}
			aria-haspopup="listbox"
			aria-labelledby="{identifier}-label {identifier}-value"
			aria-describedby={describers}
			aria-activedescendant={expanded ? optionId(active) : undefined}
			aria-disabled={disabled ? 'true' : undefined}
			aria-invalid={invalid || missing ? 'true' : undefined}
			aria-required={required ? 'true' : undefined}
			onclick={() => (expanded ? hide() : show())}
			onkeydown={onKeydown}
			onblur={hide}
		>
			{#if labelInside}
				<span class="dropdown-label" id="{identifier}-label">{label}</span>
			{/if}
			{#if Icon}<span class="dropdown-icon"><Icon size={16} aria-hidden="true" /></span>{/if}
			<span class="dropdown-value" id="{identifier}-value" style={selected ? choiceStyle?.(selected.value) : undefined}>{selected?.label ?? ''}</span>
			<ChevronDown size={20} strokeWidth={1.75} />
		</div>
		<!-- Pressing a choice must not take focus from the combobox, or the list would close before the click lands. -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<ul
			bind:this={list}
			class="dropdown-list"
			id="{identifier}-list"
			role="listbox"
			aria-labelledby="{identifier}-label"
			tabindex="-1"
			hidden={!expanded}
			onmousedown={(event) => event.preventDefault()}
		>
			{#each groups as { group, entries }, groupIndex (group)}
				{#if group}
					<li role="group" class="dropdown-group" aria-labelledby="{identifier}-group-{groupIndex}">
						<span class="dropdown-group-name" id="{identifier}-group-{groupIndex}" aria-hidden="true">{group}</span>
						<ul role="none">
							{#each entries as { choice, index } (choice.value)}
								{@render option(choice, index)}
							{/each}
						</ul>
					</li>
				{:else}
					{#each entries as { choice, index } (choice.value)}
						{@render option(choice, index)}
					{/each}
				{/if}
			{/each}
		</ul>
	</div>
	{#if selected?.hint}
		<p class="hint dropdown-hint" id="{identifier}-hint">{selected.hint}</p>
	{/if}
</div>

{#snippet option(choice: DropdownChoice<Value>, index: number)}
	<!-- Keys move through the choices from the combobox, which keeps focus (aria-activedescendant); the click is for the pointer. -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<li
		id={optionId(index)}
		class="dropdown-option"
		class:active={index === active}
		role="option"
		aria-selected={index === selectedIndex}
		style={choiceStyle?.(choice.value)}
		onclick={() => pick(index)}
		onmousemove={() => (active = index)}
	>
		<span class="dropdown-check"><Check size={20} strokeWidth={1.75} /></span>
		<span>{choice.label}</span>
	</li>
{/snippet}

<style>
	.dropdown {
		margin: var(--space-4) 0 0;
	}

	.dropdown-label {
		font-weight: var(--font-weight-bold);
		margin-bottom: var(--space-1);
		cursor: default;
	}

	.dropdown-control {
		position: relative;
		width: min(100%, var(--layout-field));
	}

	.dropdown-button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		min-height: var(--layout-target-minimum);
		box-sizing: border-box;
		padding: var(--space-1) var(--space-3);
		border: 2px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink);
		cursor: pointer;
	}

	.dropdown-button :global(svg) {
		flex: none;
	}

	.dropdown-button[aria-expanded='true'] :global(svg) {
		transform: rotate(180deg);
	}

	/* One line, as the browser's own <select> keeps it: a long choice ends in an ellipsis rather than making the box taller than the fields beside it. */
	.dropdown-value {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Nearer the choice it marks than the gap to the arrow. */
	.dropdown-icon {
		display: inline-flex;
		margin-right: calc(var(--space-2) - var(--space-3));
		color: var(--color-ink-muted);
	}

	/* The label inside the box: muted, before the picked choice, which is
	   set in semibold so it reads as the answer. */
	.label-inside {
		margin: 0;
	}

	.label-inside .dropdown-control {
		width: 100%;
	}

	.label-inside .dropdown-label {
		flex: none;
		margin: 0;
		font-weight: normal;
		color: var(--color-ink-muted);
		cursor: inherit;
	}

	.label-inside .dropdown-value {
		flex: 1;
		font-weight: var(--font-weight-semibold);
	}

	/* The browser's own <select>, for readers without scripts. */
	.dropdown-fallback {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.dropdown-fallback select {
		width: min(100%, var(--layout-field));
	}

	.label-inside .dropdown-fallback select {
		flex: 1;
		width: auto;
	}

	:global(:root[data-scripts='on']) .dropdown-fallback {
		display: none;
	}

	/* Above a chart's bars and a table's sticky headers, as the browser's own list would be. */
	.dropdown-list {
		position: absolute;
		z-index: 20;
		top: calc(100% + var(--space-1));
		left: 0;
		right: 0;
		max-height: 20rem;
		overflow-y: auto;
		margin: 0;
		padding: var(--space-1) 0;
		list-style: none;
		border: 2px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-surface-raised);
		color: var(--color-ink);
	}

	.dropdown-list[hidden] {
		display: none;
	}

	.dropdown-option {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		margin: 0;
		padding: var(--space-1) var(--space-3) var(--space-1) var(--space-2);
		cursor: pointer;
	}

	/* The picked choice has a check mark and bold type, not color alone. */
	.dropdown-check {
		display: inline-flex;
		visibility: hidden;
	}

	.dropdown-option[aria-selected='true'] {
		font-weight: var(--font-weight-bold);
	}

	.dropdown-option[aria-selected='true'] .dropdown-check {
		visibility: visible;
	}

	/* The choice the arrow keys are on looks like a focused control. */
	.dropdown-option.active {
		background: var(--color-focus);
		color: var(--focus-text);
		outline: 3px solid var(--color-focus-ring);
		outline-offset: -3px;
	}

	.dropdown-hint {
		margin: var(--space-1) 0 0;
	}

	/* An error, as on the browser's own <select> (global.css). */
	.dropdown-button[aria-invalid='true'] {
		border-color: var(--color-danger);
	}

	/* Not usable now: muted, with a dashed border, so the state does not rest on color alone. */
	.disabled .dropdown-button {
		border-style: dashed;
		color: var(--color-ink-muted);
		cursor: not-allowed;
	}

	.disabled .dropdown-label {
		color: var(--color-ink-muted);
	}

	.dropdown-group ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.dropdown-group-name {
		display: block;
		padding: var(--space-2) var(--space-3) var(--space-1);
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-bold);
	}
</style>
