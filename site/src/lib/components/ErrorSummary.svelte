<script lang="ts">
	// The box at the top of a form that came back with problems, following the GOV.UK Design System's error summary: a "There is a problem" heading and a link to each field with a problem. It takes focus when it appears, so screen reader and keyboard users hear it first and can jump to the field (WCAG 2.2, 3.3.1 and 3.3.3). Each field also shows its own message above it, with "Error:" for screen readers (DESIGN.md, section 6, "Form errors").
	let { problems }: { problems: { field?: string; message: string }[] } = $props();

	function focusOnArrival(node: HTMLElement) {
		node.focus();
	}
</script>

{#if problems.length > 0}
	<div class="error-summary" role="alert" tabindex="-1" aria-labelledby="error-summary-title" {@attach focusOnArrival}>
		<h2 id="error-summary-title">There is a problem</h2>
		<ul>
			{#each problems as problem (problem.message)}
				<li>
					{#if problem.field}
						<a href="#{problem.field}">{problem.message}</a>
					{:else}
						{problem.message}
					{/if}
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.error-summary {
		border: 4px solid var(--color-danger);
		border-radius: var(--radius-control);
		padding: var(--space-3) var(--space-4);
		margin: var(--space-4) 0;
		max-width: var(--layout-measure);
	}

	h2 {
		font-size: var(--font-size-lead);
		margin: 0 0 var(--space-2);
	}

	ul {
		margin: 0;
		padding-left: var(--space-4);
	}

	a,
	a:visited {
		color: var(--color-danger);
		font-weight: var(--font-weight-semibold);
	}
</style>
