<script lang="ts">
	// The rolling row of sponsors on the home page (docs/sponsorship.md, "The
	// home page row"), built to match the mockup Trevor approved on Nov. 27,
	// 2026 (project files, design/home-sponsor-row/). Patrons show by name and
	// Benefactors by logo; the server picks who is in it.
	//
	// It is the one thing on the site that moves without the reader doing
	// anything (site/DESIGN.md, section 6, "Motion"), so: it rolls only when the
	// sponsors are too many to fit; it stops while the pointer is over it or a
	// tile has focus; a Pause button stops it for good (WCAG 2.2.2); and with
	// Reduce motion, set on the device or in Settings, it never moves and wraps
	// onto more lines instead. Its speed comes from the roll and steady motion
	// tokens. Without scripts the heading still links to the Sponsorship page.
	import { onMount } from 'svelte';
	import Building2 from '@lucide/svelte/icons/building-2';
	import Pause from '@lucide/svelte/icons/pause';
	import Play from '@lucide/svelte/icons/play';

	interface Tile {
		name: string;
		slug: string;
		logo: boolean;
	}

	let tiles = $state<Tile[] | null>(null);
	let paused = $state(false);
	let overflowing = $state(false);
	let viewport = $state<HTMLDivElement>();
	let firstSet = $state<HTMLUListElement>();

	onMount(() => {
		const controller = new AbortController();
		fetch('/sponsor/row.json', { signal: controller.signal })
			.then((response) => (response.ok ? response.json() : null))
			.then((answer: { sponsors?: Tile[] } | null) => {
				if (answer && Array.isArray(answer.sponsors)) tiles = answer.sponsors;
			})
			.catch(() => {
				// Without the list, the heading still links to the Sponsorship page.
			});
		return () => controller.abort();
	});

	// Rolls only when one copy of the tiles is wider than the space for them.
	$effect(() => {
		if (!viewport || !firstSet) return;
		const measure = () => {
			if (viewport && firstSet) overflowing = firstSet.scrollWidth > viewport.clientWidth + 1;
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(viewport);
		observer.observe(firstSet);
		return () => observer.disconnect();
	});
</script>

<!-- Logos load at once, not lazily: lazy ones could still be loading as they roll into view. -->
{#snippet tile(sponsor: Tile, copy: boolean)}
	<li>
		<a class="tile" class:logo={sponsor.logo} href="/sponsors/{sponsor.slug}" tabindex={copy ? -1 : undefined}>
			{#if sponsor.logo}
				<span class="plate"><img src="/sponsors/{sponsor.slug}/logo" alt={sponsor.name} /></span>
			{:else}
				{sponsor.name}
			{/if}
		</a>
	</li>
{/snippet}

<section class="sponsor-row" aria-labelledby="sponsor-row-heading">
	<div class="row-head">
		<h2 id="sponsor-row-heading"><a href="/sponsor">Thank you to our sponsors</a></h2>
		{#if tiles && tiles.length > 0 && overflowing}
			<button
				type="button"
				class="icon-button pause"
				aria-label={paused ? 'Play' : 'Pause'}
				title={paused ? 'Play' : 'Pause'}
				aria-pressed={paused}
				onclick={() => (paused = !paused)}
			>
				{#if paused}<Play aria-hidden="true" size={24} strokeWidth={1.75} />{:else}<Pause aria-hidden="true" size={24} strokeWidth={1.75} />{/if}
			</button>
		{/if}
	</div>
	{#if tiles && tiles.length > 0}
		<div class="viewport" class:rolling={overflowing} class:paused bind:this={viewport}>
			<div class="track" style="--sponsor-count: {tiles.length}">
				<ul class="set" bind:this={firstSet}>
					{#each tiles as sponsor (sponsor.slug)}{@render tile(sponsor, false)}{/each}
				</ul>
				{#if overflowing}
					<!-- A second copy, so the row loops without a gap; screen readers and the keyboard skip it. -->
					<ul class="set copy" aria-hidden="true" inert>
						{#each tiles as sponsor (sponsor.slug)}{@render tile(sponsor, true)}{/each}
					</ul>
				{/if}
			</div>
		</div>
	{:else if tiles}
		<ul class="set still">
			<li><a class="tile empty" href="/sponsor/levels"><Building2 aria-hidden="true" strokeWidth={1.75} />Your organization here</a></li>
		</ul>
	{/if}
</section>

<style>
	.sponsor-row {
		margin: var(--space-7) 0 var(--space-4);
	}

	.row-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		margin-bottom: var(--space-3);
	}

	.row-head h2 {
		margin: 0;
	}

	.viewport {
		overflow: hidden;
	}

	/* The ends fade while it rolls, so tiles slide in and out rather than being cut. */
	.viewport.rolling {
		mask-image: linear-gradient(90deg, transparent, black 3rem, black calc(100% - 3rem), transparent);
	}

	.track {
		display: flex;
		width: max-content;
	}

	.rolling .track {
		animation: sponsor-roll calc(var(--motion-duration-roll) * var(--sponsor-count)) var(--motion-easing-steady) infinite;
	}

	.viewport.paused .track,
	.viewport:hover .track,
	.viewport:focus-within .track {
		animation-play-state: paused;
	}

	/* Each copy carries the gap after it, so moving by half the track lines the copy up exactly where the first began. */
	@keyframes sponsor-roll {
		to {
			transform: translateX(-50%);
		}
	}

	.set {
		display: flex;
		gap: var(--space-4);
		margin: 0;
		padding: var(--space-1) var(--space-4) var(--space-1) 0;
		list-style: none;
	}

	.set li {
		margin: 0;
		padding: 0;
	}

	.tile {
		display: grid;
		place-items: center;
		height: 5.5rem;
		min-width: 11rem;
		padding: 0 var(--space-5);
		border: 1px solid var(--color-line);
		border-radius: 0.75rem;
		background: var(--color-surface);
		color: var(--color-ink);
		font-weight: var(--font-weight-bold);
		text-align: center;
		text-decoration: none;
		white-space: nowrap;
	}

	.tile:hover {
		border-color: var(--color-control-border);
	}

	.tile.logo {
		padding: 0 var(--space-3);
	}

	/* Logos are drawn for white paper, so they sit on a white plate in both themes. */
	.plate {
		display: grid;
		place-items: center;
		height: 4.25rem;
		padding: 0 var(--space-3);
		border-radius: 0.5rem;
		background: var(--color-sponsor-logo-plate);
	}

	.plate img {
		display: block;
		max-width: 11rem;
		max-height: 3.25rem;
	}

	.tile.empty {
		display: flex;
		gap: var(--space-2);
		min-width: 15rem;
		border: 1px dashed var(--color-control-border);
		background: transparent;
		color: var(--color-ink-muted);
		font-weight: var(--font-weight-regular);
	}

	/* With Reduce motion nothing rolls: the copy and the Pause button go, and the tiles wrap onto more lines. */
	@media (prefers-reduced-motion: reduce) {
		.copy,
		.pause {
			display: none;
		}

		.viewport.rolling {
			mask-image: none;
		}

		.track,
		.set {
			flex-wrap: wrap;
			width: auto;
		}
	}

	:global(:root[data-motion='reduce']) .copy,
	:global(:root[data-motion='reduce']) .pause {
		display: none;
	}

	:global(:root[data-motion='reduce']) .viewport.rolling {
		mask-image: none;
	}

	:global(:root[data-motion='reduce']) .track,
	:global(:root[data-motion='reduce']) .set {
		flex-wrap: wrap;
		width: auto;
	}

	@media (max-width: 48rem) {
		.sponsor-row {
			margin-top: var(--space-6);
		}

		/* One line on a phone, as in the approved mockup. */
		.row-head h2 {
			font-size: var(--font-size-heading-3);
		}

		.tile {
			height: 4.5rem;
			min-width: 9rem;
			padding: 0 var(--space-4);
			font-size: var(--font-size-small);
		}

		.plate {
			height: 3.5rem;
		}

		.plate img {
			max-width: 9rem;
			max-height: 2.75rem;
		}
	}

	@media print {
		.sponsor-row {
			display: none;
		}
	}
</style>
