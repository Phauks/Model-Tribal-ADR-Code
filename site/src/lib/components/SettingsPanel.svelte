<script lang="ts">
	// Settings button and dialog (site/DESIGN.md, section 6, "Settings"). The
	// reader changes text size, font, text spacing, theme and contrast; each
	// change applies at once and is kept on this device only, through
	// src/lib/reading-settings.ts, so it works offline. The dialog is the
	// browser's own modal <dialog>: it keeps focus inside, closes with Escape
	// and returns focus to the button. Without scripts the button is hidden
	// (the needs-scripts class in global.css).
	import Settings from '@lucide/svelte/icons/settings';
	import X from '@lucide/svelte/icons/x';
	import {
		contrastChoices,
		defaultSettings,
		downloadFont,
		fontChoices,
		loadSettings,
		loadTheme,
		saveSettings,
		saveTheme,
		textSizeChoices,
		textAlignmentChoices,
		textSpacingChoices,
		themeChoices,
		type Choice,
		type ReadingSettings,
		type Theme
	} from '#lib/reading-settings.ts';

	let dialog: HTMLDialogElement | undefined = $state();
	let opener: HTMLButtonElement | undefined = $state();
	let settings = $state<ReadingSettings>({ ...defaultSettings });
	let theme = $state<Theme>('device');

	function open() {
		settings = loadSettings();
		theme = loadTheme();
		dialog?.showModal();
	}

	function close() {
		dialog?.close();
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
	onclick={open}
>
	<Settings size={20} strokeWidth={1.75} />
	<span>Settings</span>
</button>

<dialog bind:this={dialog} class="settings-dialog" aria-labelledby="settings-heading" onclose={returnFocus}>
	<div class="dialog-top">
		<h2 id="settings-heading">Settings</h2>
		<button class="button button-quiet close-button" type="button" onclick={close}>
			<X size={20} strokeWidth={1.75} />
			<span>Close</span>
		</button>
	</div>
	<p class="hint">
		Changes apply at once. They are saved on this device only, so they also work offline, and
		nothing is sent to the site.
	</p>
	<form onsubmit={(event) => event.preventDefault()}>
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
		{@render choiceGroup('Theme', 'theme', themeChoices, theme, changeTheme)}
		{@render choiceGroup('Contrast', 'contrast', contrastChoices, settings.contrast, (value) =>
			change('contrast', value)
		)}
	</form>
	<div class="dialog-actions">
		<button class="button" type="button" onclick={close}>Done</button>
		<button class="button button-quiet" type="button" onclick={reset}>Reset to defaults</button>
	</div>
</dialog>

<style>
	.settings-button {
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

	/* The dialog sits inside the masthead in the page, so it resets the band's colors. */
	.settings-dialog {
		width: min(36rem, calc(100% - 2 * var(--space-4)));
		max-height: calc(100% - 2 * var(--space-4));
		padding: var(--space-4) var(--space-5) var(--space-5);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-panel);
		background: var(--color-paper);
		color: var(--color-ink);
	}

	.settings-dialog::backdrop {
		background: var(--color-band);
		opacity: 0.6;
	}

	.settings-dialog label {
		color: var(--color-ink);
	}

	.dialog-top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.dialog-top h2 {
		margin: 0;
	}

	.close-button,
	.dialog-actions .button {
		gap: var(--space-2);
	}

	.setting {
		margin: var(--space-5) 0 0;
		padding: 0;
		border: 0;
	}

	.setting legend {
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-lead);
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

	.dialog-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin-top: var(--space-5);
		padding-top: var(--space-4);
		border-top: 1px solid var(--color-line);
	}
</style>
