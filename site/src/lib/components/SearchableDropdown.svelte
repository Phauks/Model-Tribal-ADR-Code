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
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';

	let {
		label,
		choices,
		value,
		onchange,
		placeholder = 'Type to search'
	}: {
		label: string;
		choices: SearchableChoice<Value>[];
		value: Value;
		onchange: (value: Value) => void;
		placeholder?: string;
	} = $props();

	const identifier = $props.id();
	let expanded = $state(false);
	let query = $state('');
	let typing = $state(false);
	let active = $state(0);
	let input: HTMLInputElement | undefined = $state();
	let list: HTMLUListElement | undefined = $state();

	const selected = $derived(choices.find((choice) => choice.value === value) ?? choices[0]);

	/** Every word typed must start a word of the choice's label, group, description or keywords, so "law 280" finds "Public Law 280" and "bia" finds the Bureau of Indian Affairs by its keyword. */
	function matches(choice: SearchableChoice<Value>, words: string[]): boolean {
		const text = [choice.label, choice.group, choice.description, ...(choice.keywords ?? [])].filter(Boolean).join(' ').toLowerCase();
		const textWords = text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
		return words.every((word) => textWords.some((textWord) => textWord.startsWith(word)) || text.includes(word));
	}

	const shown = $derived.by(() => {
		const words = typing ? query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean) : [];
		return words.length === 0 ? choices : choices.filter((choice) => matches(choice, words));
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

	const status = $derived(
		!expanded ? '' : shown.length === 0 ? 'Nothing matches.' : shown.length === 1 ? '1 choice. Press Enter to show it.' : `${shown.length} choices.`
	);

	function optionId(index: number): string {
		return `${identifier}-option-${index}`;
	}

	function show(): void {
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
		if (choice && choice.value !== value) onchange(choice.value);
	}

	function move(index: number): void {
		if (shown.length === 0) return;
		active = (index + shown.length) % shown.length;
		scrollActiveIntoView();
	}

	function scrollActiveIntoView(): void {
		list?.querySelector(`#${CSS.escape(optionId(active))}`)?.scrollIntoView({ block: 'nearest' });
	}

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
	<label class="searchable-dropdown-label" for="{identifier}-input">{label}</label>
	<div class="searchable-dropdown-control" class:expanded>
		<input
			bind:this={input}
			id="{identifier}-input"
			type="text"
			role="combobox"
			autocomplete="off"
			spellcheck="false"
			aria-autocomplete="list"
			aria-expanded={expanded}
			aria-controls="{identifier}-list"
			aria-activedescendant={expanded && shown.length > 0 ? optionId(active) : undefined}
			value={typing ? query : (selected?.label ?? '')}
			placeholder={expanded ? placeholder : undefined}
			oninput={onInput}
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
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<li
		id={optionId(index)}
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
	.searchable-dropdown-label {
		display: block;
		font-weight: var(--font-weight-bold);
		margin-bottom: var(--space-1);
	}

	.searchable-dropdown-control {
		position: relative;
		width: min(100%, 28rem);
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

	.searchable-dropdown-list {
		position: absolute;
		z-index: 2;
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
