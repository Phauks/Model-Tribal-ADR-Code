<script lang="ts">
	// The masthead's sign-in control, at its far right (site/DESIGN.md,
	// section 6, "Masthead"). Pages are built ahead of time, so they show
	// "Sign in" until the browser reads the signed-in hint
	// (src/lib/signed-in-hint.ts). Once someone has signed in, a profile button
	// takes its place (Trevor asked for this on Nov. 22, 2026). It opens a
	// short list, following the WAI-ARIA disclosure pattern rather than a
	// menu, since the items are plain links and a form: who is signed in, Your
	// profile, Workspace (for people with workspace access), Password and Sign
	// out. Trevor asked on Nov. 22, 2026 for "Signed in as" and Sign out to
	// live here rather than across the top of the workspace and profile pages.
	//
	// The workspace and profile pages know who is signed in; they keep the name
	// on this device (localStorage), so the pages built ahead of time can show
	// it too. Signing out forgets it. Without scripts the link stays "Sign in",
	// which still works: a signed-in person who follows it is told so there.
	// Nobody needs to sign in to read the site or to make a request.
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import LogIn from '@lucide/svelte/icons/log-in';
	import LogOut from '@lucide/svelte/icons/log-out';
	import UserRound from '@lucide/svelte/icons/user-round';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import { roleLabels, type Role } from '#lib/permissions.ts';
	import { readSignedInHint } from '#lib/signed-in-hint.ts';
	import { forgetLocalDrafts } from '#lib/essays/local-draft.ts';

	interface SignedInAs {
		name: string;
		/** How the person takes part, such as "lead author"; empty without workspace access. */
		role: string;
	}

	const nameStorageKey = 'signed-in-as';

	let hintSignedIn = $state(false);
	let hintHasWorkspace = $state(false);
	let remembered = $state<SignedInAs | undefined>(undefined);
	let open = $state(false);
	let container: HTMLDivElement | undefined = $state();
	let button: HTMLButtonElement | undefined = $state();

	// Who the page itself says is signed in: the workspace's pages name the
	// person and their role, the profile pages give the email address.
	const fromPage = $derived.by((): SignedInAs | undefined => {
		const person = page.data.person as { displayName: string; role: Role } | undefined;
		if (person) return { name: person.displayName, role: roleLabels[person.role].toLocaleLowerCase('en-US') };
		const email = page.data.email as string | undefined;
		if (email && page.url.pathname.startsWith('/profile')) return { name: email, role: '' };
		return undefined;
	});
	const signedInAs = $derived(fromPage ?? remembered);
	// The pages the Worker renders know at once; the others wait for the hint.
	const signedIn = $derived(hintSignedIn || fromPage !== undefined);
	const hasWorkspace = $derived(hintHasWorkspace || page.data.person !== undefined);

	onMount(() => {
		const hint = readSignedInHint(document.cookie);
		hintSignedIn = hint.signedIn;
		hintHasWorkspace = hint.workspacePageNames.length > 0;
		try {
			if (fromPage) localStorage.setItem(nameStorageKey, JSON.stringify(fromPage));
			else if (!signedIn) {
				localStorage.removeItem(nameStorageKey);
				// Unsaved essay text kept by the editor (local-draft.ts) does not outlast the sign-in.
				if (!location.pathname.startsWith('/sign-in')) forgetLocalDrafts();
			}
			else {
				const stored = JSON.parse(localStorage.getItem(nameStorageKey) ?? 'null') as SignedInAs | null;
				if (stored && typeof stored.name === 'string') remembered = { name: stored.name, role: String(stored.role ?? '') };
			}
		} catch {
			// Storage can be blocked; the menu then says only that someone is signed in.
		}
	});

	function forgetName() {
		try {
			localStorage.removeItem(nameStorageKey);
		} catch {
			// Nothing was kept.
		}
		forgetLocalDrafts();
	}

	function closeOnOutside(event: FocusEvent | MouseEvent) {
		const target = (event instanceof FocusEvent ? event.relatedTarget : event.target) as Node | null;
		if (open && container && target && !container.contains(target)) open = false;
	}

	function closeOnEscape(event: KeyboardEvent) {
		if (open && event.key === 'Escape') {
			open = false;
			button?.focus();
		}
	}
