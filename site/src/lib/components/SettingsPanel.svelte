<script lang="ts">
	// Settings button and dialog (site/DESIGN.md, section 6, "Settings"). The
	// dialog is the shared two-panel Modal: sections on the left (Text,
	// Colors, Motion, Citations, Glossary, Data) and the chosen section on the right.
	// It has no buttons along the bottom; Close at the top closes it, and
	// Reset sits in Data. Reading settings apply at once and are kept on this
	// device only, through src/lib/reading-settings.ts, so they work offline.
	// Without scripts the button is hidden (the needs-scripts class in
	// global.css).
	import BookA from '@lucide/svelte/icons/book-a';
	import Database from '@lucide/svelte/icons/database';
	import Palette from '@lucide/svelte/icons/palette';
	import Quote from '@lucide/svelte/icons/quote';
	import Settings from '@lucide/svelte/icons/settings';
	import TextAlignJustify from '@lucide/svelte/icons/text-align-justify';
	import TextAlignStart from '@lucide/svelte/icons/text-align-start';
	import Type from '@lucide/svelte/icons/type';
	import Wind from '@lucide/svelte/icons/wind';
	import Dropdown from './Dropdown.svelte';
	import LocalData from './LocalData.svelte';
	import Modal from './Modal.svelte';
	import OfflineSaving from './OfflineSaving.svelte';
	import {
		contrastChoices,
		defaultSettings,
		downloadFont,
		fontChoices,
		fontFamilyTokens,
		glossaryCardOptions,
		loadSettings,
		loadTheme,
		noteDisplayChoices,
		saveSettings,
		saveTheme,
		sourceLinkOptions,
		textAlignmentChoices,
		lineWidthChoices,
		motionChoices,
		textSizeChoices,
		textSizes,
		textSpacingChoices,
		themeChoices,
		type Choice,
		type Font,
		type ReadingSettings,
		type TextAlignment,
		type Theme
	} from '#lib/reading-settings.ts';

	type SectionIdentifier = 'text' | 'colors' | 'motion' | 'citations' | 'glossary' | 'data';

	const sections = [
		{ id: 'text', label: 'Text', icon: Type },
		{ id: 'colors', label: 'Colors', icon: Palette },
		{ id: 'motion', label: 'Motion', icon: Wind },
		{ id: 'citations', label: 'Citations', icon: Quote },
		{ id: 'glossary', label: 'Glossary', icon: BookA },
		{ id: 'data', label: 'Data', icon: Database }
	] satisfies { id: SectionIdentifier; label: string; icon: unknown }[];

	let modal: Modal<SectionIdentifier> | undefined = $state();
	let opener: HTMLButtonElement | undefined = $state();
	let selected = $state<SectionIdentifier>('text');
	let settings = $state<ReadingSettings>({ ...defaultSettings });
	let theme = $state<Theme>('device');
	/** Changes after a delete in Data, so the saved pages list reads the device again. */
	let dataRead = $state(0);

	function open() {
		settings = loadSettings();
		theme = loadTheme();
		modal?.open();
	}

	function close() {
		modal?.close();
	}

	function returnFocus() {
		opener?.focus();
	}

	function change<Name extends keyof ReadingSettings>(name: Name, value: ReadingSettings[Name]) {
		settings[name] = value;
		saveSettings($state.snapshot(settings));
		if (name === 'font') downloadFont(value as ReadingSettings['font']);
	}

	/** Each font choice is shown in its own typeface. */
	function fontStyle(font: Font): string {
		return `font-family: var(${fontFamilyTokens[font]})`;
	}

	const alignmentIcons = { left: TextAlignStart, justified: TextAlignJustify } satisfies Record<
		TextAlignment,
		unknown
	>;

	const textSizeIndex = $derived(
		textSizes.includes(settings.textSize) ? textSizes.indexOf(settings.textSize) : textSizes.indexOf(defaultSettings.textSize)
	);
	const textSizeChoice = $derived(textSizeChoices[textSizeIndex]);

	function changeTheme(value: Theme) {
		theme = value;
		saveTheme(value);
	}

	function reset() {
		settings = { ...defaultSettings };
		saveSettings({ ...defaultSettings });
		changeTheme('device');
	}
</script>

