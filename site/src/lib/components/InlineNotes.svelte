<script lang="ts">
	// "Show the note under the paragraph" (site/DESIGN.md, section 6,
	// "Citations"). With that setting, selecting a note number opens a copy of
	// the note right under the paragraph instead of a window beside the
	// number (CitationPopup.svelte); selecting it again closes it. The copy is
	// the source's entry in the Sources section (SourceList.svelte) without
	// the facts it supports. The number stays a link to the entry, so without
	// scripts it goes to the Sources list.
	import { onMount } from 'svelte';
	import { noteBlock, noteCopy } from '#lib/note-copies.ts';

	function toggle(marker: HTMLAnchorElement): void {
		const openIdentifier = marker.getAttribute('aria-controls');
		if (openIdentifier) {
			document.getElementById(openIdentifier)?.remove();
			marker.removeAttribute('aria-controls');
			marker.setAttribute('aria-expanded', 'false');
			return;
		}
		const block = noteBlock(marker);
		const shown = noteCopy(marker, 'inline-note');
		if (!shown || !block) return;
		block.after(shown);
		marker.setAttribute('aria-controls', shown.id);
		marker.setAttribute('aria-expanded', 'true');
	}

	onMount(() => {
		const onClick = (event: MouseEvent) => {
			if (document.documentElement.dataset.noteDisplay !== 'inline') return;
			if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
			const marker = (event.target as Element | null)?.closest?.('a.note-marker');
			if (!(marker instanceof HTMLAnchorElement)) return;
			event.preventDefault();
			toggle(marker);
		};
		// Capture, so this runs before the router's own link handling, which
		// would otherwise treat the note as already visited.
		document.addEventListener('click', onClick, true);
		return () => document.removeEventListener('click', onClick, true);
	});
</script>
