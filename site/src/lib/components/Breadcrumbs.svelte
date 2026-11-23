<script lang="ts" module>
	/** One page above the current one: its name and its address. */
	export interface Crumb {
		label: string;
		href: string;
	}
</script>

<script lang="ts">
	// The trail above a page's title, on every page that sits inside another
	// (Trevor chose it on Nov. 23, 2026: the "eyebrow" mockup with a back arrow;
	// site/DESIGN.md, Breadcrumbs). It lists only the pages above this one, since
	// the title right under it names this one. The arrow goes back up one level.
	// On phones only the arrow and the page just above show, since the section
	// already shows in the menu bar. No page draws its own trail
	// (tests/breadcrumbs.test.ts).
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';

	let { trail }: { trail: Crumb[] } = $props();
	const parent = $derived(trail.at(-1));
</script>

{#if parent}
	<nav aria-label="Breadcrumb" class="breadcrumbs no-print">
		<a class="icon-button back" href={parent.href} aria-label="Back to {parent.label}" title="Back to {parent.label}"
			><ArrowLeft size={20} aria-hidden="true" /></a
		>
		<ol>
			{#each trail as crumb, index (index)}
				<li class:parent={crumb === parent}>
					<a href={crumb.href}>{crumb.label}</a>{#if crumb !== parent}<span class="separator" aria-hidden="true">/</span>{/if}
				</li>
			{/each}
		</ol>
	</nav>
{/if}

<style>
	.breadcrumbs {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		/* The title's letters sit about 0.375rem under the trail's, as in the
		   approved mockup: this takes back all but 0.25rem of the title's own top
		   margin (space 5), whether or not the title is the trail's next sibling.
		   The line box below is 0.125rem taller than the text on each side. */
		margin: -0.125rem 0 calc(var(--space-5) * -1 + 0.25rem) calc(var(--space-3) * -1);
	}

	.back {
		flex: none;
		/* A 44 px target that does not make the trail taller than its line. */
		margin-block: -0.75rem;
		color: var(--color-link);
	}

	ol {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0 var(--space-2);
		margin: 0;
		padding: 0 0 0 calc(var(--space-2) + 2px);
		border-left: 3px solid var(--color-action);
		list-style: none;
		font-size: 0.8125rem;
		font-weight: 650;
		letter-spacing: 0.07em;
		/* Each link is a full 24 px tall, the smallest target WCAG 2.5.8 allows,
		   so a trail that wraps onto two lines still passes. */
		line-height: 1.5rem;
		text-transform: uppercase;
	}

	li {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}

	a {
		color: var(--color-link);
		text-decoration: none;
	}

	ol a:hover {
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.separator {
		color: var(--color-ink-muted);
		font-weight: 400;
		opacity: 0.5;
	}

	@media (max-width: 40rem) {
		li:not(.parent) {
			display: none;
		}
	}

	@media (forced-colors: active) {
		ol {
			border-left-color: CanvasText;
		}
	}
</style>
