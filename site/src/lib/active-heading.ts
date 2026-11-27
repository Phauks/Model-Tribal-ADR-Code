/**
 * Follows which heading of the page is being read, for the sidebar's outline
 * (SiteSidebar.svelte): the heading nearest above the top third of the
 * screen, by position, so a heading in a side column is not marked early. It
 * measures at most once a frame.
 */
export function followActiveHeading(ids: string[], onchange: (id: string) => void): () => void {
	const headings = ids
		.map((id) => document.getElementById(id))
		.filter((element): element is HTMLElement => element !== null);
	if (headings.length === 0) return () => {};
	let frame = 0;
	let last: string | undefined;
	const measure = () => {
		frame = 0;
		let current = headings[0];
		let nearest = -Infinity;
		if (window.scrollY > 40) {
			for (const heading of headings) {
				const top = heading.getBoundingClientRect().top;
				if (top < window.innerHeight * 0.3 && top > nearest) {
					nearest = top;
					current = heading;
				}
			}
		}
		if (current.id !== last) {
			last = current.id;
			onchange(current.id);
		}
	};
	const schedule = () => {
		if (!frame) frame = requestAnimationFrame(measure);
	};
	measure();
	window.addEventListener('scroll', schedule, { passive: true });
	window.addEventListener('resize', schedule);
	return () => {
		cancelAnimationFrame(frame);
		window.removeEventListener('scroll', schedule);
		window.removeEventListener('resize', schedule);
	};
}

/** The ids of the headings an outline links to (#id), at every level. */
export function headingIds(items: { link: string; children?: { link: string; children?: unknown[] }[] }[]): string[] {
	return items.flatMap((item) => [
		...(item.link.startsWith('#') ? [item.link.slice(1)] : []),
		...headingIds((item.children ?? []) as { link: string; children?: { link: string }[] }[])
	]);
}
