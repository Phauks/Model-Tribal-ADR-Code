// Who is signed in and which workspace pages they may open, for the parts of
// every page that list them: the Workspace tab in the section bar
// (SectionBar.svelte) and the side column (SiteSidebar.svelte). The pages the
// Worker renders know at once (page.data.permissions, page.data.person); the
// pages built ahead of time wait for the signed-in hint, read in the browser
// (src/lib/signed-in-hint.ts).
import { page } from '$app/state';
import type { Permission } from './permissions.ts';
import { readSignedInHint } from './signed-in-hint.ts';
import { workspacePagesFor, workspacePagesNamed, type WorkspacePage } from './workspace-menu.ts';

export class WorkspaceAccess {
	#hintedNames = $state<string[]>([]);
	#hintedSignedIn = $state(false);

	constructor() {
		$effect(() => {
			const hint = readSignedInHint(document.cookie);
			this.#hintedNames = hint.workspacePageNames;
			this.#hintedSignedIn = hint.signedIn;
		});
	}

	/** The workspace pages to list, in menu order; empty for someone without workspace access. */
	readonly pages = $derived.by((): WorkspacePage[] => {
		const permissions = page.data.permissions as Permission[] | undefined;
		return permissions ? workspacePagesFor(permissions) : workspacePagesNamed(this.#hintedNames);
	});

	readonly signedIn = $derived(this.#hintedSignedIn || page.data.person !== undefined || page.data.email !== undefined);
}
