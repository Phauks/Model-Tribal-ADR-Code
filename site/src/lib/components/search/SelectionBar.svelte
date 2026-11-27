<!--
	@component
	The bar above the search results once a reader ticks some (src/lib/search-selection.ts): how many
	are chosen, with their files' total size and how many are only links, then Download, Cite and
	Clear. It stays at the top of the screen while the results scroll under it, so it never covers
	them (Trevor, Nov. 27, 2026). Download opens the .zip's options in place below the bar, pushing the
	results down: what goes in, how it is laid out, and a live list of what the .zip will hold.
	Cite opens the same options with only the citations ticked.
-->
<script lang="ts" module>
	import type { SelectedItem } from '#lib/search-selection.ts';

	/** A ticked result: what the plan needs, and the link the Worker looks it up by. */
	export type ChosenResult = SelectedItem & { link: string };
</script>

<script lang="ts">
	import { onMount, tick } from 'svelte';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Download from '@lucide/svelte/icons/download';
	import File from '@lucide/svelte/icons/file';
	import Folder from '@lucide/svelte/icons/folder';
	import Info from '@lucide/svelte/icons/info';
	import Quote from '@lucide/svelte/icons/quote';
	import X from '@lucide/svelte/icons/x';
	import {
		citationFileNames,
		citationsAlone,
		citationsOnlyOptions,
		defaultSelectionOptions,
		plannedEntries,
		readSelectionOptions,
		sizeText,
		suggestedZipName,
		type CitationFormat,
		type FolderChoice,
		type NameChoice,
		type SelectionOptions,
		type SelectionRequest
	} from '#lib/search-selection.ts';

	interface Props {
		chosen: ChosenResult[];
		/** Whether the results on the screen are all ticked, some, or none. */
		shownTicked: 'all' | 'some' | 'none';
		ontoggleshown: () => void;
		onclear: () => void;
		query: string;
		/** The day, as YYYY-MM-DD, for the .zip's suggested name. */
		day: string;
	}

	let { chosen, shownTicked, ontoggleshown, onclear, query, day }: Props = $props();

	const storageKey = 'search-download-choices';

	let open = $state<'download' | 'cite' | undefined>();
	let saved = $state<SelectionOptions>({ ...defaultSelectionOptions });
	let options = $state<SelectionOptions>({ ...defaultSelectionOptions });
	let remember = $state(true);
	let form: HTMLFormElement | undefined = $state();
	let selectionField: HTMLInputElement | undefined = $state();
	let bar: HTMLDivElement | undefined = $state();

	onMount(() => {
		try {
			const kept = localStorage.getItem(storageKey);
			if (kept) saved = { ...readSelectionOptions(JSON.parse(kept)), name: '' };
		} catch {
			// expected: storage is blocked in private windows, or the kept text is not JSON; the usual choices stand.
		}
	});

	const files = $derived(chosen.filter((item) => item.file));
	const bytes = $derived(files.reduce((total, item) => total + (item.file?.[0] ?? 0), 0));
	const linksOnly = $derived(chosen.filter((item) => !item.file && !item.link.startsWith('/')).length);
	const pages = $derived(chosen.filter((item) => !item.file && item.link.startsWith('/')).length);
	const notFiles = $derived(chosen.length - files.length);
	const summary = $derived(
		[
			files.length > 0 ? `${files.length} ${files.length === 1 ? 'file' : 'files'}, ${sizeText(bytes)}` : '',
			linksOnly > 0 ? `${linksOnly} ${linksOnly === 1 ? 'link' : 'links'} only` : '',
			pages > 0 ? `${pages} ${pages === 1 ? 'page' : 'pages'}` : ''
		]
			.filter(Boolean)
			.join(' · ')
	);

	const checked = $derived(readSelectionOptions(options));
	const entries = $derived(plannedEntries(chosen, checked));
	const zipBytes = $derived(checked.files ? bytes : 0);
	const alone = $derived(citationsAlone(checked));
	const suggested = $derived(suggestedZipName(query, day));
	const nothingChosen = $derived(!checked.files && !checked.citations && !checked.list && !checked.readme);

	function show(which: 'download' | 'cite') {
		if (open === which) {
			open = undefined;
			return;
		}
		open = which;
		options = which === 'cite' ? { ...saved, ...citationsOnlyOptions, name: '' } : { ...saved, name: '' };
		// Opened from further down the results, the page goes back up to the options, which open in place above the results.
		void tick().then(() => {
			if (bar && bar.getBoundingClientRect().top < 0) bar.scrollIntoView({ block: 'start' });
		});
	}

	function setOption<Key extends keyof SelectionOptions>(key: Key, value: SelectionOptions[Key]) {
		options = { ...options, [key]: value };
	}

	function download() {
		if (!form || !selectionField || nothingChosen) return;
		const request: SelectionRequest = {
			items: chosen.map(({ link, title, group, nation }) => ({ link, title, group, ...(nation ? { nation } : {}) })),
			options: { ...checked, name: checked.name || suggested },
			query
		};
		selectionField.value = JSON.stringify(request);
		if (remember && open === 'download') {
			saved = { ...checked, name: '' };
			try {
				localStorage.setItem(storageKey, JSON.stringify(saved));
			} catch {
				// expected: storage is blocked in private windows; the choices still apply to this download.
			}
		}
		form.submit();
	}

	const includeChoices: { key: 'files' | 'citations' | 'list' | 'sums' | 'verify' | 'readme'; label: string; detail: () => string }[] = [
		{ key: 'files', label: 'Files', detail: () => `${files.length} ${files.length === 1 ? 'copy' : 'copies'}, ${sizeText(bytes)}` },
		{ key: 'citations', label: 'Citations', detail: () => `Indigo Book, all ${chosen.length}` },
		{ key: 'list', label: 'Selection list', detail: () => 'selection.csv' },
		{ key: 'sums', label: 'SHA-256 list', detail: () => 'SHA256SUMS.txt' },
		{ key: 'verify', label: 'Verify scripts', detail: () => 'verify.sh, verify.ps1' },
		{ key: 'readme', label: 'README', detail: () => 'README.txt' }
	];

	const formatLabels: Record<CitationFormat, string> = { txt: '.txt', ris: '.ris', bib: '.bib' };
	const folderLabels: Record<FolderChoice, string> = { kind: 'By kind', nation: 'By nation', none: 'None' };
	const nameLabels: Record<NameChoice, string> = { title: 'Title', publisher: 'Publisher’s' };

	function disabled(key: (typeof includeChoices)[number]['key']): boolean {
		if (key === 'sums') return !options.files || files.length === 0;
		if (key === 'verify') return !options.files || !options.sums || files.length === 0;
		if (key === 'files') return files.length === 0;
		return false;
	}

	const buttonLabel = $derived(alone ? formatLabels[checked.format] : zipBytes > 0 ? `.zip, ${sizeText(zipBytes)}` : '.zip');
