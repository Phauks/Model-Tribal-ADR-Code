<script lang="ts">
	// The one box that tells a reader something failed (site/ERRORS.md; mockups 1, 3, 4 and 6
	// in project files design/error-framework/, approved by Trevor on Nov. 27, 2026). It keeps
	// the frame of what failed, says so in a line, and offers Try again and Report, with the
	// reference the log line carries.
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Copy from '@lucide/svelte/icons/copy';
	import Flag from '@lucide/svelte/icons/flag';
	import RotateCw from '@lucide/svelte/icons/rotate-cw';
	import X from '@lucide/svelte/icons/x';
	import { copyText } from '#lib/clipboard.ts';
	import { openReport, reportLink, type ReportPreset } from '#lib/report-request.ts';

	let {
		title,
		line,
		reference,
		report,
		onretry,
		ondismiss,
		size = 'section',
		headingLevel = 2
	}: {
		/** What failed, such as "Map failed to load". */
		title: string;
		/** One line on what to do. */
		line?: string;
		/** The reference the report was logged with, such as P-4F7K-92QD. */
		reference?: string;
		/** What Report fills in; no Report button when left out. */
		report?: ReportPreset;
		/** Tries again; no Try again button when left out. */
		onretry?: () => void;
		/** For a toast: closes it. */
		ondismiss?: () => void;
		/** section fills the frame of what failed; small is the same in a narrow panel; toast floats at the corner. */
		size?: 'section' | 'small' | 'toast';
		headingLevel?: 2 | 3 | 4;
	} = $props();

	let copied = $state(false);

	async function copyReference(): Promise<void> {
		if (!reference) return;
		try {
			await copyText(reference);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// expected: the reference stays on screen to copy by hand when the browser refuses.
		}
	}

	function reportClicked(event: MouseEvent): void {
		if (!report) return;
		event.preventDefault();
		openReport({ ...report, details: [report.details, reference ? `Reference ${reference}` : ''].filter(Boolean).join('\n') });
	}
</script>

<div class="problem-notice {size} no-print" role="alert">
	<div class="body">
		<svelte:element this={`h${headingLevel}`} class="title">
			<CircleAlert size={size === 'section' ? 22 : 20} aria-hidden="true" />
			<span>{title}</span>
		</svelte:element>
		{#if line}<p>{line}</p>{/if}
		{#if onretry || report}
			<div class="actions">
				{#if onretry}
					<button class="button" type="button" onclick={onretry}><RotateCw size={18} aria-hidden="true" />Try again</button>
				{/if}
				{#if report}
					<a class="button button-quiet" href={reportLink(report)} onclick={reportClicked}><Flag size={18} aria-hidden="true" />Report</a>
				{/if}
			</div>
		{/if}
		{#if reference}
			<div class="reference">
				Reference <code>{reference}</code>
				<button class="icon-button" type="button" aria-label={copied ? 'Reference copied' : 'Copy the reference'} title={copied ? 'Copied' : 'Copy the reference'} onclick={copyReference}><Copy size={16} aria-hidden="true" /></button>
			</div>
		{/if}
	</div>
	{#if size === 'toast' && ondismiss}
		<button class="icon-button close" type="button" aria-label="Close" title="Close" onclick={ondismiss}><X size={20} aria-hidden="true" /></button>
	{/if}
</div>

<style>
	.problem-notice {
		color: var(--color-ink);
		font-size: 1rem;
		line-height: 1.5;
	}

	.title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		font-size: 1.25rem;
		font-weight: 700;
	}

	.title :global(svg) {
		flex: none;
		color: var(--color-danger);
	}

	p {
		margin: 0.35rem 0 0;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.actions .button {
		gap: 0.5rem;
	}

	.reference {
		display: inline-flex;
		align-items: center;
		gap: 0.15rem;
		margin-top: 0.75rem;
		font-size: 0.875rem;
		color: var(--color-ink-muted);
	}

	.reference code {
		font-family: inherit;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.02em;
	}

	.reference .icon-button {
		min-width: 32px;
		min-height: 32px;
	}

	/* Keeps the frame of what failed (style A). */
	.section,
	.small {
		display: grid;
		place-items: center;
		height: 100%;
		min-height: 16rem;
		padding: 2rem;
		text-align: center;
		background: var(--color-surface);
		border: 1px dashed var(--color-control-border);
		border-radius: var(--radius-control);
	}

	.section .title,
	.small .title,
	.section .actions,
	.small .actions {
		justify-content: center;
	}

	.small {
		min-height: 12rem;
		padding: 1.25rem;
	}

	.small .title,
	.toast .title {
		font-size: 1rem;
	}

	.toast {
		position: fixed;
		right: 1.5rem;
		bottom: 1.5rem;
		z-index: 99;
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.25rem 0.5rem;
		align-items: start;
		max-width: 26rem;
		padding: 0.75rem 0.5rem 0.75rem 1rem;
		background: var(--color-paper);
		border: 1px solid var(--color-control-border);
		border-left: 6px solid var(--color-danger);
		border-radius: var(--radius-control);
		box-shadow: 0 var(--space-2) var(--space-5) color-mix(in srgb, var(--color-ink) 25%, transparent);
	}

	.toast .actions {
		margin-top: 0.5rem;
	}

	.toast .button {
		min-height: 40px;
		padding: 0.25rem 0.9rem;
	}

	@media (max-width: 40rem) {
		.toast {
			left: 1rem;
			right: 1rem;
			bottom: 1rem;
			max-width: none;
		}

		.section {
			min-height: 20rem;
		}
	}
</style>
