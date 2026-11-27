/**
 * Fills the empty places on a nation's page (data-nation-slot) with what the
 * nation's team published, after a move within the site. On a full page load
 * the Worker has already filled them (tools/add-nation-page-changes.mjs);
 * after a move within the site the page was put together from the build, so
 * it asks the Worker for the same HTML. The HTML is written and escaped by
 * the server (src/lib/server/nation-page-overlay.ts).
 */
import { readPageRestrictions, type PageRestrictions } from './nation-restrictions.ts';
import { sendProblem } from './problem-reports.ts';

export async function fillNationSlots(nationIdentifier: string, pagePath = `/nations/${encodeURIComponent(nationIdentifier)}`): Promise<void> {
	const slots = [...document.querySelectorAll<HTMLElement>('[data-nation-slot]')];
	// The page may reuse the places of the nation shown before.
	for (const slot of slots) slot.replaceChildren();
	const path = `/nations/${encodeURIComponent(nationIdentifier)}`;
	try {
		const response = await fetch(`${path}/changes.json`, { headers: { accept: 'application/json' } });
		if (!response.ok) return;
		const overlay = (await response.json()) as { slots?: Record<string, string> };
		// The reader may have moved on while the answer came.
		if (location.pathname.replace(/\/$/, '') !== pagePath) return;
		for (const slot of slots) {
			const html = overlay.slots?.[slot.dataset.nationSlot ?? ''];
			if (html) slot.innerHTML = html;
		}
	} catch (problem) {
		// The page shows what the project cites; offline is only noted (sendProblem).
		sendProblem(problem, { code: 'nations.page-slots' });
	}
}

/**
 * What the nation chose the page shows of its laws and opinions, as the
 * Worker or fillNationSlots put it in the page (src/lib/nation-restrictions.ts).
 */
export function restrictionsInPage(): PageRestrictions {
	return readPageRestrictions(document.querySelector('script[data-nation-restrictions]')?.textContent);
}
