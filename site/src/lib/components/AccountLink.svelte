<script lang="ts">
	// The masthead's sign-in control, at its far right (site/DESIGN.md,
	// section 6, "Masthead"). Pages are built ahead of time, so they show
	// "Sign in" until the browser reads the signed-in hint
	// (src/lib/signed-in-hint.ts). Once someone has signed in, a profile button
	// takes its place (Trevor asked for this on Nov. 22, 2026). It opens a
	// short list of links, following the WAI-ARIA disclosure pattern rather
	// than a menu, since the items are plain links and a form: Your profile,
	// Workspace and Sign out. Workspace sends a person without workspace access
	// to their profile (requirePerson in src/lib/server/workspace.ts). Without
	// scripts the link stays "Sign in", which still works: a signed-in person
	// who follows it is told so there. Nobody needs to sign in to read the
	// site or to make a request.
	import { onMount } from 'svelte';
	import LogIn from '@lucide/svelte/icons/log-in';
	import LogOut from '@lucide/svelte/icons/log-out';
	import UserRound from '@lucide/svelte/icons/user-round';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import { signedInHintCookie } from '#lib/signed-in-hint.ts';

	let signedIn = $state(false);
	let open = $state(false);
	let container: HTMLDivElement | undefined = $state();
	let button: HTMLButtonElement | undefined = $state();

	onMount(() => {
		signedIn = document.cookie
			.split(';')
			.some((entry) => entry.trim() === `${signedInHintCookie}=1`);
	});

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
			class="account-button"
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
			<li>
				<a href="/profile" data-sveltekit-reload>
					<UserRound size={20} strokeWidth={1.75} />
					Your profile
				</a>
			</li>
			<li>
				<a href="/workspace" data-sveltekit-reload>
					<LayoutDashboard size={20} strokeWidth={1.75} />
					Workspace
				</a>
			</li>
			<li>
				<form method="post" action="/sign-out">
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
		display: inline-grid;
		place-items: center;
		min-width: var(--layout-target-minimum);
		min-height: var(--layout-target-minimum);
		padding: 0;
		border: 1px solid var(--color-band-text);
		border-radius: 50%;
		background: transparent;
		color: var(--color-band-text);
		cursor: pointer;
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

	.account-links form {
		margin: 0;
		border-top: 1px solid var(--color-line);
	}
</style>
