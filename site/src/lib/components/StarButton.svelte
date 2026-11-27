<script lang="ts">
	// The Star button (site/DESIGN.md, section 6, "Star"). An icon button in
	// the masthead, before Print, on a page a reader can star: a nation, a
	// glossary entry, a story and, later, sections of the code, essays, forms
	// and sources (src/lib/starred-items.ts). It is a toggle button
	// (aria-pressed), so its name stays "Star this page"; a filled star shows
	// a starred page, and a status message says what changed. Stars are kept
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
				? 'Starred. Your starred pages are listed under Starred pages, in the Library menu.'
				: 'This browser is not keeping data for this site, so the star lasts only while this page is open.';
			if (!kept) starred = [...starred, address];
		}
	}
</script>

{#if starrable}
	<button
		class="icon-button needs-scripts"
		type="button"
		aria-pressed={pressed}
		aria-label="Star this page"
		title={pressed ? 'Starred. Press to remove the star' : 'Star this page'}
		onclick={toggle}
	>
		<Star size={24} fill={pressed ? 'currentColor' : 'none'} />
	</button>
	<span class="visually-hidden" role="status">{message}</span>
{/if}