{#snippet choiceGroup<Value extends string>(
	legend: string,
	name: string,
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
					id="setting-{name}-{choice.value}"
					{name}
					value={choice.value}
					checked={current === choice.value}
					aria-describedby={choice.hint ? `setting-${name}-${choice.value}-hint` : undefined}
					onchange={() => pick(choice.value)}
				/>
				<div>
					<label for="setting-{name}-{choice.value}">{choice.label}</label>
					{#if choice.hint}
						<p class="hint" id="setting-{name}-{choice.value}-hint">{choice.hint}</p>
					{/if}
				</div>
			</div>
		{/each}
	</fieldset>
{/snippet}

<!-- Text size is a slider, as Trevor asked on Nov. 22, 2026. It steps through the sizes in reading-settings.ts; arrow keys move one step, Home and End jump to the ends. The current size shows beside the label and is read out as words. -->
{#snippet textSizeSlider()}
	<div class="setting text-size">
		<div class="slider-label">
			<label for="setting-text-size">Text size</label>
			<output for="setting-text-size" aria-hidden="true">{textSizeChoice.label}</output>
		</div>
		<div class="slider-row">
			<span class="slider-end slider-end-small" aria-hidden="true">A</span>
			<input
				type="range"
				id="setting-text-size"
				min="0"
				max={textSizes.length - 1}
				step="1"
				value={textSizeIndex}
				aria-valuetext="{textSizeChoice.value} percent"
				oninput={(event) => change('textSize', textSizes[Number(event.currentTarget.value)])}
			/>
			<span class="slider-end slider-end-large" aria-hidden="true">A</span>
		</div>
	</div>
{/snippet}

<!-- Text alignment shows symbols, as Trevor asked on Nov. 22, 2026. Each symbol is a radio button whose name is read out; the picked choice's name and hint show in words below. -->
{#snippet alignmentGroup()}
	<fieldset class="setting">
		<legend>Text alignment</legend>
		<div class="symbol-choices">
			{#each textAlignmentChoices as choice (choice.value)}
				{@const Icon = alignmentIcons[choice.value]}
				<label class="symbol-choice">
					<input
						class="visually-hidden"
						type="radio"
						name="text-alignment"
						value={choice.value}
						checked={settings.textAlignment === choice.value}
						aria-describedby="setting-text-alignment-{choice.value}-hint"
						onchange={() => change('textAlignment', choice.value)}
					/>
					<Icon size={24} />
					<span class="visually-hidden">{choice.label}</span>
				</label>
			{/each}
		</div>
		{#each textAlignmentChoices as choice (choice.value)}
			<p
				class="hint symbol-hint"
				id="setting-text-alignment-{choice.value}-hint"
				hidden={settings.textAlignment !== choice.value}
			>
				<strong>{choice.label}.</strong>
				{choice.hint}
			</p>
		{/each}
	</fieldset>
{/snippet}

<button
	bind:this={opener}
	class="icon-button needs-scripts"
	type="button"
	aria-haspopup="dialog"
	aria-label="Settings"
	title="Settings"
	onclick={open}
>
	<Settings size={24} />
</button>

<Modal
	bind:this={modal}
	bind:selected
	title="Settings"
	sections={sections}
	onclose={returnFocus}
>
	{#snippet section(id: SectionIdentifier)}
		<h3 class="section-heading">{sections.find((item) => item.id === id)?.label}</h3>
		{#if id === 'text'}
			{@render textSizeSlider()}
			<Dropdown
				label="Font"
				choices={fontChoices}
				value={settings.font}
				onchange={(value) => change('font', value)}
				choiceStyle={fontStyle}
			/>
			{@render choiceGroup(
				'Text spacing',
				'text-spacing',
				textSpacingChoices,
				settings.textSpacing,
				(value) => change('textSpacing', value)
			)}
			{@render alignmentGroup()}
			{@render choiceGroup('Line width', 'line-width', lineWidthChoices, settings.lineWidth, (value) =>
				change('lineWidth', value)
			)}
		{:else if id === 'colors'}
			{@render choiceGroup('Theme', 'theme', themeChoices, theme, changeTheme)}
			{@render choiceGroup('Contrast', 'contrast', contrastChoices, settings.contrast, (value) =>
				change('contrast', value)
			)}
		{:else if id === 'motion'}
			{@render choiceGroup('Animation', 'motion', motionChoices, settings.motion, (value) =>
				change('motion', value)
			)}
		{:else if id === 'citations'}
			<p class="hint">
				Pages cite their sources with numbered notes, and nation pages list their sources at the end.
			</p>
			{@render choiceGroup(
				'When you select a note number',
				'note-display',
				noteDisplayChoices,
				settings.noteDisplay,
				(value) => change('noteDisplay', value)
			)}
			{@render choiceGroup(
				'Links to sources',
				'source-links',
				sourceLinkOptions,
				settings.sourceLinks,
				(value) => change('sourceLinks', value)
			)}
		{:else if id === 'glossary'}
			<p class="hint">
				Terms defined in the glossary are marked with a dotted underline and link to their glossary
				entries.
			</p>
			{@render choiceGroup(
				'Previews',
				'glossary-cards',
				glossaryCardOptions,
				settings.glossaryCards,
				(value) => change('glossaryCards', value)
			)}
			<p><a href="/glossary" onclick={close}>Open the glossary</a></p>
		{:else if id === 'data'}
			{#key dataRead}
				<OfflineSaving headingLevel={4} />
			{/key}
			<LocalData
				headingLevel={4}
				onreset={reset}
				ondeleted={() => (dataRead += 1)}
				onimported={() => {
					settings = loadSettings();
					theme = loadTheme();
				}}
			/>
		{/if}
	{/snippet}
</Modal>

<style>
	/* Icon only, the same size as the theme button beside it (Trevor, Nov. 22, 2026). */
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

	.slider-label {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
		width: min(100%, 24rem);
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
		width: min(100%, 24rem);
	}

	.slider-row input {
		flex: 1;
		min-width: 0;
		min-height: var(--layout-target-minimum);
		margin: 0;
		accent-color: var(--color-action);
		cursor: pointer;
	}

	/* The two letters show which end is smaller; they stay a fixed size, since the setting changes text. */
	.slider-end {
		flex: none;
		line-height: 1;
		color: var(--color-ink-muted);
	}

	.slider-end-small {
		font-size: 1rem;
	}

	.slider-end-large {
		font-size: 1.5rem;
	}

	/* Symbol choices sit side by side in one bordered strip. The picked one is filled and has a bar under its symbol, not color alone. */
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
		outline: 3px solid var(--color-focus-ring);
		outline-offset: -3px;
		background: var(--color-focus);
		color: var(--focus-text);
	}

	.symbol-hint {
		margin: var(--space-1) 0 0;
	}

</style>
