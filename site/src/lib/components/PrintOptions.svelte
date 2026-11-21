<script lang="ts">
	// Print button and dialog (site/DESIGN.md, section 6, "Print"). Like the
	// delivery dialogs of legal research services, it lets a reader choose
	// what prints (the parts this page has) and how it is laid out, then opens
	// the browser's print window, where the reader can also save a PDF. The
	// dialog is the shared two-panel Modal. Choices are kept on this device
	// (src/lib/print-options.ts) and also apply when the reader prints with
	// the browser's own Print command. Without scripts the button is hidden
	// and pages print with every part.
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import LayoutTemplate from '@lucide/svelte/icons/layout-template';
	import Printer from '@lucide/svelte/icons/printer';
	import { onMount } from 'svelte';
	import Modal from './Modal.svelte';
	import { noteBlock, noteCopy } from '#lib/note-copies.ts';
	import {
		defaultPrintOptions,
		linkAddressOptions,
		loadPrintOptions,
		noteOptions,
		partDescriptions,
		savePrintOptions,
		termMarkOptions,
		type Choice,
		type PartDescription,
		type PrintOptions,
		type PrintPart
	} from '#lib/print-options.ts';

	type SectionIdentifier = 'include' | 'layout';

	const sections = [
		{ id: 'include', label: 'What to print', icon: ListChecks },
		{ id: 'layout', label: 'Layout', icon: LayoutTemplate }
	] satisfies { id: SectionIdentifier; label: string; icon: unknown }[];

	let modal: Modal<SectionIdentifier> | undefined = $state();
	let opener: HTMLButtonElement | undefined = $state();
	let selected = $state<SectionIdentifier>('include');
	let options = $state<PrintOptions>({ ...defaultPrintOptions });
	// What the current page has, found when the dialog opens.
	let parts = $state<PartDescription[]>([]);
	let hasNotes = $state(false);
	let hasWebLinks = $state(false);
	let hasTerms = $state(false);

	function pageHas(selector: string): boolean {
		return document.querySelector(`#main-content ${selector}`) !== null;
	}

	function open() {
		options = loadPrintOptions();
		parts = partDescriptions.filter(
			(description) =>
				description.part === 'pageDetails' || pageHas(`[data-print-part='${description.part}']`)
		);
		hasNotes = pageHas('a.note-marker');
		hasWebLinks = pageHas("a[href^='http']");
		hasTerms = pageHas('a.term-link');
		modal?.open();
	}

	function close() {
		modal?.close();
	}

	function returnFocus() {
		opener?.focus();
	}

	function change<Name extends keyof PrintOptions>(name: Name, value: PrintOptions[Name]) {
		options[name] = value;
		savePrintOptions($state.snapshot(options));
	}

	function togglePart(part: PrintPart, checked: boolean) {
		change(part, checked ? 'on' : 'off');
	}

	function reset() {
		options = { ...defaultPrintOptions };
		savePrintOptions({ ...defaultPrintOptions });
	}

	function print() {
		close();
		// Let the dialog close before the print window takes over the page.
		requestAnimationFrame(() => window.print());
	}

	// "Each note under its paragraph": copies of the notes go in just before
	// printing and come out after, whichever way printing started.
	onMount(() => {
		const addNotes = () => {
			if (document.documentElement.dataset.printNotes !== 'inline') return;
			for (const marker of document.querySelectorAll<HTMLAnchorElement>('#main-content a.note-marker')) {
				// A note the reader already opened under its paragraph prints as it is.
				if (marker.getAttribute('aria-controls')) continue;
				const block = noteBlock(marker);
				const copy = noteCopy(marker, 'inline-note print-note');
				if (!block || !copy) continue;
				// Several notes in one paragraph print in order, after the paragraph.
				let last: Element = block;
				while (last.nextElementSibling?.classList.contains('print-note')) last = last.nextElementSibling;
				last.after(copy);
			}
		};
		const removeNotes = () => {
			for (const copy of document.querySelectorAll('.print-note')) copy.remove();
		};
		window.addEventListener('beforeprint', addNotes);
		window.addEventListener('afterprint', removeNotes);
		return () => {
			window.removeEventListener('beforeprint', addNotes);
			window.removeEventListener('afterprint', removeNotes);
		};
	});
</script>

