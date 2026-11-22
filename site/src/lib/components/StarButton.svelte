<script lang="ts">
	// The Star button (site/DESIGN.md, section 6, "Star"). It sits in the
	// masthead's menu row, before Print, on a page a reader can star: a
	// nation, a glossary entry, a story and, later, sections of the code,
	// essays, forms and sources (src/lib/starred-items.ts). It is a toggle
	// button (aria-pressed), so its name stays "Star"; a filled star shows a
	// starred page, and a status message says what changed. Stars are kept
	// on this device only. Without scripts the button is hidden.
	import { page } from '$app/state';
	import Star from '@lucide/svelte/icons/star';
	import { onMount } from 'svelte';
	import {
		addStarred,
		loadStarred,
		onStarredChange,
		removeStarred,
		saveStarred,
		starredKindOf
	} from '#lib/starred-items.ts';

	const address = $derived(page.url.pathname);
	const starrable = $derived(starredKindOf(address) !== undefined);
	let starred = $state<string[]>([]);
	let message = $state('');
	const pressed = $derived(starred.includes(address));

	onMount(() => {
		const refresh = () => {
			starred = loadStarred().map((item) => item.address);
		};
		refresh();
		return onStarredChange(refresh);
	});

	// A new page starts with no message.
	$effect(() => {
		void address;
		message = '';
	});

	/** The page's own heading names it best; the window title is the fallback. */
	function pageTitle(): string {
		const heading = document.querySelector('#main-content h1')?.textContent?.trim();
		return heading || document.title.split(' · ')[0];
	}

	function toggle(): void {
		const items = loadStarred();
		if (pressed) {
			saveStarred(removeStarred(items, address));
			message = 'Star removed.';
		} else {
			const kept = saveStarred(addStarred(items, address, pageTitle()));
			message = kept
				? 'Starred. Your starred pages are on the Starred page, under the star at the top.'
				: 'This browser is not keeping data for this site, so the star lasts only while this page is open.';
			if (!kept) starred = [...starred, address];
		}
	}
</script>

{#if starrable}
	<button class="star-button needs-scripts" type="button" aria-pressed={pressed} onclick={toggle}>
		<Star size={20} strokeWidth={1.75} fill={pressed ? 'currentColor' : 'none'} />
		<span>Star</span>
	</button>
	<span class="visually-hidden" role="status">{message}</span>
{/if}

<style>
	/* Matches the Print button beside it (PrintOptions.svelte). */
	.star-button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-band-text);
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--color-band-text);
		font: inherit;
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
	}

	.star-button:hover {
		text-decoration: underline;
	}

	/* Pressed has a second cue besides the filled star: a heavier border. */
	.star-button[aria-pressed='true'] {
		border-width: 2px;
		padding: 0 calc(var(--space-3) - 1px);
	}
</style>
