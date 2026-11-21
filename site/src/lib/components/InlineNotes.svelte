<script lang="ts">
	// "Show the note under the paragraph" (site/DESIGN.md, section 6,
	// "Citations"). With that setting, selecting a note number opens a copy of
	// the note right under the paragraph instead of jumping to the notes at
	// the end; selecting it again closes it. Markers point to their entry in
	// the Sources section (src/lib/components/SourceList.svelte), which is
	// shown without the facts it supports. The number stays a link to the
	// note, so without scripts, or with the default setting, it jumps as before.
	import { onMount } from 'svelte';

	function noteBlock(marker: Element): Element | null {
		return marker.closest('p, li, dd, blockquote, td');
	}

	function toggle(marker: HTMLAnchorElement): void {
		const openId = marker.getAttribute('aria-controls');
		if (openId) {
			document.getElementById(openId)?.remove();
			marker.removeAttribute('aria-controls');
			marker.setAttribute('aria-expanded', 'false');
			return;
		}
		const number = marker.textContent?.trim() ?? '';
		const entry = marker.hash ? document.getElementById(decodeURIComponent(marker.hash.slice(1))) : null;
		const block = noteBlock(marker);
		if (!entry || !block) return;
		// The entry in the Sources section, without the list of facts it supports.
		const note = entry.cloneNode(true) as Element;
		note.querySelector('.source-uses')?.remove();
		const shown = document.createElement('div');
		shown.className = 'inline-note';
		shown.id = `inline-note-${number}-${Math.random().toString(36).slice(2, 8)}`;
		shown.setAttribute('role', 'note');
		shown.setAttribute('aria-label', `Note ${number}`);
		shown.innerHTML = `<p>${number}. ${note.innerHTML.trim()}</p>`;
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
		document.addEventListener('click', onClick);
		return () => document.removeEventListener('click', onClick);
	});
</script>