</script>

<svelte:document onclick={closeOnOutside} />

{#if signedIn}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="account" bind:this={container} onfocusout={closeOnOutside} onkeydown={closeOnEscape}>
		<button
			bind:this={button}
			class="icon-button account-button"
			type="button"
			aria-expanded={open}
			aria-controls="account-links"
			aria-label="Your account"
			title="Your account"
			onclick={() => (open = !open)}
		>
			<UserRound size={24} />
		</button>
		<ul id="account-links" class="account-links" hidden={!open}>
			<li class="signed-in-as">
				{#if signedInAs}
					<span class="small">Signed in as</span>
					<strong>{signedInAs.name}</strong>
					{#if signedInAs.role}<span class="small muted">{signedInAs.role}</span>{/if}
				{:else}
					<span>You are signed in.</span>
				{/if}
			</li>
			<li>
				<a href="/profile" data-sveltekit-reload>
					<UserRound size={20} strokeWidth={1.75} />
					Your profile
				</a>
			</li>
			{#if hasWorkspace}
				<li>
					<a href="/workspace" data-sveltekit-reload>
						<LayoutDashboard size={20} strokeWidth={1.75} />
						Workspace
					</a>
				</li>
			{/if}
			<li>
				<a href="/profile/password" data-sveltekit-reload>
					<KeyRound size={20} strokeWidth={1.75} />
					Password
				</a>
			</li>
			<li>
				<form method="post" action="/sign-out" onsubmit={forgetName}>
					<button type="submit">
						<LogOut size={20} strokeWidth={1.75} />
						Sign out
					</button>
				</form>
			</li>
		</ul>
	</div>
{:else}
	<a class="account-link" href="/sign-in" data-sveltekit-reload>
		<LogIn size={20} strokeWidth={1.75} />
		Sign in
	</a>
{/if}

<style>
	.account-link {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-band-text);
		border-radius: var(--radius-control);
		color: var(--color-band-text);
		font-weight: var(--font-weight-semibold);
		text-decoration: none;
		white-space: nowrap;
	}

	.account-link:visited {
		color: var(--color-band-text);
	}

	.account-link:hover {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.18em;
	}

	.account {
		position: relative;
	}

	/* Round, like a profile picture, so it reads as the account and not as another setting. */
	.account-button {
		border-radius: 50%;
	}

	.account-button[aria-expanded='true'] {
		background: var(--color-band-text);
		color: var(--color-band);
	}

	.account-links {
		position: absolute;
		right: 0;
		top: calc(100% + var(--space-2));
		z-index: 20;
		min-width: 14rem;
		margin: 0;
		padding: var(--space-2) 0;
		list-style: none;
		background: var(--color-surface-raised);
		color: var(--color-ink);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		box-shadow: 0 var(--space-1) var(--space-3) color-mix(in srgb, var(--color-ink) 20%, transparent);
	}

	.account-links[hidden] {
		display: none;
	}

	.account-links a,
	.account-links button {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-4);
		border: 0;
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}

	.account-links a:hover,
	.account-links button:hover {
		text-decoration: underline;
	}

	/* Who is signed in: text, not a link, above the links. */
	.account-links .signed-in-as {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		padding: var(--space-2) var(--space-4) var(--space-3);
		margin-bottom: var(--space-1);
		border-bottom: 1px solid var(--color-line);
		overflow-wrap: anywhere;
		max-width: 20rem;
	}

	.account-links form {
		margin: 0;
		border-top: 1px solid var(--color-line);
	}
</style>
