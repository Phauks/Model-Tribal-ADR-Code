<script lang="ts">
	// "Show the note under the paragraph" (site/DESIGN.md, section 6,
	// "Citations"). With that setting, selecting a note number opens a copy of
	// the note right under the paragraph instead of jumping to the notes at
	// the end; selecting it again closes it. Markers point to their entry in
	// the Sources section (src/lib/components/SourceList.svelte), which is
	// shown without the facts it supports. The number stays a link to the
	// note, so without scripts, or with the default setting, it jumps as before.
	import { onMount } from 'svelte';
	import { noteBlock, noteCopy } from '#lib/note-copies.ts';

	function toggle(marker: HTMLAnchorElement): void {
		const openId = marker.getAttribute('aria-controls');
		if (openId) {
			document.getElementById(openId)?.remove();
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
