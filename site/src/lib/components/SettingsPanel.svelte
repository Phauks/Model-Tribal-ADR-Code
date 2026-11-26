<script lang="ts">
	// The full Settings dialog (site/DESIGN.md, section 6, "Settings"). The
	// masthead's cog opens the Page settings popover (PageSettings.svelte),
	// whose "More settings" opens this dialog; other pages open it through
	// src/lib/settings-dialog.ts. The dialog is the shared two-panel Modal: sections on the left (Text,
	// Colors, Motion, Citations, Glossary, Editing for people with workspace
	// access, This device) and the chosen section on the right.
	// It has no buttons along the bottom; Close at the top closes it, and
	// Reset sits in This device. Settings change how the site looks on this
	// screen: they apply at once and are kept on this device, through
	// src/lib/reading-settings.ts, so they work offline. Who someone is to the
	// project, and what it keeps about them, is in Account settings instead
	// (site/DESIGN.md, section 6, "Settings and Account"). A signed-in person
	// can choose to use these settings on every device they sign in on
	// (src/lib/settings-everywhere.ts).
	import BookA from '@lucide/svelte/icons/book-a';
	import MonitorSmartphone from '@lucide/svelte/icons/monitor-smartphone';
	import PencilLine from '@lucide/svelte/icons/pencil-line';
	import Palette from '@lucide/svelte/icons/palette';
	import Quote from '@lucide/svelte/icons/quote';
	import TextAlignJustify from '@lucide/svelte/icons/text-align-justify';
	import TextAlignStart from '@lucide/svelte/icons/text-align-start';
	import Type from '@lucide/svelte/icons/type';
	import Wind from '@lucide/svelte/icons/wind';
	import { onMount } from 'svelte';
	import Dropdown from './Dropdown.svelte';
	import SettingSlider from './SettingSlider.svelte';
	import SymbolChoice from './SymbolChoice.svelte';
	import { registerSettingsDialog, type SettingsSection } from '#lib/settings-dialog.ts';
	import LocalData from './LocalData.svelte';
	import Modal from './Modal.svelte';
	import OfflineSaving from './OfflineSaving.svelte';
	import { readSignedInHint } from '#lib/signed-in-hint.ts';
	import { readEverywhere, turnEverywhereOff, turnEverywhereOn } from '#lib/settings-everywhere.ts';
	import {
		contrastChoices,
		defaultSettings,
		addOpenDyslexicFaces,
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
		otherCursorOptions,
		sourceGroupOptions,
		textSizeChoices,
		textSpacingChoices,
		themeChoices,
		type Choice,
		type Font,
		type ReadingSettings,
		type TextAlignment,
		type Theme
	} from '#lib/reading-settings.ts';

	type SectionIdentifier = SettingsSection;

	const allSections = [
		{ id: 'text', label: 'Text', icon: Type },
		{ id: 'colors', label: 'Colors', icon: Palette },
		{ id: 'motion', label: 'Motion', icon: Wind },
		{ id: 'citations', label: 'Citations', icon: Quote },
		{ id: 'glossary', label: 'Glossary', icon: BookA },
		{ id: 'editing', label: 'Editing', icon: PencilLine },
		// "Data" until Nov. 23, 2026, renamed so it is not taken for "Your data" in Account settings.
		{ id: 'device', label: 'This device', icon: MonitorSmartphone }
	] satisfies { id: SectionIdentifier; label: string; icon: unknown }[];

	// Who is signed in, from the signed-in hint (src/lib/signed-in-hint.ts), read when the dialog opens.
	let signedIn = $state(false);
	let hasWorkspace = $state(false);
	// Editing is only for people who can edit in the workspace.
	const sections = $derived(allSections.filter((section) => section.id !== 'editing' || hasWorkspace));

	let everywhere = $state(false);
	let everywhereBusy = $state(false);
	let everywhereProblem = $state('');

	async function changeEverywhere(on: boolean) {
		everywhereBusy = true;
		everywhereProblem = '';
		const done = on ? await turnEverywhereOn() : await turnEverywhereOff();
		everywhereBusy = false;
		if (done) everywhere = on;
		else everywhereProblem = 'That could not be saved. Check your connection and that you are still signed in, then try again.';
	}

	let modal: Modal<SectionIdentifier> | undefined = $state();
	/** Where focus goes when the dialog closes: the cog, or whatever opened it. */
	let opener: HTMLElement | null = null;
	let selected = $state<SectionIdentifier>('text');
	let settings = $state<ReadingSettings>({ ...defaultSettings });
	let theme = $state<Theme>('device');
	/** Changes after a delete in This device, so the saved pages list reads the device again. */
	let dataRead = $state(0);

	export function open(section: SectionIdentifier = 'text', returnTo?: HTMLElement | null) {
		opener = returnTo ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
		selected = section;
		settings = loadSettings();
		theme = loadTheme();
		const hint = readSignedInHint(document.cookie);
		signedIn = hint.signedIn;
		hasWorkspace = hint.workspacePageNames.length > 0;
		everywhere = signedIn && readEverywhere().on;
		everywhereProblem = '';
		// The font choice shows OpenDyslexic in its own typeface, whose faces are read only when needed.
		void addOpenDyslexicFaces();
		modal?.open();
	}

	function close() {
		modal?.close();
	}

	function returnFocus() {
		opener?.focus();
		opener = null;
	}

	onMount(() => registerSettingsDialog(open));

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
			<div class="setting">
				<SettingSlider
					id="setting-text-size"
					label="Text size"
					choices={textSizeChoices}
					value={settings.textSize}
					fallback={defaultSettings.textSize}
					valueText={(choice) => `${choice.value} percent`}
					ends="letters"
					onchange={(value) => change('textSize', value)}
				/>
			</div>
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
			<div class="setting">
				<SymbolChoice
					legend="Text alignment"
					name="setting-text-alignment"
					choices={textAlignmentChoices}
					icons={alignmentIcons}
					value={settings.textAlignment}
					onchange={(value) => change('textAlignment', value)}
				/>
			</div>
			<div class="setting">
				<SettingSlider
					id="setting-line-width"
					label="Text width"
					choices={lineWidthChoices}
					value={settings.lineWidth}
					fallback={defaultSettings.lineWidth}
					valueText={(choice) => `${choice.value} percent of the page width`}
					ends={['Narrow', 'Full']}
					onchange={(value) => change('lineWidth', value)}
				/>
			</div>
		{:else if id === 'colors'}
			{@render choiceGroup('Theme', 'theme', themeChoices, theme, changeTheme)}
			{@render choiceGroup('Contrast', 'contrast', contrastChoices, settings.contrast, (value) =>
				change('contrast', value)
			)}
		{:else if id === 'motion'}
			{@render choiceGroup('Motion', 'motion', motionChoices, settings.motion, (value) =>
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
			{@render choiceGroup(
				'Groups in long References lists',
				'source-groups',
				sourceGroupOptions,
				settings.sourceGroups,
				(value) => change('sourceGroups', value)
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
		{:else if id === 'editing'}
			<p class="hint">
				When people edit an essay together, each person’s cursor shows in their color. This changes only what
				you see. The color others see for you is under <a href="/account/security" onclick={close}>Your account</a>.
			</p>
			{@render choiceGroup(
				'Other people’s cursors',
				'other-cursors',
				otherCursorOptions,
				settings.otherCursors,
				(value) => change('otherCursors', value)
			)}
		{:else if id === 'device'}
			<p class="hint">Everything in Settings is kept in this browser, on this device.</p>
			{#if signedIn}
				<div class="setting everywhere">
					<div class="choice">
						<input
							type="checkbox"
							role="switch"
							id="setting-everywhere"
							checked={everywhere}
							disabled={everywhereBusy}
							aria-describedby="setting-everywhere-hint"
							onchange={(event) => changeEverywhere(event.currentTarget.checked)}
						/>
						<div>
							<label for="setting-everywhere">Use these settings on every device I sign in on</label>
							<p class="hint" id="setting-everywhere-hint">
								A copy is kept with your account. On another device, it replaces that device’s settings after you
								sign in. Starred pages, print choices and pages saved for offline stay on each device.
							</p>
						</div>
					</div>
					{#if everywhereProblem}<p class="hint everywhere-problem" role="alert">{everywhereProblem}</p>{/if}
				</div>
			{/if}
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

	/* The every-device switch is a choice with real weight, so its label is bold like a legend. */
	.everywhere label {
		font-weight: var(--font-weight-bold);
	}

	.everywhere-problem {
		color: var(--color-danger);
	}

	/* The sliders keep to a comfortable width in the dialog's wide panel. */
	.setting :global(.setting-slider) {
		width: min(100%, 24rem);
	}
</style>
