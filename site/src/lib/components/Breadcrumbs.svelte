<script lang="ts" module>
	/** One page above the current one: its name and its address. */
	export interface Crumb {
		label: string;
		href: string;
	}
</script>

<script lang="ts">
	// The trail above a page's title, on every page that sits inside another
	// (Trevor chose the "plain trail" mockup on Nov. 27, 2026, in place of the
	// eyebrow of Nov. 23; site/DESIGN.md, Breadcrumbs). It lists the pages above
	// this one, then this page's own name, in small muted type with a chevron
	// between them, on one line. Names are cut short with "…" only when the
	// line runs out of room, each name giving way in proportion to its
	// length, and a cut name shows whole on hover (Trevor, Nov. 27, 2026: no "…"
	// "unless it runs out of space to the right"). On phones only a link back to the page just above shows, since the
	// menu bar already names the section. No page draws its own trail
	// (tests/breadcrumbs.test.ts).
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	let { trail, current }: { trail: Crumb[]; current: string } = $props();
	const parent = $derived(trail.at(-1));
</script>

{#if parent}
	<nav aria-label="Breadcrumb" class="breadcrumbs no-print">
		<ol class="trail">
			{#each trail as crumb, index (index)}
				<li>
					<a href={crumb.href} title={crumb.label}>{crumb.label}</a><ChevronRight size={14} aria-hidden="true" />
				</li>
			{/each}
			<li><span class="current" aria-current="page" title={current}>{current}</span></li>
		</ol>
		<a class="up" href={parent.href}><ChevronLeft size={18} aria-hidden="true" /><span>{parent.label}</span></a>
	</nav>
{/if}

<style>
	.breadcrumbs {
		/* The title sits half a line under the trail: this takes back all but
		   0.5rem of the title's own top margin (space 5), as in the approved
		   mockup. */
		margin: 0 0 calc(var(--space-5) * -1 + 0.5rem);
	}

	.trail {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		min-width: 0;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.875rem;
		/* Each link is a full 24 px tall, the smallest target WCAG 2.5.8 allows. */
		line-height: 1.5rem;
		color: var(--color-ink-muted);
	}

	li {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		min-width: 0;
		white-space: nowrap;
	}

	li :global(svg) {
		flex: none;
		opacity: 0.6;
	}

	.trail a,
	.current {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.trail a {
		color: var(--color-ink-muted);
		text-decoration: underline;
		text-decoration-color: color-mix(in srgb, currentColor 35%, transparent);
		text-underline-offset: 0.2em;
	}

	.trail a:hover {
		color: var(--color-link);
	}

	.current {
		color: var(--color-ink);
	}

	.up {
		display: none;
		align-items: center;
		gap: 0.375rem;
		width: fit-content;
		max-width: 100%;
		font-size: 0.9375rem;
		line-height: 1.5rem;
		color: var(--color-link);
		text-decoration: none;
	}

	.up :global(svg) {
		flex: none;
	}

	.up span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-decoration: underline;
		text-decoration-color: color-mix(in srgb, currentColor 40%, transparent);
		text-underline-offset: 0.2em;
	}

	@media (max-width: 40rem) {
		.trail {
			display: none;
		}

		.up {
			display: flex;
		}
	}
</style>
