/**
 * Opens the full Settings dialog from anywhere on the page (site/DESIGN.md,
 * section 6, "Settings"). The dialog lives in the masthead, behind the cog's
 * Page settings popover (PageSettings.svelte), which registers it here; a
 * page such as Your data opens it at a given section without clicking
 * through the popover.
 */

export type SettingsSection = 'text' | 'colors' | 'motion' | 'citations' | 'glossary' | 'editing' | 'device';

type Opener = (section?: SettingsSection, returnTo?: HTMLElement | null) => void;

let registered: Opener | undefined;

/** Called by the dialog when it mounts; the returned function unregisters it. */
export function registerSettingsDialog(open: Opener): () => void {
	registered = open;
	return () => {
		if (registered === open) registered = undefined;
	};
}

/** Opens Settings at a section (Text when none is given); focus goes back to `returnTo`, or to what had it, when it closes. */
export function openSettings(section?: SettingsSection, returnTo?: HTMLElement | null): void {
	registered?.(section, returnTo);
}
