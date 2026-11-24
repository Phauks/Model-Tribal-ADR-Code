<script lang="ts" module>
	/** One choice in a searchable dropdown. Choices with the same group are listed together under the group's name, in the order given. */
	export interface SearchableChoice<Value extends string> {
		value: Value;
		label: string;
		/** A short line under the label, which the search also reads. */
		description?: string;
		group?: string;
		/** Other words a reader might type for this choice, such as "PL 280" for "Public Law 280". */
		keywords?: string[];
	}
</script>

<script lang="ts" generics="Value extends string">
	// A dropdown a reader can type into to narrow a long list (site/DESIGN.md, section 6, "Searchable dropdown"). Trevor asked for it on 2026-11-23 for the map's views, which will grow (Public Law 280 and more), in place of a row of tabs. It follows the WAI-ARIA editable combobox pattern with list autocomplete (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-autocomplete-list/).
	//
	// Keys: typing filters the list by label, group, description and keywords; Down and Up open the list and move through it; Enter picks; Escape closes the list, and a second Escape clears what was typed; Tab leaves without changing the choice. A screen reader hears how many choices match.
	//
	// Given a name, it is a form field, as the plain Dropdown is: a hidden input sends the picked value, a pick sends a change event from it, and without scripts the browser's own <select> stands in for it, so the form still works. Like the Dropdown, it can be required, disabled, invalid with the error it is described by, or a field of another form.
	//
	// Typed text lists the choices whose label starts with it first, then those with a label word that starts with it, then the rest that match, so "hop" puts Hopi before Bishop Paiute.
	//
	// The text typed into the box sends no change event of its own (only a pick does), so a form that sends itself on change does not go off when the reader leaves the box after typing.
	import { onMount, tick, type Snippet } from 'svelte';
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';

	let {
		label,
		choices,
		value = $bindable(),
		onchange,
		onhighlight,
		placeholder = 'Type to search',
		hideLabel = false,
		name,
		id,
		required = false,
		disabled = false,
		invalid = false,
		describedBy,
		form,
		message
	}: {
		label: string;
		choices: SearchableChoice<Value>[];
		value: Value;
		onchange?: (value: Value) => void;
		/** Called with the choice the reader is on in the open list, before picking it, so a page can start fetching what that choice shows. */
		onhighlight?: (value: Value) => void;
		placeholder?: string;
		/** Keeps the label for screen readers only, as in a table row whose column header already names the box. */
		hideLabel?: boolean;
		/** Sends the picked value with the form around the dropdown under this name. */
		name?: string;
		/** The box's id, so an error summary or a link can move to it. */
		id?: string;
		/** An empty choice ('') stops the form from being sent, as a required <select> does. */
		required?: boolean;
		/** Not sent with the form and not usable, as a disabled <select>. */
		disabled?: boolean;
		/** Marks the box as having an error (aria-invalid and the danger border). */
		invalid?: boolean;
		/** The ids of the elements that describe the box, such as its hint and error. */
		describedBy?: string;
		/** The id of the form the field belongs to, when it sits outside it. */
		form?: string;
		/** The field's hint or error, drawn between the label and the box, where other fields show theirs. */
		message?: Snippet;
	} = $props();

	// The <select> sends the value until scripts run; then the hidden input does.
	let scripted = $state(false);
	let field: HTMLInputElement | undefined = $state();
	let missing = $state(false);

	const identifier = $props.id();
	const inputIdentifier = $derived(id ?? `${identifier}-input`);

	onMount(() => {
		scripted = true;
		if (!required || !name) return;
		// A required box with nothing picked stops its form, as a required <select> would; the browser's own check cannot see a hidden input. A form that checks its own answers (novalidate) is left to do so.
		const owner = form ? document.getElementById(form) : input?.closest('form');
		if (!(owner instanceof HTMLFormElement)) return;
		const check = (event: SubmitEvent) => {
			if (disabled || owner.noValidate || event.submitter?.hasAttribute('formnovalidate') || value !== '') return;
			event.preventDefault();
			event.stopImmediatePropagation();
			missing = true;
			input?.focus();
		};
		owner.addEventListener('submit', check, { capture: true });
		return () => owner.removeEventListener('submit', check, { capture: true });
	});
	let expanded = $state(false);
	let query = $state('');
	let typing = $state(false);
	let active = $state(0);
	let input: HTMLInputElement | undefined = $state();
	let list: HTMLUListElement | undefined = $state();

	// An empty value shows the placeholder, for a box where nothing is picked yet.
	const selected = $derived(choices.find((choice) => choice.value === value) ?? (value === '' ? undefined : choices[0]));

	/** Every word typed must start a word of the choice's label, group, description or keywords, so "law 280" finds "Public Law 280" and "bia" finds the Bureau of Indian Affairs by its keyword. */
	function matches(choice: SearchableChoice<Value>, words: string[]): boolean {
		const text = [choice.label, choice.group, choice.description, ...(choice.keywords ?? [])].filter(Boolean).join(' ').toLowerCase();
		const textWords = text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
		return words.every((word) => textWords.some((textWord) => textWord.startsWith(word)) || text.includes(word));
	}

	/** How well a matching choice fits what was typed: 0 when its label starts with it, 1 when every word typed starts a word of the label, 2 otherwise. */
	function rank(choice: SearchableChoice<Value>, typed: string, words: string[]): number {
		const label = choice.label.toLowerCase();
		if (label.startsWith(typed)) return 0;
		const labelWords = label.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
		return words.every((word) => labelWords.some((labelWord) => labelWord.startsWith(word))) ? 1 : 2;
	}

	const shown = $derived.by(() => {
		const typed = typing ? query.trim().toLowerCase() : '';
		const words = typed.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
		if (words.length === 0) return choices;
		// The sort is stable, so choices that fit as well keep the order they were given in.
		return choices
			.filter((choice) => matches(choice, words))
			.map((choice) => ({ choice, fit: rank(choice, typed, words) }))
			.sort((first, second) => first.fit - second.fit)
			.map(({ choice }) => choice);
	});

	/** The shown choices in their groups, keeping the order the groups first appear in. */
	const groups = $derived.by(() => {
		const found = new Map<string, { choice: SearchableChoice<Value>; index: number }[]>();
		shown.forEach((choice, index) => {
			const name = choice.group ?? '';
			if (!found.has(name)) found.set(name, []);
			found.get(name)?.push({ choice, index });
		});
		return [...found.entries()].map(([name, entries]) => ({ name, entries }));
	});

	$effect(() => {
		const highlighted = expanded ? shown[active]?.value : undefined;
		if (highlighted !== undefined && highlighted !== value) onhighlight?.(highlighted);
	});

	const status = $derived(
		!expanded ? '' : shown.length === 0 ? 'Nothing matches.' : shown.length === 1 ? '1 choice. Press Enter to show it.' : `${shown.length} choices.`
	);

	function optionIdentifier(index: number): string {
		return `${identifier}-option-${index}`;
	}

	function show(): void {
		if (disabled) return;
		expanded = true;
		const current = shown.findIndex((choice) => choice.value === value);
		active = current >= 0 ? current : 0;
		queueMicrotask(scrollActiveIntoView);
	}

	function hide(): void {
		expanded = false;
		typing = false;
		query = '';
	}

	function pick(index: number): void {
		const choice = shown[index];
		hide();
		if (choice && choice.value !== value) {
			value = choice.value;
			missing = false;
			onchange?.(choice.value);
			void tick().then(() => field?.dispatchEvent(new Event('change', { bubbles: true })));
		}
	}

	function move(index: number): void {
		if (shown.length === 0) return;
		active = (index + shown.length) % shown.length;
		scrollActiveIntoView();
	}

	function scrollActiveIntoView(): void {
		list?.querySelector(`#${CSS.escape(optionIdentifier(active))}`)?.scrollIntoView({ block: 'nearest' });
	}

	/** Every choice in its group, for the <select> that stands in without scripts. */
	const allGroups = $derived.by(() => {
		const found = new Map<string, SearchableChoice<Value>[]>();
		for (const choice of choices) {
			const group = choice.group ?? '';
			if (!found.has(group)) found.set(group, []);
			found.get(group)?.push(choice);
		}
		return [...found.entries()].map(([group, entries]) => ({ group, entries }));
	});

	function onInput(event: Event): void {
		query = (event.currentTarget as HTMLInputElement).value;
		typing = true;
		expanded = true;
		active = 0;
	}

	function onKeydown(event: KeyboardEvent): void {
		const { key, altKey } = event;
		if (key === 'ArrowDown' || key === 'ArrowUp') {
			event.preventDefault();
			if (!expanded) show();
			else if (altKey && key === 'ArrowUp') pick(active);
			else move(active + (key === 'ArrowDown' ? 1 : -1));
		} else if (key === 'Enter') {
			if (expanded) {
				event.preventDefault();
				pick(active);
			}
		} else if (key === 'Escape') {
			if (expanded || typing) {
				event.preventDefault();
				event.stopPropagation();
				hide();
			}
		} else if ((key === 'Home' || key === 'End') && expanded && !typing) {
			event.preventDefault();
			move(key === 'Home' ? 0 : shown.length - 1);
		}
	}
