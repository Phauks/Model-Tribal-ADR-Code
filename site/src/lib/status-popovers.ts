/**
 * Closes a page's status badges' panels (details.status-popover, such as
 * ReviewStatus.svelte and StubBadge.svelte) on a click elsewhere or on
 * Escape, which puts focus back on the badge. Returns the function that
 * stops listening, for a component's onMount.
 */
export function closeStatusPopovers(): () => void {
	const close = (except?: EventTarget | null) => {
		for (const open of document.querySelectorAll<HTMLDetailsElement>('details.status-popover[open]')) {
			if (!(except instanceof Node && open.contains(except))) open.open = false;
		}
	};
	const onClick = (event: MouseEvent) => close(event.target);
	const onKey = (event: KeyboardEvent) => {
		if (event.key !== 'Escape') return;
		const open = document.querySelector<HTMLDetailsElement>('details.status-popover[open]');
		if (!open) return;
		open.open = false;
		open.querySelector('summary')?.focus();
	};
	document.addEventListener('click', onClick);
	document.addEventListener('keydown', onKey);
	return () => {
		document.removeEventListener('click', onClick);
		document.removeEventListener('keydown', onKey);
	};
}