</script>

{#snippet segmented(name: string, label: string, choices: Record<string, string>, value: string, onpick: (value: string) => void, off = false)}
	<div class="organize-row">
		<span class="organize-label" id="selection-{name}-label">{label}</span>
		<div class="segmented" role="radiogroup" aria-labelledby="selection-{name}-label">
			{#each Object.entries(choices) as [choice, text] (choice)}
				<label class:on={value === choice} class:off>
					<input type="radio" {name} value={choice} checked={value === choice} disabled={off} onchange={() => onpick(choice)} />
					{text}
				</label>
			{/each}
		</div>
	</div>
{/snippet}

<!-- Where the bar starts, for going back up to the options; the bar itself sticks, so it cannot say. -->
<div class="selection-anchor" bind:this={bar}></div>
<div class="bar-sticky no-print">
	<div class="bar-row" class:opened={open !== undefined}>
		<input
			class="tick-shown"
			type="checkbox"
			aria-label={shownTicked === 'all' ? 'Untick the results shown' : 'Tick every result shown'}
			checked={shownTicked === 'all'}
			indeterminate={shownTicked === 'some'}
			onchange={ontoggleshown}
		/>
		<p class="what" role="status">
			<strong>{chosen.length.toLocaleString('en-US')} selected</strong>
			{#if summary}<small>{summary}</small>{/if}
		</p>
		<button class="bar-button main" class:open={open === 'download'} type="button" aria-expanded={open === 'download'} aria-controls="selection-options" onclick={() => show('download')}>
			<Download size={20} aria-hidden="true" /><span class="word">Download</span><ChevronDown size={16} aria-hidden="true" />
		</button>
		<button class="bar-button icon" class:open={open === 'cite'} type="button" title="Cite selected" aria-label="Cite selected" aria-expanded={open === 'cite'} aria-controls="selection-options" onclick={() => show('cite')}>
			<Quote size={20} aria-hidden="true" />
		</button>
		<button class="bar-button icon" type="button" title="Clear selection" aria-label="Clear selection" onclick={() => { open = undefined; onclear(); }}>
			<X size={20} aria-hidden="true" />
		</button>
	</div>
</div>

{#if open}
	<div class="options no-print" id="selection-options" role="region" aria-label={open === 'cite' ? 'Citation options' : 'Download options'}>
		<div class="choices">
			<fieldset class="group">
				<legend>Include</legend>
				<div class="include">
					{#each includeChoices as choice (choice.key)}
						<div class="include-choice" class:off={disabled(choice.key)}>
							<input
								id="selection-include-{choice.key}"
								type="checkbox"
								checked={checked[choice.key]}
								disabled={disabled(choice.key)}
								onchange={(event) => setOption(choice.key, event.currentTarget.checked)}
							/>
							<label for="selection-include-{choice.key}">
								{choice.label}
								<small>{choice.detail()}</small>
							</label>
						</div>
					{/each}
				</div>
			</fieldset>
			<div class="group">
				<h3 class="group-title">Organize</h3>
				{@render segmented('selection-format', 'Citations as', formatLabels, checked.format, (value) => setOption('format', value as CitationFormat), !checked.citations)}
				{@render segmented('selection-folders', 'Folders', folderLabels, checked.folders, (value) => setOption('folders', value as FolderChoice), !checked.files)}
				{@render segmented('selection-names', 'File names', nameLabels, checked.names, (value) => setOption('names', value as NameChoice), !checked.files)}
				<div class="organize-row">
					<label class="organize-label" for="selection-zip-name">{alone ? 'File name' : '.zip name'}</label>
					<div class="name-field">
						<input id="selection-zip-name" type="text" autocomplete="off" spellcheck="false" placeholder={suggested} value={options.name} oninput={(event) => setOption('name', event.currentTarget.value)} />
						<span class="extension">{alone ? formatLabels[checked.format] : '.zip'}</span>
					</div>
				</div>
			</div>
		</div>
		<div class="preview">
			<h3 class="group-title">{alone ? 'The file' : 'In the .zip'}</h3>
			{#if alone}
				<ul class="tree"><li><File size={16} aria-hidden="true" /><span>{(checked.name || suggested)}{formatLabels[checked.format]}</span><em>{chosen.length}</em></li></ul>
			{:else}
				<ul class="tree">
					{#each entries as entry, index (`${index} ${entry.name}`)}
						<li class:inside={!entry.folder && entry.bytes !== undefined}>
							{#if entry.folder}<Folder size={16} aria-hidden="true" />{:else}<File size={16} aria-hidden="true" />{/if}
							<span title={entry.name}>{entry.name}</span>
							{#if entry.bytes !== undefined}<em>{sizeText(entry.bytes)}</em>{:else if entry.count !== undefined}<em>{entry.count}</em>{/if}
						</li>
					{:else}
						<li class="empty">Nothing is ticked to go in.</li>
					{/each}
				</ul>
			{/if}
		</div>
		<div class="foot">
			{#if notFiles > 0 && checked.files}
				<p class="note">
					<Info size={18} aria-hidden="true" />
					<span>{notFiles} {notFiles === 1 ? 'result is' : 'results are'} not ours to share as files, so {notFiles === 1 ? 'its' : 'their'} citation and link go in instead of a copy.</span>
				</p>
			{:else}
				<span class="note"></span>
			{/if}
			{#if open === 'download'}
				<label class="remember"><input type="checkbox" bind:checked={remember} />Remember my choices</label>
			{/if}
			<button class="bar-button" type="button" onclick={() => (open = undefined)}>Cancel</button>
			<button class="bar-button main" type="button" disabled={nothingChosen} onclick={download}>
				<Download size={20} aria-hidden="true" /><span>{buttonLabel}</span>
			</button>
		</div>
	</div>
{/if}

<form class="visually-hidden" method="post" action="/search/download" bind:this={form} aria-hidden="true">
	<input type="hidden" name="selection" bind:this={selectionField} />
</form>

<style>
	.selection-anchor {
		scroll-margin-top: var(--masthead-stuck, 0px);
	}

	/* The bar stays at the top while the results scroll under it; the options below it scroll with the page, so they never cover a result. */
	.bar-sticky {
		position: sticky;
		top: var(--masthead-stuck, 0px);
		z-index: 4;
		margin: 0 0 var(--space-1);
		padding: var(--space-2) 0 0;
		background: var(--color-paper);
	}

	.bar-sticky:has(.opened) {
		margin-bottom: 0;
	}

	/* Under the phone strip, which stays at the top on narrow screens (SiteSidebar.svelte). */
	@media (max-width: 63.99rem) {
		.bar-sticky {
			top: calc(var(--masthead-stuck, 0px) + var(--layout-target-minimum) + 1px);
		}

		.selection-anchor {
			scroll-margin-top: calc(var(--masthead-stuck, 0px) + var(--layout-target-minimum) + 1px);
		}
	}

	.bar-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: 3rem;
		padding: 0.35rem 0.5rem 0.35rem 0.6rem;
		border: 1px solid var(--color-link);
		border-radius: 10px;
		background: color-mix(in srgb, var(--color-link) 9%, var(--color-paper));
	}

	.bar-row.opened {
		border-radius: 10px 10px 0 0;
	}

	.tick-shown {
		flex: none;
		width: 1.05rem;
		height: 1.05rem;
		margin: 0 0.15rem;
		accent-color: var(--color-link);
	}

	.what {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.1rem 0.7rem;
		margin: 0;
	}

	.what strong {
		font-size: 1rem;
	}

	.what small {
		color: var(--color-ink-muted);
		font-size: 0.85rem;
	}

	.bar-button {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		min-height: 2.5rem;
		padding: 0 0.7rem;
		border: 1px solid var(--color-control-border);
		border-radius: 8px;
		background: var(--color-surface-raised);
		color: var(--color-ink);
		font: inherit;
		font-size: 0.92rem;
		font-weight: var(--font-weight-semibold);
		white-space: nowrap;
		cursor: pointer;
	}

	.bar-button.main {
		border-color: var(--color-action);
		background: var(--color-action);
		color: var(--color-action-text);
	}

	.bar-button.icon {
		justify-content: center;
		width: 2.5rem;
		padding: 0;
	}

	.bar-button.open {
		outline: 2px solid var(--color-link);
		outline-offset: 2px;
	}

	.bar-button:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.options {
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
		gap: 1rem 1.75rem;
		margin-bottom: var(--space-4);
		padding: 1rem 1.1rem;
		border: 1px solid var(--color-link);
		border-top: 0;
		border-radius: 0 0 10px 10px;
		background: var(--color-paper);
	}

	.group {
		margin: 0 0 1rem;
		padding: 0;
		border: 0;
		min-width: 0;
	}

	.group legend,
	.group-title {
		margin: 0 0 0.4rem;
		padding: 0;
		color: var(--color-ink-muted);
		font-size: 0.8rem;
		font-weight: var(--font-weight-bold);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.include {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0 1rem;
	}

	.include-choice {
		display: flex;
		align-items: flex-start;
		gap: 0.55rem;
		padding: 0.28rem 0;
		font-size: 0.93rem;
	}

	.include-choice input {
		flex: none;
		width: 1.05rem;
		height: 1.05rem;
		margin: 0.2rem 0 0;
		accent-color: var(--color-link);
	}

	.include-choice label {
		cursor: pointer;
	}

	.include-choice.off label {
		color: var(--color-ink-muted);
		cursor: not-allowed;
	}

	.include-choice small {
		display: block;
		color: var(--color-ink-muted);
		font-size: 0.8rem;
	}

	.organize-row {
		display: grid;
		grid-template-columns: 8.5rem minmax(0, 1fr);
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 0.45rem;
	}

	.organize-label {
		color: var(--color-ink);
		font-size: 0.9rem;
		font-weight: var(--font-weight-semibold);
	}

	.segmented {
		display: inline-flex;
		justify-self: start;
		border: 1px solid var(--color-control-border);
		border-radius: 8px;
		overflow: hidden;
	}

	.segmented label {
		position: relative;
		display: inline-flex;
		align-items: center;
		min-height: 2.4rem;
		padding: 0 0.75rem;
		border-left: 1px solid var(--color-control-border);
		background: var(--color-surface-raised);
		color: var(--color-ink);
		font-size: 0.92rem;
		cursor: pointer;
	}

	.segmented label:first-child {
		border-left: 0;
	}

	.segmented label.on {
		background: var(--color-band);
		color: var(--color-band-text);
		font-weight: var(--font-weight-semibold);
	}

	.segmented label.off {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.segmented input {
		position: absolute;
		inset: 0;
		opacity: 0;
		margin: 0;
		cursor: inherit;
	}

	.segmented label:has(input:focus-visible) {
		outline: 3px solid var(--focus-ring);
		outline-offset: -3px;
	}

	.name-field {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0 0.6rem;
		border: 1px solid var(--color-control-border);
		border-radius: 8px;
		background: var(--color-surface-raised);
	}

	.name-field input {
		flex: 1;
		min-width: 0;
		min-height: 2.4rem;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		font-size: 0.92rem;
	}

	.name-field input:focus {
		outline: none;
	}

	.name-field:focus-within {
		outline: 3px solid var(--focus-ring);
		outline-offset: 1px;
	}

	.extension {
		color: var(--color-ink-muted);
		font-size: 0.92rem;
	}

	.preview {
		min-width: 0;
		padding-left: 1.5rem;
		border-left: 1px solid var(--color-line);
	}

	.tree {
		margin: 0.25rem 0 0;
		padding: 0;
		list-style: none;
		font-size: 0.85rem;
	}

	.tree li {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.12rem 0;
		color: var(--color-ink);
	}

	.tree li.inside {
		padding-left: 1.35rem;
	}

	.tree li span {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tree li em {
		color: var(--color-ink-muted);
		font-style: normal;
		font-variant-numeric: tabular-nums;
	}

	.tree :global(svg) {
		flex: none;
		color: var(--color-ink-muted);
	}

	.tree .empty {
		color: var(--color-ink-muted);
	}

	.foot {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding-top: 0.8rem;
		border-top: 1px solid var(--color-line);
	}

	.note {
		flex: 1;
		display: flex;
		align-items: flex-start;
		gap: 0.55rem;
		margin: 0;
		color: var(--color-ink-muted);
		font-size: 0.85rem;
		line-height: 1.4;
	}

	.note :global(svg) {
		flex: none;
		margin-top: 0.05rem;
	}

	.remember {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		color: var(--color-ink);
		font-size: 0.85rem;
		cursor: pointer;
	}

	.remember input {
		width: 1.05rem;
		height: 1.05rem;
		margin: 0;
		accent-color: var(--color-link);
	}

	@media (max-width: 63.99rem) {
		.bar-row {
			gap: 0.4rem;
			padding: 0.3rem 0.4rem;
		}

		.what {
			flex-direction: column;
			gap: 0;
		}

		.bar-button .word {
			display: none;
		}

		.options {
			grid-template-columns: 1fr;
			padding: 0.9rem;
		}

		.preview {
			padding: 0.8rem 0 0;
			border-left: 0;
			border-top: 1px solid var(--color-line);
		}

		.foot {
			flex-wrap: wrap;
		}

		.foot .note {
			flex-basis: 100%;
		}
	}

	@media (max-width: 30rem) {
		.include {
			grid-template-columns: 1fr;
		}

		.organize-row {
			grid-template-columns: 1fr;
			gap: 0.25rem;
		}
	}
</style>
