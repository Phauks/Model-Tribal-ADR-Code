<script lang="ts">
	// The masthead's sign-in control, at its far right (site/DESIGN.md,
	// section 6, "Masthead"). Pages are built ahead of time, so they show
	// "Sign in" until the browser reads the signed-in hint
	// (src/lib/signed-in-hint.ts). Once someone has signed in, a profile button
	// takes its place (Trevor asked for this on Nov. 22, 2026). It opens the
	// account menu, following the WAI-ARIA disclosure pattern rather than a
	// menu: who is signed in, the person's own pages (Profile and credit,
	// Following with its new updates, Your uploads, Nation team, Starred
	// pages), the settings kept with the account, and Sign out
	// (src/lib/account-menu.ts). Trevor chose on Nov. 27, 2026 to bring the
	// account pages here from the side column, now that the section bar
	// carries the site's places; the Workspace is the bar's last tab
	// (design/sidebar-workspace-profile, option B). On phones the menu covers
	// the screen as a sheet with its own Close button.
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
	import X from '@lucide/svelte/icons/x';
	import { currentAccountPage } from '#lib/account-menu.ts';
	import { navigationIcons } from '#lib/navigation-icons.ts';
	import { accountGroupLinks, starredPagesLink } from '#lib/personal-navigation.ts';
	import type { NavigationLink } from '#lib/site-navigation.ts';
	import { followingState } from '#lib/following-state.svelte.ts';
	import { unreadLabel } from '#lib/following.ts';
	import { roleLabels, type Role } from '#lib/permissions.ts';
	import { readSignedInHint } from '#lib/signed-in-hint.ts';
	import type { SignInState } from '#lib/sign-in-state.ts';
	import SignInForms from './SignInForms.svelte';
	import { forgetLocalDrafts } from '#lib/essays/local-draft.ts';
	import { followSettingsEverywhere, forgetEverywhere } from '#lib/settings-everywhere.ts';
	import { readStoredJson, writeStored, writeStoredJson } from '#lib/browser-storage.ts';

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

	// The account menu's rows (src/lib/personal-navigation.ts): the person's
	// own pages, with Starred pages, the reader's own, kept on this device;
	// then the settings kept with the account.
	const yours = [...accountGroupLinks('yours'), starredPagesLink];
	const settings = accountGroupLinks('settings');
	const currentLink = $derived(page.url.pathname === '/starred' ? '/starred' : currentAccountPage(page.url.pathname)?.link);
	// Updates to followed pages not yet seen, beside Following (site/DESIGN.md, section 6, "Follow").
	const unread = $derived(followingState.current.signedIn ? followingState.current.unread : 0);

	/** Up to two letters for the round mark beside the name: the first letters of its first two words, or of an email address. */
	function initials(name: string): string {
		const words = name.includes('@') ? [name] : name.trim().split(/\s+/);
		return words
			.slice(0, 2)
			.map((word) => word.charAt(0).toLocaleUpperCase('en-US'))
			.join('');
	}
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
	let turnstileSiteKey = $state<string | undefined>(undefined);
	let providers = $state<('google' | 'microsoft')[]>([]);
	let asking: Promise<void> | undefined;
	const onSignInPage = $derived(page.url.pathname === '/sign-in' || page.url.pathname.startsWith('/sign-in/'));
	const returnHere = $derived(`${page.url.pathname}${page.url.search}`);

	/** Asks once whether codes can be sent, as soon as the reader heads for the button. */
	function askForOptions() {
		asking ??= fetch('/sign-in/options', { headers: { accept: 'application/json' } })
			.then((response) => (response.ok ? response.json() : { codesAvailable: false }))
			.then((options: { codesAvailable?: boolean; turnstileSiteKey?: string | null; providers?: ('google' | 'microsoft')[] }) => {
				turnstileSiteKey = options.turnstileSiteKey ?? undefined;
				providers = options.providers ?? [];
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
		// Storage can be blocked; the menu then says only that someone is signed in.
		if (fromPage) writeStoredJson(nameStorageKey, fromPage);
		else if (!signedIn) {
			writeStored(nameStorageKey, null);
			// Unsaved essay text kept by the editor (local-draft.ts) does not outlast the sign-in.
			if (!location.pathname.startsWith('/sign-in')) forgetLocalDrafts();
		}
		else {
			const stored = readStoredJson(nameStorageKey) as SignedInAs | null;
			if (stored && typeof stored.name === 'string') remembered = { name: stored.name, role: String(stored.role ?? '') };
		}
	});

	function forgetName() {
		writeStored(nameStorageKey, null);
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
	<!-- Escape and leaving the menu close it from anywhere inside; the button and links are the controls. -->
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
		<div id="account-links" class="account-menu" hidden={!open}>
			<div class="sheet-head">
				<span>Your Account</span>
				<button type="button" class="icon-button" aria-label="Close" onclick={() => ((open = false), button?.focus())}><X size={24} /></button>
			</div>
			<div class="signed-in-as">
				{#if signedInAs}
					<span class="mark" aria-hidden="true">{initials(signedInAs.name)}</span>
					<span class="who">
						<span class="visually-hidden">Signed in as</span>
						<strong>{signedInAs.name}</strong>
						{#if signedInAs.role}<span class="role">{signedInAs.role}</span>{/if}
					</span>
				{:else}
					<span>You are signed in.</span>
				{/if}
			</div>
			{#snippet rows(items: NavigationLink[])}
				<ul>
					{#each items as item (item.link)}
						{@const Icon = navigationIcons[item.icon]}
						<li class:needs-scripts={item === starredPagesLink}>
							<a href={item.link} aria-current={item.link === currentLink ? 'page' : undefined} onclick={() => (open = false)}>
								<Icon size={18} aria-hidden="true" />
								<span class="label">{item.label}</span>
								{#if item.link === '/following' && unread > 0}<span class="unread">{unreadLabel(unread)} new</span>{/if}
							</a>
						</li>
					{/each}
				</ul>
			{/snippet}
			{@render rows(yours)}
			<p class="group-title" id="account-settings-title">Settings</p>
			<div role="group" aria-labelledby="account-settings-title">{@render rows(settings)}</div>
			<form method="post" action="/sign-out" onsubmit={forgetName}>
				<button type="submit">
					<LogOut size={18} aria-hidden="true" />
					<span class="label">Sign out</span>
				</button>
			</form>
		</div>
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
				{turnstileSiteKey}
				{providers}
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

	/* The account menu, as in design/sidebar-workspace-profile/mockups/B-desktop-account-light.png. */
	.account-menu {
		position: absolute;
		right: 0;
		top: calc(100% + var(--space-2));
		z-index: 20;
		box-sizing: border-box;
		width: 18.75rem;
		max-height: calc(100dvh - 5rem);
		overflow-y: auto;
		padding: var(--space-3) var(--space-2);
		background: var(--color-surface-raised);
		color: var(--color-ink);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		box-shadow: 0 var(--space-3) var(--space-6) color-mix(in srgb, var(--color-ink) 18%, transparent);
		font-size: var(--font-size-small);
		text-align: left;
	}

	.account-menu[hidden] {
		display: none;
	}

	/* The sheet's own heading and Close button show only on phones. */
	.sheet-head {
		display: none;
	}

	.account-menu ul {
		list-style: none;
		margin: 0;
		padding: 0 0 var(--space-2);
		border-bottom: 1px solid var(--color-line);
	}

	/* Who is signed in: text, not a link, above the links. */
	.signed-in-as {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-1) 0.625rem 0.625rem;
		margin-bottom: var(--space-2);
		border-bottom: 1px solid var(--color-line);
		overflow-wrap: anywhere;
	}

	.mark {
		display: grid;
		place-items: center;
		flex: none;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 50%;
		background: var(--color-band);
		color: var(--color-band-text);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-band-text) 25%, transparent);
		font-size: 0.85rem;
		font-weight: var(--font-weight-bold);
		letter-spacing: 0.02em;
	}

	.who {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.who strong {
		font-size: var(--font-size-body);
	}

	.role {
		color: var(--color-ink-muted);
	}

	.group-title {
		margin: 0.625rem 0 0.375rem;
		padding: 0 0.625rem;
		color: var(--color-ink-muted);
		font-size: 0.75rem;
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--font-letter-spacing-wide, 0.06em);
		text-transform: uppercase;
	}

	.account-menu a,
	.account-menu form button {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		width: 100%;
		box-sizing: border-box;
		min-height: 2.125rem;
		padding: 0 0.625rem;
		border: 0;
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		font-weight: var(--font-weight-semibold);
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}

	.account-menu a :global(svg),
	.account-menu form button :global(svg) {
		flex: none;
		color: var(--color-link);
	}

	.account-menu a:hover,
	.account-menu form button:hover {
		background: var(--color-surface);
	}

	.account-menu a:hover .label,
	.account-menu form button:hover .label {
		text-decoration: underline;
	}

	.account-menu a[aria-current='page'] {
		background: var(--color-surface);
		font-weight: var(--font-weight-bold);
	}

	.label {
		flex: 1;
		min-width: 0;
	}

	/* The number of updates not yet seen, in the action color. */
	.unread {
		color: var(--color-action);
		font-size: 0.8rem;
		font-weight: var(--font-weight-semibold);
	}

	.account-menu form {
		margin: var(--space-2) 0 0;
	}

	/* Phones: the menu is a sheet over the whole screen, as in mockups/B-phone-account-light.png. */
	@media (max-width: 40rem) {
		.account-menu {
			position: fixed;
			inset: 0;
			z-index: 30;
			width: auto;
			max-height: none;
			padding: 0 0 var(--space-6);
			border: 0;
			border-radius: 0;
			background: var(--color-paper);
			box-shadow: none;
			font-size: var(--font-size-body);
		}

		.sheet-head {
			display: flex;
			align-items: center;
			justify-content: space-between;
			min-height: 3.5rem;
			padding: 0 var(--space-2) 0 var(--space-4);
			background: var(--color-band);
			color: var(--color-band-text);
			font-size: 1.15rem;
			font-weight: var(--font-weight-bold);
		}

		.sheet-head .icon-button {
			color: var(--color-band-text);
		}

		.signed-in-as {
			padding: var(--space-4) var(--space-4) var(--space-1);
			margin: 0;
			border-bottom: 0;
		}

		.account-menu ul {
			padding: 0;
			border-bottom: 0;
		}

		.account-menu a,
		.account-menu form button {
			gap: var(--space-3);
			min-height: 3rem;
			padding: 0 var(--space-4);
			border-bottom: 1px solid var(--color-line);
			border-radius: 0;
		}

		.account-menu a :global(svg),
		.account-menu form button :global(svg) {
			width: 20px;
			height: 20px;
		}

		.group-title {
			margin: 0;
			padding: 1.125rem var(--space-4) 0.375rem;
		}

		.account-menu form {
			margin: 0;
		}
	}
</style>