{#snippet choiceGroup<Value extends string>(
	legend: string,
	name: keyof PrintOptions,
	choices: Choice<Value>[],
	current: Value,
	pick: (value: Value) => void
)}
	<fieldset class="setting">
		<legend>{legend}</legend>
		{#each choices as choice (choice.value)}
			<div class="choice">
				<input
					type="radio"
					id="print-{name}-{choice.value}"
					name="print-{name}"
					value={choice.value}
					checked={current === choice.value}
					aria-describedby={choice.hint ? `print-${name}-${choice.value}-hint` : undefined}
					onchange={() => pick(choice.value)}
				/>
				<div>
					<label for="print-{name}-{choice.value}">{choice.label}</label>
					{#if choice.hint}
						<p class="hint" id="print-{name}-{choice.value}-hint">{choice.hint}</p>
					{/if}
				</div>
			</div>
		{/each}
	</fieldset>
{/snippet}

<button
	bind:this={opener}
	class="print-button needs-scripts"
	type="button"
	aria-haspopup="dialog"
	onclick={open}
>
	<Printer size={20} strokeWidth={1.75} />
	<span>Print</span>
</button>

<Modal bind:this={modal} bind:selected title="Print this page" {sections} onclose={returnFocus}>
	{#snippet section(id: SectionIdentifier)}
		<h3 class="section-heading">{sections.find((item) => item.id === id)?.label}</h3>
		{#if id === 'include'}
			<fieldset class="setting">
				<legend>Parts of this page</legend>
				<p class="hint">Only the parts this page has are listed. The main text always prints.</p>
				{#each parts as description (description.part)}
					<div class="choice">
						<input
							type="checkbox"
							id="print-part-{description.part}"
							checked={options[description.part] === 'on'}
							aria-describedby={description.hint ? `print-part-${description.part}-hint` : undefined}
							onchange={(event) => togglePart(description.part, event.currentTarget.checked)}
						/>
						<div>
							<label for="print-part-{description.part}">{description.label}</label>
							{#if description.hint}
								<p class="hint" id="print-part-{description.part}-hint">{description.hint}</p>
							{/if}
						</div>
					</div>
				{/each}
			</fieldset>
			<p class="hint">
				Menus, buttons, links for making requests and the page footer never print.
			</p>
		{:else if id === 'layout'}
			{#if hasNotes}
				{@render choiceGroup('Citations', 'notes', noteOptions, options.notes, (value) =>
					change('notes', value)
				)}
			{/if}
			{#if hasWebLinks}
				{@render choiceGroup(
					'Links to other websites',
					'linkAddresses',
					linkAddressOptions,
					options.linkAddresses,
					(value) => change('linkAddresses', value)
				)}
			{/if}
			{#if hasTerms}
				{@render choiceGroup('Defined terms', 'termMarks', termMarkOptions, options.termMarks, (value) =>
					change('termMarks', value)
				)}
			{/if}
			{#if !hasNotes && !hasWebLinks && !hasTerms}
				<p class="hint">This page has no notes, outside links or defined terms to lay out.</p>
			{/if}
			<p class="hint">
				Text size, font and spacing follow your reading settings. Paper size, margins and scale are
				set in your browser’s print window.
			</p>
		{/if}
		<p class="hint saved-note">
			Your choices are kept on this device for the next time you print, including when you use your
			browser’s own Print command. To save a PDF, choose “Save as PDF” in the print window.
		</p>
	{/snippet}
	{#snippet actions()}
		<button class="button" type="button" onclick={print}>
			<Printer size={20} strokeWidth={1.75} />
			<span>Print</span>
		</button>
		<button class="button button-quiet" type="button" onclick={reset}>Reset print choices to defaults</button>
	{/snippet}
</Modal>

<style>
	.print-button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-band-text);
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--color-band-text);
		font: inherit;
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
	}

	.section-heading {
		margin: 0 0 var(--space-2);
	}

	.setting {
		margin: var(--space-4) 0 0;
		padding: 0;
		border: 0;
	}

	.setting legend {
		font-weight: var(--font-weight-bold);
		margin-bottom: var(--space-1);
	}

	.choice {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		margin: var(--space-2) 0;
	}

	.choice input {
		margin-top: 0.3em;
		width: 1.25rem;
		height: 1.25rem;
		flex: none;
		accent-color: var(--color-action);
	}

	.choice label {
		display: block;
		padding: var(--space-1) 0;
		cursor: pointer;
	}

	.choice .hint {
		margin: 0;
	}

	.saved-note {
		margin-top: var(--space-5);
	}
</style>
