<script lang="ts">
	// The masthead's sign-in control, at its far right (site/DESIGN.md,
	// section 6, "Masthead"). Pages are built ahead of time, so they show
	// "Sign in" until the browser reads the signed-in hint
	// (src/lib/signed-in-hint.ts). Once someone has signed in, a profile button
	// takes its place (Trevor asked for this on Nov. 22, 2026). It opens a
	// short list, following the WAI-ARIA disclosure pattern rather than a
	// menu: who is signed in, and Sign out. Everything else that was here,
	// the account pages, Following and the Workspace, is in the left sidebar
	// (Trevor, Nov. 23, 2026; src/lib/account-menu.ts). Trevor asked on Nov.
	// 22, 2026 for "Signed in as" and Sign out to live here rather than across
	// the top of the workspace and profile pages.
	//
	// The workspace and profile pages know who is signed in; they keep the name
	// on this device (localStorage), so the pages built ahead of time can show
	// it too. Signing out forgets it. Without scripts the link stays "Sign in",
	// which still works: a signed-in person who follows it is told so there.
	// Nobody needs to sign in to read the site or to make a request.
	//
	// Signed out, the button opens a panel under it with the sign-in forms
	// (SignInForms.svelte): email and password or a code, and Create an
	// account, so people can sign in without leaving the page they are
	// reading; signing in brings them back to it (Trevor, Nov. 23, 2026). The
	// panel is a native popover, so it sits above everything, closes with
	// Escape or a click outside, and on phones covers the More panel it was
	// opened from. Without scripts, and on the sign-in pages themselves, the
	// button stays a link to /sign-in.
	import { onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import LogIn from '@lucide/svelte/icons/log-in';
	import LogOut from '@lucide/svelte/icons/log-out';
	import UserRound from '@lucide/svelte/icons/user-round';
	import { followingState } from '#lib/following-state.svelte.ts';
	import { roleLabels, type Role } from '#lib/permissions.ts';
	import { readSignedInHint } from '#lib/signed-in-hint.ts';
	import type { SignInState } from '#lib/sign-in-state.ts';
	import SignInForms from './SignInForms.svelte';
	import { forgetLocalDrafts } from '#lib/essays/local-draft.ts';
	import { followSettingsEverywhere, forgetEverywhere } from '#lib/settings-everywhere.ts';

	interface SignedInAs {
		name: string;
		/** How the person takes part, such as "lead author"; empty without workspace access. */
		role: string;
	}

	const nameStorageKey = 'signed-in-as';

	let hintSignedIn = $state(false);
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
		if (email && ['/profile', '/account', '/uploads'].some((prefix) => page.url.pathname.startsWith(prefix))) {
			return { name: email, role: '' };
		}
		return undefined;
	});
	const signedInAs = $derived(fromPage ?? remembered);
	// The pages the Worker renders know at once; the others wait for the hint.
	const signedIn = $derived(hintSignedIn || fromPage !== undefined);

	// What the reader follows and how many updates they have not seen, for the
	// Follow button and the sidebar's Following entry (site/DESIGN.md, "Follow").
	let mounted = $state(false);

	$effect(() => {
		if (mounted && signedIn) void followingState.refresh(page.url.pathname);
	});
	// Settings kept with the account, when the person chose that (Settings, This device).
	$effect(() => {
		if (mounted && signedIn) return followSettingsEverywhere();
	});

	// The sign-in panel.
	let signInPanel: HTMLDivElement | undefined = $state();
	let signInButton: HTMLButtonElement | undefined = $state();
	let signInAnswer = $state<SignInState | undefined>(undefined);
	let codesAvailable = $state<boolean | undefined>(undefined);
	let asking: Promise<void> | undefined;
	const onSignInPage = $derived(page.url.pathname === '/sign-in' || page.url.pathname.startsWith('/sign-in/'));
	const returnHere = $derived(`${page.url.pathname}${page.url.search}`);

	/** Asks once whether codes can be sent, as soon as the reader heads for the button. */
	function askForOptions() {
		asking ??= fetch('/sign-in/options', { headers: { accept: 'application/json' } })
			.then((response) => (response.ok ? response.json() : { codesAvailable: false }))
			.then((options: { codesAvailable?: boolean }) => {
				codesAvailable = Boolean(options.codesAvailable);
			})
			.catch(() => {
				codesAvailable = false;
				asking = undefined;
			});
	}

	/** Puts the panel under the button on wider screens; phones place it with CSS. */
	function placePanel() {
		if (!signInPanel || !signInButton) return;
		const button = signInButton.getBoundingClientRect();
		if (button.width === 0) return;
		signInPanel.style.setProperty('--panel-top', `${button.bottom + 8}px`);
		signInPanel.style.setProperty('--panel-right', `${Math.max(8, document.documentElement.clientWidth - button.right)}px`);
	}

	async function panelToggled(event: ToggleEvent) {
		if (event.newState !== 'open') return;
		askForOptions();
		await asking;
		await tick();
		// The panel itself takes focus, as a dialog does, so it opens as drawn (design/sign-in-popover), without a focus ring on the first field; Tab goes on to Close and the fields.
		signInPanel?.focus();
	}

	async function panelChanged(answer: SignInState) {
		signInAnswer = answer;
		await tick();
		// A new step starts at its first field; with a problem, focus goes to the field it is about, and the note at the top is read out.
		const target = answer.problem ? signInPanel?.querySelector<HTMLElement>('[aria-invalid="true"]') : undefined;
		(target ?? signInPanel?.querySelector<HTMLElement>('input:not([type="hidden"])'))?.focus();
	}

	onMount(() => {
		mounted = true;
		const hint = readSignedInHint(document.cookie);
		hintSignedIn = hint.signedIn;
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
		forgetEverywhere();
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
				<form method="post" action="/sign-out" onsubmit={forgetName}>
					<button type="submit">
						<LogOut size={20} strokeWidth={1.75} />
						Sign out
					</button>
				</form>
			</li>
		</ul>
	</div>
{:else if mounted && !onSignInPage}
	<button
		bind:this={signInButton}
		class="account-link"
		type="button"
		popovertarget="sign-in-panel"
		onpointerenter={askForOptions}
		onfocus={askForOptions}
		onclick={placePanel}
	>
		<LogIn size={20} strokeWidth={1.75} />
		Sign in
	</button>
	<div
		bind:this={signInPanel}
		id="sign-in-panel"
		class="sign-in-panel"
		popover="auto"
		tabindex="-1"
		role="dialog"
		aria-labelledby="sign-in-panel-heading"
		ontoggle={panelToggled}
	>
		{#if codesAvailable === undefined}
			<p class="waiting" id="sign-in-panel-heading">Sign in</p>
		{:else}
			<SignInForms
				answer={signInAnswer}
				{codesAvailable}
				returnTo={returnHere}
				prefix="sign-in-panel-"
				level={2}
				onchange={panelChanged}
				onclose={() => signInPanel?.hidePopover()}
			/>
		{/if}
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

	button.account-link {
		background: transparent;
		font: inherit;
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
	}

	/* While its panel is open, the button shows in the band's colors reversed, as the account button does. */
	button.account-link:has(+ .sign-in-panel:popover-open) {
		background: var(--color-band-text);
		color: var(--color-band);
	}

	.sign-in-panel {
		position: fixed;
		inset: var(--panel-top, 3.5rem) var(--panel-right, var(--space-2)) auto auto;
		width: min(var(--layout-popover-form), calc(100vw - 2 * var(--space-2)));
		max-height: calc(100dvh - var(--panel-top, 3.5rem) - var(--space-3));
		overflow-y: auto;
		box-sizing: border-box;
		margin: 0;
		padding: var(--space-5);
		background: var(--color-surface-raised);
		color: var(--color-ink);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-panel);
		box-shadow: 0 var(--space-2) var(--space-5) color-mix(in srgb, var(--color-ink) 25%, transparent);
		text-align: left;
	}

	.sign-in-panel:not(:popover-open) {
		display: none;
	}

	.sign-in-panel:focus:not(:focus-visible) {
		outline: none;
	}

	/* The panel is already the box, so its forms are not drawn as boxes inside it. */
	.sign-in-panel :global(form.panel) {
		border: 0;
		padding: 0;
		margin: var(--space-4) 0;
	}

	.sign-in-panel :global(.heading) {
		font-size: var(--font-size-lead);
		margin: 0 0 var(--space-2);
	}

	.sign-in-panel :global(.intro) {
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
	}

	.sign-in-panel :global(.switch) {
		margin: var(--space-4) 0 0;
		padding-top: var(--space-4);
		border-top: 1px solid var(--color-line);
	}

	.waiting {
		margin: 0;
		color: var(--color-ink-muted);
	}

	/* Phones: under the one-row masthead, across the screen, over the More panel. */
	@media (max-width: 40rem) {
		.sign-in-panel {
			inset: 3.5rem var(--space-2) auto;
			width: auto;
			max-height: calc(100dvh - 4rem);
		}
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
