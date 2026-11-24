<script lang="ts">
	// The editor's Checks panel (Trevor, 2026-11-22): spelling and grammar
	// from Harper (src/lib/essays/harper.ts), the definitions check (a term
	// with a glossary entry that is not linked, and a phrase used so often it
	// may need one; src/lib/essays/checks.ts), and the citation and quotation
	// checks publishing runs (the preview's problems and warnings). Checks run
	// a moment after typing stops. The quotation check (Trevor, Nov. 23, 2026)
	// runs when asked: each quotation is looked for in its source's documents
	// in the source library (src/routes/workspace/essays/[id]/quotes). Choosing an issue selects its words; its
	// buttons fix it, link it, add the word to the dictionary or hide it.
	import { onDestroy, onMount } from 'svelte';
	import SpellCheck from '@lucide/svelte/icons/spell-check';
	import X from '@lucide/svelte/icons/x';
	import { TextSelection } from 'prosemirror-state';
	import type { EditorView } from 'prosemirror-view';
	import type { Linter } from 'harper.js';
	import { essaySchema as schema } from '#lib/essays/document.ts';
	import { at, definitionIssues, repeatedPhrases, textBlocks, type CheckIssue, type TextBlock } from '#lib/essays/checks.ts';
	import { checkMarksKey, showCheckMarks } from '#lib/essays/check-marks.ts';
	import { addWord, checkText, harper, type HarperIssue } from '#lib/essays/harper.ts';

	let {
		view,
		revision,
		identifier,
		file,
		library,
		canEdit,
		selected = $bindable(null),
		open = true,
		found = $bindable(0),
		onclose
	}: {
		/** The editor, once it exists. */
		view: () => EditorView | undefined;
		/** Goes up by one each time the text changes. */
		revision: number;
		identifier: string;
		/** The whole file as it stands, for the citation and quotation checks. */
		file: () => string;
		library: { terms: [string, string][]; words?: string[] } | null;
		canEdit: boolean;
		/** The issue chosen in the panel or by clicking its mark in the text. */
		selected?: string | null;
		/** Whether the list shows; the marks in the text show either way (essay-editor-mockups/v2-1). */
		open?: boolean;
		/** How many findings there are, for the count beside Checks in the bar. */
		found?: number;
		onclose?: () => void;
	} = $props();

	let linter: Linter | null = null;
	let loading = $state('');
	let issues = $state<CheckIssue[]>([]);
	let publishing = $state<{ problems: string[]; warnings: string[] } | null>(null);
	let ignored = $state(new Set<string>());

	interface QuotationCheck {
		line: number;
		source: string;
		pinpoint: string | null;
		excerpt: string;
		result: 'exact' | 'close' | 'not-found' | 'no-copy';
		readersCanOpen: boolean;
		copy: string | null;
		differences: { source: string; quoted: string }[];
		shortCopy: boolean;
	}

	let quotations = $state<QuotationCheck[] | null>(null);
	let quotationState = $state<'' | 'checking' | 'failed'>('');
	const quotationGroups = $derived(
		quotations
			? [
					{ title: 'Quotations that differ from their source', items: quotations.filter((check) => check.result === 'close') },
					{ title: 'Quotations not found in their source', items: quotations.filter((check) => check.result === 'not-found') },
					{
						title: 'Quotations readers cannot open in context',
						items: quotations.filter((check) => check.result !== 'not-found' && check.result !== 'close' && !check.readersCanOpen)
					}
				]
			: []
	);

	async function checkQuotations(): Promise<void> {
		quotationState = 'checking';
		const response = await fetch(`/workspace/essays/${identifier}/quotes`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ text: file() })
		}).catch(() => null);
		if (!response?.ok) {
			quotationState = 'failed';
			return;
		}
		quotations = ((await response.json()) as { checks: QuotationCheck[] }).checks;
		quotationState = '';
	}

	function quotationMessage(check: QuotationCheck): string {
		const where = check.copy ? ` (${check.copy})` : '';
		if (check.result === 'close') {
			const words = check.differences
				.map((difference) =>
					difference.source && difference.quoted
						? `the source has "${difference.source}" where the quotation has "${difference.quoted}"`
						: difference.source
							? `the quotation leaves out "${difference.source}"`
							: `the quotation adds "${difference.quoted}"`
				)
				.join('; ');
			return `${words || 'A few words differ'}${where}. Check the quotation against the source; a copy can misread too.`;
		}
		if (check.result === 'not-found') {
			return check.shortCopy
				? `Not found in the copy we hold${where}, which looks like a summary rather than the whole opinion. Check the quotation and its pinpoint, or add a full copy.`
				: `Not found in the copy we hold${where}. Check the quotation and its pinpoint.`;
		}
		if (check.result === 'no-copy') return 'The library holds no copy of this source, so the quotation cannot be checked or opened.';
		return `Matches a private copy${where}, which readers cannot see. A public copy of the source would let readers open it.`;
	}
	let running = $state(false);

	const ignoreKey = (issue: CheckIssue) => `${issue.kind}:${issue.problem.toLowerCase()}:${issue.message}`;
	const shown = $derived(issues.filter((issue) => !ignored.has(ignoreKey(issue))));
	$effect(() => {
		found = shown.length + (publishing ? publishing.problems.length + publishing.warnings.length : 0);
	});
	const groups = $derived([
		{ title: 'Spelling', items: shown.filter((issue) => issue.kind === 'spelling') },
		{ title: 'Grammar and usage', items: shown.filter((issue) => issue.kind === 'grammar') },
		{ title: 'Has a glossary entry', items: shown.filter((issue) => issue.kind === 'definition') },
		{ title: 'May need a definition', items: shown.filter((issue) => issue.kind === 'repeated') }
	]);

	/**
	 * Spellings a legal essay uses on purpose that a general dictionary does
	 * not know: "v." and other abbreviations with periods (U.S.C., F.3d,
	 * initials), and Hawaiian and other words written with an ʻokina or
	 * apostrophe inside them, which Harper splits ("Hawaiʻi").
	 */
	function legalSpelling(text: string, issue: HarperIssue): boolean {
		const before = text[issue.start - 1] ?? '';
		const after = text[issue.end] ?? '';
		// Abbreviations in citations ("v.", "U.S.C.", "Civ. Proc."), list letters such as "(i)", and initials.
		if (/^(?:[\p{L}\d]{1,5}\.)+$/u.test(issue.problem) || /^\p{L}$/u.test(issue.problem)) return true;
		if (/^\p{Lu}[\p{L}]{0,4}$/u.test(issue.problem) && after === '.') return true;
		return /['‘’ʻ]/.test(before) || /['‘’ʻ]/.test(after);
	}

	/** Harper's findings for each block's text, so only changed blocks are checked again. */
	const checked = new Map<string, HarperIssue[]>();
	let progress = $state('');
	let run = 0;

	/** Spelling and grammar, block by block, letting the page breathe between blocks. Null when a newer run took over. */
	async function spellingAndGrammar(loaded: Linter, blocks: TextBlock[], thisRun: number): Promise<CheckIssue[] | null> {
		const found: CheckIssue[] = [];
		const waiting = blocks.filter((block) => block.text.trim() && !checked.has(block.text)).length;
		let done = 0;
		let sliceStarted = performance.now();
		for (const block of blocks) {
			if (!block.text.trim()) continue;
			let issues = checked.get(block.text);
			if (!issues) {
				issues = await checkText(loaded, block.text);
				if (checked.size > 20_000) checked.clear();
				checked.set(block.text, issues);
				done += 1;
				if (performance.now() - sliceStarted > 40) {
					if (waiting > 20) progress = `Checking spelling and grammar: ${Math.round((done / waiting) * 100)}%`;
					await new Promise((resolve) => setTimeout(resolve, 0));
					sliceStarted = performance.now();
					if (thisRun !== run) return null;
				}
			}
			for (const issue of issues) {
				if (issue.spelling && legalSpelling(block.text, issue)) continue;
				// Extra spaces left where a citation or other inline piece was taken out of the text checked.
				if (!issue.problem.trim()) continue;
				const kind = issue.spelling ? 'spelling' : 'grammar';
				const from = at(block, issue.start);
				found.push({
					id: `${kind}:${from}:${issue.problem}`,
					kind,
					from,
					to: at(block, issue.end),
					problem: issue.problem,
					message: issue.message,
					suggestions: issue.suggestions
				});
			}
		}
		progress = '';
		return found;
	}

	async function runChecks(): Promise<void> {
		const editor = view();
		if (!editor || !library) return;
		running = true;
		const doc = editor.state.doc;
		const blocks = textBlocks(doc);
		const linked = new Set<string>();
		doc.descendants((node) => {
			if (node.type.name === 'term_link') linked.add(String(node.attrs.id));
		});
		const found: CheckIssue[] = [...definitionIssues(blocks, library.terms, linked), ...repeatedPhrases(blocks, library.terms)];
		const thisRun = (run += 1);
		if (linter) {
			try {
				const spelling = await spellingAndGrammar(linter, blocks, thisRun);
				if (spelling === null) return;
				found.push(...spelling);
			} catch {
				loading = 'Spelling and grammar stopped working. Close and open Checks to try again.';
			}
		}
		const current = view();
		if (current && current.state.doc === doc) {
			issues = found.sort((first, second) => first.from - second.from);
			showCheckMarks(current, shown, doc);
		}
		running = false;
	}

	async function runPublishingChecks(): Promise<void> {
		const response = await fetch(`/workspace/essays/${identifier}/preview`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text: file() })
		}).catch(() => null);
		if (!response?.ok) return;
		const rendered = (await response.json()) as { problems?: string[]; warnings?: string[] };
		publishing = { problems: rendered.problems ?? [], warnings: rendered.warnings ?? [] };
	}

	let textTimer: ReturnType<typeof setTimeout> | undefined;
	let publishingTimer: ReturnType<typeof setTimeout> | undefined;
	let started = $state(false);

	$effect(() => {
		// Runs again a moment after each change to the text.
		void revision;
		if (!library || !started) return;
		clearTimeout(textTimer);
		clearTimeout(publishingTimer);
		textTimer = setTimeout(() => void runChecks(), 1200);
		publishingTimer = setTimeout(() => void runPublishingChecks(), 4000);
	});

	let harperRequested = false;

	async function loadHarper(words: string[]): Promise<void> {
		loading = 'Loading spelling and grammar (about 20 MB, the first time only)…';
		try {
			linter = await harper(words);
			loading = '';
			void runChecks();
		} catch {
			loading = 'Spelling and grammar could not be loaded. The other checks still run.';
		}
	}

	onMount(() => {
		started = true;
		void runPublishingChecks();
	});

	onDestroy(() => {
		clearTimeout(textTimer);
		clearTimeout(publishingTimer);
		const editor = view();
		if (editor) editor.dispatch(editor.state.tr.setMeta(checkMarksKey, undefined).setMeta('addToHistory', false));
	});

	$effect(() => {
		// The library (glossary terms and the dictionary's extra words) arrives after the panel opens.
		if (!library || !started || harperRequested) return;
		harperRequested = true;
		void runChecks();
		void loadHarper(library.words ?? []);
	});

	/** Where an issue is now: its mark follows the text as it changes. */
	function placeOf(issue: CheckIssue): { from: number; to: number } | null {
		const editor = view();
		if (!editor) return null;
		const found = checkMarksKey
			.getState(editor.state)
			?.find(undefined, undefined, (spec) => (spec as { issue?: string }).issue === issue.id);
		return found?.[0] ? { from: found[0].from, to: found[0].to } : null;
	}

	function choose(issue: CheckIssue): void {
		selected = issue.id;
		const editor = view();
		const place = placeOf(issue);
		if (!editor || !place) return;
		editor.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, place.from, place.to)).scrollIntoView());
		editor.focus();
	}

	function replace(issue: CheckIssue, text: string): void {
		const editor = view();
		const place = placeOf(issue);
		if (!editor || !place || !canEdit) return;
		const transaction = text ? editor.state.tr.insertText(text, place.from, place.to) : editor.state.tr.delete(place.from, place.to);
		editor.dispatch(transaction.scrollIntoView());
		issues = issues.filter((other) => other.id !== issue.id);
		editor.focus();
	}

	function linkTerm(issue: CheckIssue): void {
		const editor = view();
		const place = placeOf(issue);
		if (!editor || !place || !canEdit || !issue.termId) return;
		editor.dispatch(
			editor.state.tr.replaceWith(place.from, place.to, schema.node('term_link', { id: issue.termId, text: issue.problem })).scrollIntoView()
		);
		issues = issues.filter((other) => other.id !== issue.id);
		editor.focus();
	}

	function ignore(issue: CheckIssue): void {
		ignored = new Set([...ignored, ignoreKey(issue)]);
		const editor = view();
		if (editor) showCheckMarks(editor, shown, editor.state.doc);
	}

	async function addToDictionary(issue: CheckIssue): Promise<void> {
		await addWord(issue.problem);
		for (const [text, found] of checked) if (found.some((other) => other.problem === issue.problem)) checked.delete(text);
		issues = issues.filter((other) => !(other.kind === 'spelling' && other.problem === issue.problem));
		const editor = view();
		if (editor) showCheckMarks(editor, shown, editor.state.doc);
	}

	$effect(() => {
		// An issue chosen by clicking its mark: bring it into view in the list.
		if (!selected) return;
		document.getElementById(`check-${CSS.escape(selected)}`)?.scrollIntoView({ block: 'nearest' });
	});
