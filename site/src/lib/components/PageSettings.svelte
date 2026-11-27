<script lang="ts">
	// The masthead's cog and its Page settings popover (site/DESIGN.md,
	// section 6, "Settings"). Trevor asked on Nov. 26, 2026 that the cog open
	// a small panel right under it with the settings that change how the page
	// looks, dark mode among them, and a "More settings" button at the bottom
	// for the rest; the theme button left the masthead for this panel. The
	// panel holds the theme (light, dark or this device's), text size, text
	// width, alignment, body font and heading font (Trevor chose these, option
	// B of design/page-settings-popover, on Nov. 26, 2026; on Nov. 27, 2026 he
	// removed Spacing and split Font into body and heading fonts, mockup
	// design/spacing-and-fonts), each the same control
	// as in the full dialog (SettingSlider.svelte, SymbolChoice.svelte,
	// Dropdown.svelte). "More settings" opens the
	// full Settings dialog (SettingsPanel.svelte) at Text.
	//
	// The panel is a native popover, so it sits above everything, and Escape
	// or a click outside closes it, with focus back on the cog. It is a
	// non-modal dialog: focus moves into it when it opens. Every change
	// applies at once and is kept on this device, through
	// src/lib/reading-settings.ts, as in the dialog. On phones the cog sits in
	// the More panel and the popover opens across the screen under the
	// masthead, over the More panel. Without scripts the cog is hidden, since
	// the settings cannot work (the needs-scripts class in global.css).
	import { tick } from 'svelte';
	import Moon from '@lucide/svelte/icons/moon';
	import MonitorSmartphone from '@lucide/svelte/icons/monitor-smartphone';
	import Settings from '@lucide/svelte/icons/settings';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import Sun from '@lucide/svelte/icons/sun';
	import TextAlignJustify from '@lucide/svelte/icons/text-align-justify';
	import TextAlignStart from '@lucide/svelte/icons/text-align-start';
	import Dropdown from './Dropdown.svelte';
	import SettingSlider from './SettingSlider.svelte';
	import SettingsPanel from './SettingsPanel.svelte';
	import SymbolChoice from './SymbolChoice.svelte';
	import {
		addOpenDyslexicFaces,
		defaultSettings,
		downloadFont,
		fontChoices,
		fontFamilyTokens,
		headingFontChoices,
		lineWidthChoices,
		loadSettings,
		loadTheme,
		saveSettings,
		saveTheme,
		textAlignmentChoices,
		textSizeChoices,
		type Choice,
		type HeadingFont,
		type ReadingSettings,
		type TextAlignment,
		type Theme
	} from '#lib/reading-settings.ts';

	let cog: HTMLButtonElement | undefined = $state();
	let panel: HTMLDivElement | undefined = $state();
	let full: SettingsPanel | undefined = $state();
	let settings = $state<ReadingSettings>({ ...defaultSettings });
	let theme = $state<Theme>('device');

	// Light and dark first, as the most common picks; the device's own setting last.
	const themeChoices: Choice<Theme>[] = [
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' },
		{ value: 'device', label: 'Match this device' }
	];
	const themeIcons = { light: Sun, dark: Moon, device: MonitorSmartphone } satisfies Record<Theme, unknown>;
	const alignmentIcons = { left: TextAlignStart, justified: TextAlignJustify } satisfies Record<TextAlignment, unknown>;

	/** Each font choice is shown in its own typeface, as in the dialog. */
	function fontStyle(font: HeadingFont): string {
		return `font-family: var(${fontFamilyTokens[font]})`;
	}

	// The dialog may change a setting while the panel is closed, so the panel reads them again each time it opens.
	function read() {
		settings = loadSettings();
		theme = loadTheme();
	}

	function change<Name extends keyof ReadingSettings>(name: Name, value: ReadingSettings[Name]) {
		settings[name] = value;
		saveSettings($state.snapshot(settings));
		if (name === 'font' || name === 'headingFont') downloadFont(value as HeadingFont);
	}

	function changeTheme(value: Theme) {
		theme = value;
		saveTheme(value);
	}

	/** Puts the panel under the cog, its right edge on the cog's, on wider screens; phones place it with CSS. */
	function place() {
		if (!panel || !cog) return;
		const button = cog.getBoundingClientRect();
		if (button.width === 0) return;
		panel.style.setProperty('--panel-top', `${button.bottom + 8}px`);
		panel.style.setProperty('--panel-right', `${Math.max(8, document.documentElement.clientWidth - button.right)}px`);
	}

	async function toggled(event: ToggleEvent) {
		if (event.newState !== 'open') return;
		read();
		// The font choice shows OpenDyslexic in its own typeface, whose faces are read only when needed.
		void addOpenDyslexicFaces();
		await tick();
		panel?.focus();
	}

	function moreSettings() {
		panel?.hidePopover();
		full?.open('text', cog);
	}