</script>

<div class="searchable-dropdown">
	{#if name}
		<input bind:this={field} type="hidden" name={scripted ? name : undefined} value={selected?.value ?? value} {disabled} {form} />
		<label class="searchable-dropdown-fallback">
			<span class:visually-hidden={hideLabel}>{label}</span>
			<select
				name={scripted ? undefined : name}
				{required}
				{disabled}
				{form}
				aria-invalid={invalid ? 'true' : undefined}
				aria-describedby={describedBy}
			>
				{#if value === '' && !choices.some((choice) => choice.value === '')}
					<!-- Nothing picked yet: the placeholder, which cannot be picked back. -->
					<option value="" disabled selected>{placeholder}</option>
				{/if}
				{#each allGroups as { group, entries } (group)}
					{#if group}
						<optgroup label={group}>
							{#each entries as choice (choice.value)}
								<option value={choice.value} selected={choice.value === value}>{choice.label}</option>
							{/each}
						</optgroup>
					{:else}
						{#each entries as choice (choice.value)}
							<option value={choice.value} selected={choice.value === value}>{choice.label}</option>
						{/each}
					{/if}
				{/each}
			</select>
		</label>
	{/if}
	<label class="searchable-dropdown-label" class:visually-hidden={hideLabel} class:needs-scripts={Boolean(name)} for={inputIdentifier}>{label}</label>
	{@render message?.()}
	<div class="searchable-dropdown-control" class:expanded class:needs-scripts={Boolean(name)}>
		<input
			bind:this={input}
			id={inputIdentifier}
			type="text"
			role="combobox"
			autocomplete="off"
			spellcheck="false"
			aria-autocomplete="list"
			aria-expanded={expanded}
			aria-controls="{identifier}-list"
			aria-activedescendant={expanded && shown.length > 0 ? optionIdentifier(active) : undefined}
			aria-describedby={describedBy}
			aria-invalid={invalid || missing ? 'true' : undefined}
			aria-required={required ? 'true' : undefined}
			{disabled}
			value={typing ? query : (selected?.label ?? '')}
			placeholder={expanded || !selected ? placeholder : undefined}
			oninput={onInput}
			onchange={(event) => event.stopPropagation()}
			onkeydown={onKeydown}
			onclick={() => {
				if (!expanded) {
					show();
					input?.select();
				}
			}}
			onfocus={() => input?.select()}
			onblur={hide}
		/>
		<button
			type="button"
			class="searchable-dropdown-toggle"
			tabindex="-1"
			aria-label="Show all choices"
			aria-controls="{identifier}-list"
			aria-expanded={expanded}
			{disabled}
			onmousedown={(event) => event.preventDefault()}
			onclick={() => {
				if (expanded) hide();
				else show();
				input?.focus();
			}}
		>
			<ChevronDown size={20} strokeWidth={1.75} />
		</button>
		<!-- Pressing a choice must not take focus from the box, or the list would close before the click lands. -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<ul
			bind:this={list}
			class="searchable-dropdown-list"
			id="{identifier}-list"
			role="listbox"
			aria-label={label}
			hidden={!expanded}
			onmousedown={(event) => event.preventDefault()}
		>
			{#each groups as group (group.name)}
				{#if group.name}
					<li role="group" class="searchable-dropdown-group" aria-labelledby="{identifier}-group-{group.entries[0].index}">
						<span class="searchable-dropdown-group-name" id="{identifier}-group-{group.entries[0].index}" aria-hidden="true">{group.name}</span>
						<ul role="none">
							{#each group.entries as { choice, index } (choice.value)}
								{@render option(choice, index)}
							{/each}
						</ul>
					</li>
				{:else}
					{#each group.entries as { choice, index } (choice.value)}
						{@render option(choice, index)}
					{/each}
				{/if}
			{:else}
				<li class="searchable-dropdown-empty" role="none">Nothing matches “{query}”.</li>
			{/each}
		</ul>
	</div>
	<p class="visually-hidden" role="status" aria-live="polite">{status}</p>
</div>

{#snippet option(choice: SearchableChoice<Value>, index: number)}
	<!-- Keys move through the choices from the box, which keeps focus (aria-activedescendant); the click is for the pointer. -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<li
		id={optionIdentifier(index)}
		class="searchable-dropdown-option"
		class:active={index === active}
		role="option"
		aria-selected={choice.value === value}
		onclick={() => pick(index)}
		onmousemove={() => (active = index)}
	>
		<span class="searchable-dropdown-check"><Check size={20} strokeWidth={1.75} /></span>
		<span class="searchable-dropdown-text">
			<span class="searchable-dropdown-name">{choice.label}</span>
			{#if choice.description}<span class="searchable-dropdown-description">{choice.description}</span>{/if}
		</span>
	</li>
{/snippet}

<style>
	/* The browser's own <select>, for readers without scripts. */
	.searchable-dropdown-fallback {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-weight: var(--font-weight-bold);
	}

	.searchable-dropdown-fallback select {
		width: min(100%, var(--layout-field));
		font-weight: normal;
	}

	:global(:root[data-scripts='on']) .searchable-dropdown-fallback {
		display: none;
	}

	.searchable-dropdown-label {
		display: block;
		font-weight: var(--font-weight-bold);
		margin-bottom: var(--space-1);
	}

	.searchable-dropdown-control {
		position: relative;
		width: min(100%, var(--layout-field));
	}

	.searchable-dropdown-control input {
		width: 100%;
		min-height: var(--layout-target-minimum);
		box-sizing: border-box;
		padding: var(--space-1) calc(var(--layout-target-minimum) + var(--space-1)) var(--space-1) var(--space-3);
		border: 2px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink);
		font: inherit;
		text-overflow: ellipsis;
	}

	/* An error, as on the browser's own <select> (global.css). */
	.searchable-dropdown-control input[aria-invalid='true'] {
		border-color: var(--color-danger);
	}

	/* Not usable now: muted, with a dashed border, so the state does not rest on color alone. */
	.searchable-dropdown-control input:disabled {
		border-style: dashed;
		color: var(--color-ink-muted);
		cursor: not-allowed;
	}

	.searchable-dropdown-toggle:disabled {
		color: var(--color-ink-muted);
		cursor: not-allowed;
	}

	.searchable-dropdown-toggle {
		position: absolute;
		top: 0;
		right: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--layout-target-minimum);
		height: 100%;
		border: 0;
		background: transparent;
		color: var(--color-ink);
		cursor: pointer;
	}

	.expanded .searchable-dropdown-toggle :global(svg) {
		transform: rotate(180deg);
	}

	/* Above a chart's bars and a table's sticky headers, as the browser's own list would be. */
	.searchable-dropdown-list {
		position: absolute;
		z-index: 20;
		top: calc(100% + var(--space-1));
		left: 0;
		right: 0;
		max-height: 22rem;
		overflow-y: auto;
		margin: 0;
		padding: var(--space-1) 0;
		list-style: none;
		border: 2px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-surface-raised);
		color: var(--color-ink);
	}

	.searchable-dropdown-list[hidden] {
		display: none;
	}

	.searchable-dropdown-group ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.searchable-dropdown-group-name {
		display: block;
		padding: var(--space-2) var(--space-3) var(--space-1);
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-bold);
	}

	.searchable-dropdown-option {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		margin: 0;
		padding: var(--space-1) var(--space-3) var(--space-1) var(--space-2);
		cursor: pointer;
	}

	.searchable-dropdown-text {
		display: flex;
		flex-direction: column;
	}

	.searchable-dropdown-description {
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	/* The picked choice has a check mark and bold type, not color alone. */
	.searchable-dropdown-check {
		display: inline-flex;
		visibility: hidden;
	}

	.searchable-dropdown-option[aria-selected='true'] .searchable-dropdown-name {
		font-weight: var(--font-weight-bold);
	}

	.searchable-dropdown-option[aria-selected='true'] .searchable-dropdown-check {
		visibility: visible;
	}

	/* The choice the arrow keys are on looks like a focused control, as in the plain dropdown. */
	.searchable-dropdown-option.active {
		background: var(--color-focus);
		color: var(--focus-text);
		outline: 3px solid var(--color-focus-ring);
		outline-offset: -3px;
	}

	.searchable-dropdown-option.active .searchable-dropdown-description {
		color: inherit;
	}

	.searchable-dropdown-empty {
		padding: var(--space-2) var(--space-3);
		color: var(--color-ink-muted);
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	@media print {
		.searchable-dropdown {
			display: none;
		}
	}
</style>