</script>

{#if open}
<section class="checks" aria-labelledby="checks-heading">
	<header class="checks-head">
		<h2 id="checks-heading" class="small"><SpellCheck size={18} aria-hidden="true" /> Checks</h2>
		<span class="small muted">checked on your computer</span>
		{#if onclose}<button type="button" class="close" aria-label="Close the checks" title="Close" onclick={onclose}><X size={18} aria-hidden="true" /></button>{/if}
	</header>
	<p class="small muted status" role="status" aria-live="polite">
		{#if loading}{loading}{:else if progress}{progress}{:else if running}Checking…{:else}{shown.length === 0 ? 'Nothing found.' : `${shown.length} to look at.`}{/if}
	</p>
	{#if publishing && publishing.problems.length + publishing.warnings.length > 0}
		<details open>
			<summary>Citations and quotations ({publishing.problems.length + publishing.warnings.length})</summary>
			<ul class="plain">
				{#each publishing.problems as problem (problem)}<li class="problem">{problem} <span class="muted">Publishing is refused until this is fixed.</span></li>{/each}
				{#each publishing.warnings as warning, index (index)}<li>{warning}</li>{/each}
			</ul>
		</details>
	{/if}
	<div class="quotations">
		<button type="button" class="button button-quiet small" onclick={() => void checkQuotations()} disabled={quotationState === 'checking'}>
			{quotations ? 'Check the quotations again' : 'Check the quotations against their sources'}
		</button>
		<span class="small muted" role="status" aria-live="polite">
			{#if quotationState === 'checking'}Checking each quotation in the source library…{:else if quotationState === 'failed'}The check could not run. Try again.{:else if quotations}{quotations.length} quotations; {quotations.filter((check) => check.result === 'exact').length} match word for word, {quotations.filter((check) => check.readersCanOpen).length} can be opened by readers.{/if}
		</span>
	</div>
	{#each quotationGroups as group (group.title)}
		{#if group.items.length > 0}
			<details open={group.items.length <= 25}>
				<summary>{group.title} ({group.items.length})</summary>
				<ul class="plain">
					{#each group.items as check (`${check.line}-${check.source}`)}
						<li>
							<strong>“{check.excerpt}”</strong>
							<span class="small">{check.source}{check.pinpoint ? `, ${check.pinpoint}` : ''}, line {check.line}. {quotationMessage(check)}</span>
						</li>
					{/each}
				</ul>
			</details>
		{/if}
	{/each}
	{#each groups as group (group.title)}
		{#if group.items.length > 0}
			<details open={group.items.length <= 25}>
				<summary>{group.title} ({group.items.length})</summary>
				<ul class="plain">
					{#each group.items as issue (issue.id)}
						<li id="check-{issue.id}" class:chosen={selected === issue.id}>
							<button type="button" class="issue" onclick={() => choose(issue)}>
								<strong>{issue.problem.length > 80 ? `${issue.problem.slice(0, 80)}…` : issue.problem}</strong>
								<span class="small">{issue.message}</span>
							</button>
							{#if canEdit}
								<span class="fixes">
									{#each issue.suggestions as suggestion, index (index)}
										<button type="button" class="button button-quiet small" onclick={() => replace(issue, suggestion)}>
											{suggestion ? suggestion : 'Remove'}
										</button>
									{/each}
									{#if issue.kind === 'definition'}
										<button type="button" class="button button-quiet small" onclick={() => linkTerm(issue)}>Link to the glossary</button>
									{/if}
									{#if issue.kind === 'spelling'}
										<button type="button" class="button button-quiet small" onclick={() => addToDictionary(issue)}>Add to dictionary</button>
									{/if}
									<button type="button" class="button button-quiet small" onclick={() => ignore(issue)}>Ignore</button>
								</span>
							{/if}
						</li>
					{/each}
				</ul>
			</details>
		{/if}
	{/each}
	{#if groups.some((group) => group.title === 'May need a definition' && group.items.length > 0)}
		<p class="small muted">A phrase used often may be a term of art. Ask for a glossary entry through the glossary's own process; the essay then links it.</p>
	{/if}
</section>
{/if}

<style>
	/* A panel in the right margin, as in essay-editor-mockups/v2-3. */
	.checks {
		position: sticky;
		/* Below the masthead and its tools, which stay at the top of the screen while editing. */
		top: calc(var(--masthead-stuck, 0px) + var(--space-4));
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		padding: var(--space-2) var(--space-3);
		margin: 0 0 var(--space-3);
		max-height: calc(100vh - var(--masthead-stuck, 0px) - 2 * var(--space-4));
		overflow-y: auto;
		background: var(--color-surface-raised);
		box-shadow: 0 1px 3px color-mix(in srgb, var(--color-ink) 10%, transparent);
	}

	.checks-head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0 0 var(--space-2);
	}

	.checks-head h2 {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		margin: 0;
		flex: 1;
	}

	.close {
		display: inline-grid;
		place-items: center;
		min-width: var(--layout-target-minimum);
		min-height: var(--layout-target-minimum);
		border: 0;
		background: none;
		color: var(--color-ink);
		cursor: pointer;
	}

	.status {
		margin: 0 0 var(--space-2);
	}

	.quotations {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		margin: 0 0 var(--space-2);
	}

	.plain li > strong,
	.plain li > .small {
		display: block;
	}

	details {
		margin-bottom: var(--space-2);
	}

	summary {
		font-weight: 600;
		cursor: pointer;
	}

	.plain {
		list-style: none;
		margin: var(--space-1) 0 0;
		padding: 0;
	}

	.plain li {
		padding: var(--space-1) 0;
		border-top: 1px solid var(--color-line);
	}

	.plain li.chosen {
		background: var(--color-notice-background);
	}

	.issue {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		color: inherit;
		cursor: pointer;
	}

	.fixes {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin-top: var(--space-1);
	}

	.problem {
		color: var(--color-danger);
	}
</style>