</script>

<button
	bind:this={cog}
	class="icon-button page-settings-button needs-scripts"
	type="button"
	popovertarget="page-settings"
	aria-label="Settings"
	title="Settings"
	onclick={place}
>
	<Settings size={24} />
</button>
<div
	bind:this={panel}
	id="page-settings"
	class="page-settings"
	popover="auto"
	tabindex="-1"
	role="dialog"
	aria-label="Page settings"
	ontoggle={toggled}
>
	<SymbolChoice
		legend="Theme"
		name="page-settings-theme"
		choices={themeChoices}
		icons={themeIcons}
		value={theme}
		hints={false}
		onchange={changeTheme}
	/>
	<SettingSlider
		id="page-settings-text-size"
		label="Text size"
		choices={textSizeChoices}
		value={settings.textSize}
		fallback={defaultSettings.textSize}
		valueText={(choice) => `${choice.value} percent`}
		ends="letters"
		onchange={(value) => change('textSize', value)}
	/>
	<SettingSlider
		id="page-settings-line-width"
		label="Text width"
		choices={lineWidthChoices}
		value={settings.lineWidth}
		fallback={defaultSettings.lineWidth}
		valueText={(choice) => `${choice.value} percent of the page width`}
		ends={['Narrow', 'Full']}
		onchange={(value) => change('lineWidth', value)}
	/>
	<SymbolChoice
		legend="Alignment"
		name="page-settings-alignment"
		choices={textAlignmentChoices}
		icons={alignmentIcons}
		value={settings.textAlignment}
		hints={false}
		onchange={(value) => change('textAlignment', value)}
	/>
	<Dropdown
		label="Body font"
		choices={fontChoices}
		value={settings.font}
		onchange={(value) => change('font', value)}
		choiceStyle={fontStyle}
	/>
	<Dropdown
		label="Heading font"
		choices={headingFontChoices}
		value={settings.headingFont}
		onchange={(value) => change('headingFont', value)}
		choiceStyle={fontStyle}
	/>
	<button type="button" class="more-settings" onclick={moreSettings}>
		<SlidersHorizontal size={20} aria-hidden="true" />
		More settings
	</button>
</div>
<SettingsPanel bind:this={full} />

<style>
	/* While the panel is open, the cog shows in the band's colors reversed, as Download and the account button do. */
	.page-settings-button:has(+ .page-settings:popover-open) {
		background: var(--color-band-text);
		color: var(--color-band);
	}

	.page-settings {
		position: fixed;
		inset: var(--panel-top, 3.5rem) var(--panel-right, var(--space-2)) auto auto;
		width: min(var(--layout-popover-form), calc(100vw - 2 * var(--space-2)));
		max-height: calc(100dvh - var(--panel-top, 3.5rem) - var(--space-3));
		overflow-y: auto;
		box-sizing: border-box;
		margin: 0;
		padding: var(--space-4) var(--space-4) 0;
		flex-direction: column;
		gap: var(--space-4);
		background: var(--color-surface-raised);
		color: var(--color-ink);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-panel);
		box-shadow: 0 var(--space-2) var(--space-5) color-mix(in srgb, var(--color-ink) 25%, transparent);
		text-align: left;
	}

	.page-settings:popover-open {
		display: flex;
	}

	.page-settings:not(:popover-open) {
		display: none;
	}

	.page-settings:focus:not(:focus-visible) {
		outline: none;
	}

	/* "More settings" fills the panel's bottom edge, under a rule, so it reads as the way on rather than another setting. */
	.more-settings {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		margin: 0 calc(-1 * var(--space-4));
		padding: var(--space-2) var(--space-4);
		border: 0;
		border-top: 1px solid var(--color-line);
		background: none;
		color: var(--color-action);
		font: inherit;
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
	}

	.more-settings:hover {
		background: color-mix(in srgb, var(--color-action) 10%, transparent);
	}

	.more-settings:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: -3px;
	}

	/* Where the window is tall enough for the whole panel, the font list can hang below it rather than scroll it. */
	@media (min-width: 40.01rem) and (min-height: 48rem) {
		.page-settings {
			overflow: visible;
		}
	}

	/* Phones: under the one-row masthead, across the screen, over the More panel. */
	@media (max-width: 40rem) {
		.page-settings {
			inset: 3.5rem var(--space-2) auto;
			width: auto;
			max-height: calc(100dvh - 4rem);
		}
	}
</style>
