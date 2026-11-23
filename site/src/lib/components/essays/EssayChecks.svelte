<script lang="ts">
	// The editor's Checks panel (Trevor, 2026-11-22): spelling and grammar
	// from Harper (src/lib/essays/harper.ts), the definitions check (a term
	// with a glossary entry that is not linked, and a phrase used so often it
	// may need one; src/lib/essays/checks.ts), and the citation and quotation
	// checks publishing runs (the preview's problems and warnings). Checks run
	// a moment after typing stops. Choosing an issue selects its words; its
	// buttons fix it, link it, add the word to the dictionary or hide it.
	import { onDestroy, onMount } from 'svelte';
	import { TextSelection } from 'prosemirror-state';
	import type { EditorView } from 'prosemirror-view';
	import type { Linter } from 'harper.js';
	import { essaySchema as schema } from '#lib/essays/document.ts';
	import { definitionIssues, joinBlocks, repeatedPhrases, textBlocks, type CheckIssue } from '#lib/essays/checks.ts';
	import { checkMarksKey, showCheckMarks } from '#lib/essays/check-marks.ts';
	import { addWord, checkText, harper } from '#lib/essays/harper.ts';

	let {
		view,
		revision,
		identifier,
		file,
		library,
		canEdit,
		selected = $bindable(null)
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
	} = $props();

	let linter: Linter | null = null;
	let loading = $state('');
	let issues = $state<CheckIssue[]>([]);
	let publishing = $state<{ problems: string[]; warnings: string[] } | null>(null);
	let ignored = $state(new Set<string>());
	let running = $state(false);

	const ignoreKey = (issue: CheckIssue) => `${issue.kind}:${issue.problem.toLowerCase()}:${issue.message}`;
	const shown = $derived(issues.filter((issue) => !ignored.has(ignoreKey(issue))));
	const groups = $derived([
		{ title: 'Spelling', items: shown.filter((issue) => issue.kind === 'spelling') },
		{ title: 'Grammar and usage', items: shown.filter((issue) => issue.kind === 'grammar') },
		{ title: 'Has a glossary entry', items: shown.filter((issue) => issue.kind === 'definition') },
		{ title: 'May need a definition', items: shown.filter((issue) => issue.kind === 'repeated') }
	]);

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
		if (linter) {
			const joined = joinBlocks(blocks);
			try {
				for (const issue of await checkText(linter, joined.text)) {
					const from = joined.position(issue.start);
					found.push({
						id: `${issue.spelling ? 'spelling' : 'grammar'}:${from}:${issue.problem}`,
						kind: issue.spelling ? 'spelling' : 'grammar',
						from,
						to: joined.position(issue.end),
						problem: issue.problem,
						message: issue.message,
						suggestions: issue.suggestions
					});
				}
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

<section class="checks" aria-label="Checks">
	<p class="small muted status" role="status" aria-live="polite">
		{#if loading}{loading}{:else if running}Checking…{:else}{shown.length === 0 ? 'Nothing found.' : `${shown.length} to look at.`}{/if}
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
	{#each groups as group (group.title)}
		{#if group.items.length > 0}
			<details open={group.items.length <= 25}>
				<summary>{group.title} ({group.items.length})</summary>
				<ul class="plain">
					{#each group.items as issue (issue.id)}
						<li id="check-{issue.id}" class:chosen={selected === issue.id}>
							<button type="button" class="issue" onclick={() => choose(issue)}>
								<strong>{issue.problem}</strong>
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

<style>
	.checks {
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		padding: var(--space-2) var(--space-3);
		margin: 0 0 var(--space-3);
		max-height: 24rem;
		overflow-y: auto;
		background: var(--color-surface);
	}

	.status {
		margin: 0 0 var(--space-2);
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
