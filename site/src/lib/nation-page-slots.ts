/**
 * Fills the empty places on a nation's page (data-nation-slot) with what the
 * nation's team published, after a move within the site. On a full page load
 * the Worker has already filled them (tools/add-nation-page-changes.mjs);
 * after a move within the site the page was put together from the build, so
 * it asks the Worker for the same HTML. The HTML is written and escaped by
 * the server (src/lib/server/nation-page-overlay.ts).
 */
export async function fillNationSlots(nationIdentifier: string): Promise<void> {
	const slots = [...document.querySelectorAll<HTMLElement>('[data-nation-slot]')];
	// The page may reuse the places of the nation shown before.
	for (const slot of slots) slot.replaceChildren();
	const path = `/nations/${encodeURIComponent(nationIdentifier)}`;
	try {
		const response = await fetch(`${path}/changes.json`, { headers: { accept: 'application/json' } });
		if (!response.ok) return;
		const overlay = (await response.json()) as { slots?: Record<string, string> };
		// The reader may have moved on while the answer came.
		if (location.pathname.replace(/\/$/, '') !== path) return;
		for (const slot of slots) {
			const html = overlay.slots?.[slot.dataset.nationSlot ?? ''];
			if (html) slot.innerHTML = html;
		}
	} catch {
		// Offline or the Worker is busy: the page shows what the project cites.
	}
}
