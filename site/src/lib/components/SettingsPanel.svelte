<script lang="ts">
	// Settings button and dialog (site/DESIGN.md, section 6, "Settings"). The
	// dialog is the shared two-panel Modal: sections on the left (Text,
	// Colors, Citations, Glossary, Saved for offline) and the chosen section on
	// the right. Reading settings apply at once and are kept on this device
	// only, through src/lib/reading-settings.ts, so they work offline. Without
	// scripts the button is hidden (the needs-scripts class in global.css).
	import BookA from '@lucide/svelte/icons/book-a';
	import HardDriveDownload from '@lucide/svelte/icons/hard-drive-download';
	import Palette from '@lucide/svelte/icons/palette';
	import Quote from '@lucide/svelte/icons/quote';
	import Settings from '@lucide/svelte/icons/settings';
	import Type from '@lucide/svelte/icons/type';
	import Modal from './Modal.svelte';
	import OfflineSaving from './OfflineSaving.svelte';
	import {
		contrastChoices,
		defaultSettings,
		downloadFont,
		fontChoices,
		glossaryCardOptions,
		loadSettings,
		loadTheme,
		noteDisplayChoices,
		saveSettings,
		saveTheme,
		sourceLinkOptions,
		textAlignmentChoices,
		textSizeChoices,
		textSpacingChoices,
		themeChoices,
		type Choice,
		type ReadingSettings,
		type Theme
	} from '#lib/reading-settings.ts';

	type SectionIdentifier = 'text' | 'colors' | 'citations' | 'glossary' | 'offline';

	const sections = [
		{ id: 'text', label: 'Text', icon: Type },
		{ id: 'colors', label: 'Colors', icon: Palette },
		{ id: 'citations', label: 'Citations', icon: Quote },
		{ id: 'glossary', label: 'Glossary', icon: BookA },
		{ id: 'offline', label: 'Saved for offline', icon: HardDriveDownload }
	] satisfies { id: SectionIdentifier; label: string; icon: unknown }[];

	let modal: Modal<SectionIdentifier> | undefined = $state();
	let opener: HTMLButtonElement | undefined = $state();
	let selected = $state<SectionIdentifier>('text');
	let settings = $state<ReadingSettings>({ ...defaultSettings });
	let theme = $state<Theme>('device');

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

<button
	bind:this={opener}
	class="settings-button needs-scripts"
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
			{@render choiceGroup('Text size', 'text-size', textSizeChoices, settings.textSize, (value) =>
				change('textSize', value)
			)}
			{@render choiceGroup('Font', 'font', fontChoices, settings.font, (value) =>
				change('font', value)
			)}
			{@render choiceGroup(
				'Text spacing',
				'text-spacing',
				textSpacingChoices,
				settings.textSpacing,
				(value) => change('textSpacing', value)
			)}
			{@render choiceGroup(
				'Text alignment',
				'text-alignment',
				textAlignmentChoices,
				settings.textAlignment,
				(value) => change('textAlignment', value)
			)}
		{:else if id === 'colors'}
			{@render choiceGroup('Theme', 'theme', themeChoices, theme, changeTheme)}
			{@render choiceGroup('Contrast', 'contrast', contrastChoices, settings.contrast, (value) =>
				change('contrast', value)
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
				Terms the project defines are marked with a dotted underline and link to their glossary
				entries.
			</p>
			{@render choiceGroup(
				'Glossary cards',
				'glossary-cards',
				glossaryCardOptions,
				settings.glossaryCards,
				(value) => change('glossaryCards', value)
			)}
			<p><a href="/glossary" onclick={close}>Open the glossary</a></p>
		{:else if id === 'offline'}
			<OfflineSaving headingLevel={4} />
		{/if}
		{#if id !== 'offline'}
			<p class="hint saved-note">
				Changes apply at once. They are saved on this device only, so they also work offline, and
				nothing is sent to the site.
			</p>
		{/if}
	{/snippet}
	{#snippet actions()}
		<button class="button" type="button" onclick={close}>Done</button>
		<button class="button button-quiet" type="button" onclick={reset}>Reset settings to defaults</button>
	{/snippet}
</Modal>

<style>
	/* Icon only, the same size as the theme button beside it (Trevor, Nov. 22, 2026). */
	.settings-button {
		display: inline-grid;
		place-items: center;
		min-width: var(--layout-target-minimum);
		min-height: var(--layout-target-minimum);
		padding: 0;
		border: 1px solid var(--color-band-text);
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--color-band-text);
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
