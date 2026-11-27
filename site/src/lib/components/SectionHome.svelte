<script lang="ts">
	// A section's own page, for the sections with nothing else to show there
	// (Federal Law, Courts and Cases, Library and Writing): the section's
	// pages in the groups of its menu, each a tile with the menu's icon and
	// count, so the page and the menu never disagree (src/lib/site-navigation.ts).
	// The section's name in the section bar and the phone Menu sheet links here
	// (Trevor, Nov. 27, 2026: no "All of …" link; every section has a home).
	import { navigationIcons } from '#lib/navigation-icons.ts';
	import type { NavigationCounts, NavigationSection } from '#lib/site-navigation.ts';
	import CountBadge from './CountBadge.svelte';

	let { section, counts }: { section: NavigationSection; counts?: NavigationCounts } = $props();
</script>

<div class="section-home">
	<h1>{section.title ?? section.label}</h1>
	{#each section.groups as group (group.title)}
		<section class="home-group" aria-labelledby="group-{section.key}-{group.title}">
			<h2 class="group-title" id="group-{section.key}-{group.title}">{group.title}</h2>
			<ul class="tiles">
				{#each group.links as item (item.link)}
					{@const Icon = navigationIcons[item.icon]}
					<li>
						{#if item.soon}
							<span class="tile soon"
								><span class="icon"><Icon size={20} aria-hidden="true" /></span><span class="tile-label">{item.label} <span class="soon-note">soon</span></span></span
							>
						{:else}
							<a class="tile" href={item.link}
								><span class="icon"><Icon size={20} aria-hidden="true" /></span><span class="tile-label">{item.label}</span
								>{#if item.count && counts?.[item.count]}<CountBadge count={counts[item.count]} />{/if}</a
							>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>

<style>
	.section-home {
		max-width: var(--layout-measure);
	}

	.home-group {
		margin-top: var(--space-5);
	}

	/* The group's name, as the menu gives it: small capitals over a rule. */
	.group-title {
		margin: 0 0 var(--space-3);
		padding-bottom: 0.55rem;
		border-bottom: 1px solid var(--color-line);
		font-size: 0.75rem;
		font-weight: var(--font-weight-bold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-ink-muted);
	}

	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr));
		gap: var(--space-3);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* A page of the section: its icon, its name and its count, the whole tile a link. */
	.tile {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		height: 100%;
		box-sizing: border-box;
		padding: 0.8rem 0.9rem;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
		text-decoration: none;
	}

	.icon {
		display: grid;
		flex: none;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: var(--radius-control);
		background: var(--color-surface);
		color: var(--color-link);
	}

	/* A long name wraps between words, never inside one, and its count keeps its own room. */
	.tile-label {
		flex: 1;
		min-width: 0;
		overflow-wrap: normal;
		word-break: normal;
	}

	.tile :global(.count-badge) {
		flex: none;
		margin-left: auto;
	}

	a.tile:hover {
		border-color: var(--color-link);
		color: var(--color-link);
	}

	a.tile:focus-visible {
		outline: 3px solid var(--color-focus-ring);
		outline-offset: 2px;
		background: var(--color-focus);
		color: var(--focus-text);
	}

	/* Not published yet: named, not linked. */
	.soon,
	.soon .icon {
		color: var(--color-ink-muted);
	}

	.soon {
		border-style: dashed;
		background: none;
	}

	.soon-note {
		font-size: var(--font-size-small);
		font-style: italic;
		font-weight: var(--font-weight-regular);
	}
</style>
