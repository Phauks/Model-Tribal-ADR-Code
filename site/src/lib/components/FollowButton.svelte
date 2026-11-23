<script lang="ts">
	// The Follow button (site/DESIGN.md, section 6, "Follow"). An icon button
	// with Lucide's bell, after Star in the masthead, on a page that can be
	// followed: a nation's page, the model code or a section of it, and an
	// essay (src/lib/following.ts). Following needs an account, because the
	// site has to know whom to tell: for a signed-out reader the button opens a
	// short dialog that explains this and offers sign-in. For a signed-in
	// reader it is a toggle button (aria-pressed); a ringing bell shows a page
	// they follow, and a status message says what changed. Without scripts the
	// button is hidden.
	import { page } from '$app/state';
	import Bell from '@lucide/svelte/icons/bell';
	import BellRing from '@lucide/svelte/icons/bell-ring';
	import LogIn from '@lucide/svelte/icons/log-in';
	import { onMount } from 'svelte';
	import { followKindOf } from '#lib/following.ts';
	import { followingState } from '#lib/following-state.svelte.ts';
	import Modal from './Modal.svelte';

	const address = $derived(page.url.pathname);
	const followable = $derived(followKindOf(address) !== undefined);
	const answer = $derived(followingState.address === address ? followingState.current : undefined);
	const pressed = $derived(Boolean(answer?.following));
	let mounted = $state(false);
	let busy = $state(false);
	let message = $state('');
	let modal: Modal<string> | undefined = $state();
	let button: HTMLButtonElement | undefined = $state();

	onMount(() => {
		mounted = true;
	});

	$effect(() => {
		if (!mounted) return;
		message = '';
		void followingState.refresh(address);
	});

	const signInLink = $derived(`/sign-in?returnTo=${encodeURIComponent(address)}`);

	async function toggle(): Promise<void> {
		if (!answer?.signedIn) {
			modal?.open();
			return;
		}
		if (busy) return;
		busy = true;
		const following = !pressed;
		const problem = await followingState.set(address, following);
		busy = false;
		if (problem) message = problem;
		else
			message = following
				? 'Following. When this page changes, it is listed on your Following page, under your account button.'
				: 'You no longer follow this page.';
	}
</script>

{#if followable}
	<button
		bind:this={button}
		class="icon-button needs-scripts"
		type="button"
		aria-pressed={answer?.signedIn ? pressed : undefined}
		aria-label="Follow this page"
		title={pressed ? 'Following. Press to stop following' : 'Follow this page: get told when it changes'}
		disabled={busy}
		onclick={toggle}
	>
		{#if pressed}<BellRing size={24} />{:else}<Bell size={24} />{/if}
	</button>
	<span class="visually-hidden" role="status">{message}</span>

	<Modal bind:this={modal} title="Follow this page" fitContent onclose={() => button?.focus()}>
		<p>
			Sign in to follow pages. When a page you follow changes, it is listed on your Following page, and you
			can choose to get a summary by email.
		</p>
		<p class="small muted">
			A notice says only that the page changed, and links to it. Signing in with your email address makes
			an account if you do not have one.
		</p>
		<p>
			<a class="button sign-in" href={signInLink} data-sveltekit-reload>
				<LogIn size={20} strokeWidth={1.75} />
				Sign in
			</a>
		</p>
	</Modal>
{/if}

<style>
	.sign-in {
		gap: var(--space-2);
	}
</style>
