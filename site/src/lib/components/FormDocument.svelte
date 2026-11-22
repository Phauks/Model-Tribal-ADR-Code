<script lang="ts">
	// A form's text with its fields (src/lib/forms.ts): fields to fill in
	// online, boxes and lines to fill in by hand, or the answers given. The
	// HTML is built from the form's Markdown file, with every answer escaped.
	let { html, mode }: { html: string; mode: 'online' | 'blank' | 'filled' } = $props();
</script>

<div class="form-document form-{mode}">
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- built from the repository's form files; answers are escaped -->
	{@html html}
</div>

<style>
	.form-document :global(table) {
		width: 100%;
		border-collapse: collapse;
	}

	.form-document :global(.form-wide-table) {
		max-width: 100%;
		overflow-x: auto;
		margin-bottom: var(--space-4);
	}

	.form-document :global(th),
	.form-document :global(td) {
		border: 1px solid var(--color-line);
		padding: var(--space-2);
		vertical-align: top;
		min-width: 6em;
	}

	/* A table of labels and answers has no header of its own. */
	.form-document :global(thead:has(th:empty)) {
		display: none;
	}

	.form-document :global(td .form-blank),
	.form-document :global(td .form-line) {
		width: 100%;
		min-width: 10em;
	}

	.form-document :global(.form-check) {
		width: 1.25em;
		height: 1.25em;
		margin: 0 0.2em 0 0;
		vertical-align: -0.2em;
		accent-color: var(--color-action);
	}

	.form-document :global(.form-blank) {
		display: inline-block;
		box-sizing: border-box;
		width: min(20em, 100%);
		padding: 0.15em 0.3em;
		font: inherit;
		color: inherit;
		background: var(--color-paper);
		border: 0;
		border-bottom: 2px solid var(--color-control-border);
		border-radius: 0;
	}

	.form-document :global(.form-date) {
		width: auto;
	}

	.form-document :global(.form-signature) {
		font-style: italic;
		font-size: 1.1em;
	}

	.form-document :global(.form-area) {
		display: block;
		box-sizing: border-box;
		width: 100%;
		font: inherit;
		padding: var(--space-2);
		border: 2px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		color: inherit;
	}

	.form-document :global(.form-line) {
		display: inline-block;
		min-width: 12em;
		height: 1.2em;
		border-bottom: 1px solid currentColor;
		vertical-align: bottom;
	}

	.form-document :global(.form-area-line) {
		display: block;
		height: 6em;
		border: 1px solid currentColor;
	}

	.form-document :global(.form-mark) {
		font-size: 1.15em;
	}

	.form-document :global(.form-answer) {
		padding: 0 0.3em;
		border-bottom: 1px solid currentColor;
		font-weight: var(--font-weight-semibold);
	}

	.form-document :global(.form-answer-long) {
		display: block;
		white-space: pre-wrap;
		border: 1px solid var(--color-line);
		padding: var(--space-2);
	}

	/* The project's own lines are not asked online. */
	.form-online :global(.form-project-use) {
		display: none;
	}

	.form-online :global(.form-project-line) {
		min-width: 6em;
		border-bottom-style: dotted;
	}

	@media print {
		.form-document :global(.form-blank),
		.form-document :global(.form-area) {
			border: 0;
			border-bottom: 1px solid currentColor;
			background: none;
		}

		.form-document :global(.form-check) {
			appearance: auto;
		}

		.form-document :global(h2) {
			break-after: avoid;
		}

		.form-document :global(table),
		.form-document :global(li) {
			break-inside: avoid;
		}

		/* Paper cannot scroll, so a wide table fits the page. */
		.form-document :global(.form-wide-table) {
			overflow: visible;
		}

		.form-document :global(th),
		.form-document :global(td) {
			min-width: 0;
		}

		.form-document :global(td .form-line) {
			min-width: 0;
		}
	}
</style>
