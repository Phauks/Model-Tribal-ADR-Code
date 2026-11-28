<script lang="ts">
	// "Request a Change" in the masthead (site/DESIGN.md, section 6), named
	// "Report a problem" until Trevor renamed it on Nov. 27, 2026. Trevor asked
	// on Nov. 22, 2026 that it be a button and open a dialog over the page
	// rather than a new page, and on Nov. 23, 2026 that it be only a flag icon
	// like the masthead's other controls, named by its label and tooltip. The
	// dialog is the shared Modal in two columns (Trevor, Nov. 27, 2026): on the
	// left a dropdown for what the reader would like to do (one choice is a
	// missing nation), the page they were on already filled in and who they
	// are; on the right what should change and any files (RequestForm.svelte,
	// compact). The form is sent in place, and the dialog shows the reference
	// number.
	//
	// It is the site's only way to ask for a change (Trevor, Nov. 28, 2026):
	// the separate request page is gone, and every link that opened it, such
	// as "Ask to remove it" on a copy or "Write to the team" on a claimed
	// nation's badge, opens this dialog already filled in. Such a link ends in
	// #request=... (requestLink in src/lib/report-request.ts); the dialog opens
	// on the click, or on arrival from another page, and the fragment leaves
	// the address. An error page or an error box opens it already filled in,
	// as "Report a broken page" with the address (openReport; site/ERRORS.md).
	import { onMount, tick, untrack } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import type { applyAction } from '$app/forms';
	import Flag from '@lucide/svelte/icons/flag';
	import { requestKindHints, requestKindLabels, type RequestKind } from '#lib/requests.ts';
	import { presetFromFragment, reportedAddress, reportRequestEvent, type RequestPreset } from '#lib/report-request.ts';
	import Dropdown from './Dropdown.svelte';
	import Modal from './Modal.svelte';
	import RequestForm from './RequestForm.svelte';
	import RequestSent from './RequestSent.svelte';

	/** The record the page shows, such as "tribes/navajo-nation", or empty. */
	let { record: pageRecord = '' }: { record?: string } = $props();

	/** The kinds of request the dialog offers; "Replace a name with initials" only from a court opinion's link. */
	const offeredKinds: RequestKind[] = ['correct', 'broken-page', 'add-nation', 'restrict', 'remove', 'contribute', 'question'];

	type ActionResult = Parameters<typeof applyAction>[0];
	type Sent = { reference: string; kind: RequestKind; receivedAt: string };

	let scripted = $state(false);
	let modal: Modal<string> | undefined = $state();
	let opener: HTMLButtonElement | undefined = $state();
	let kind = $state<RequestKind>(offeredKinds[0]);
	let values = $state<Record<string, string>>({});
	let errors = $state<Record<string, string>>({});
	let problem = $state<string | undefined>();
	let sent = $state<Sent | undefined>();
	/** What a link filled in, kept until the dialog is opened from the flag again. */
	let preset = $state<RequestPreset | undefined>();

	const kindChoices = $derived(
		(kind === 'replace-name' ? [...offeredKinds.slice(0, 5), 'replace-name' as const, ...offeredKinds.slice(5)] : offeredKinds).map((value) => ({
			value,
			label: requestKindLabels[value],
			hint: requestKindHints[value]
		}))
	);

	onMount(() => {
		scripted = true;
		const fromProblem = (event: Event) => openWith((event as CustomEvent<RequestPreset>).detail);
		const fromFragment = () => void arrive(presetFromFragment(location.hash));
		// A link on this page that ends in #request=... opens the dialog without moving the page.
		const fromLink = (event: MouseEvent) => {
			if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
			const link = (event.target as Element | null)?.closest?.('a[href]');
			if (!(link instanceof HTMLAnchorElement)) return;
			const target = new URL(link.href, location.href);
			if (target.origin !== location.origin || target.pathname !== location.pathname) return;
			const linked = presetFromFragment(target.hash);
			if (!linked) return;
			event.preventDefault();
			openWith(linked);
		};
		addEventListener(reportRequestEvent, fromProblem);
		addEventListener('hashchange', fromFragment);
		document.addEventListener('click', fromLink, true);
		return () => {
			removeEventListener(reportRequestEvent, fromProblem);
			removeEventListener('hashchange', fromFragment);
			document.removeEventListener('click', fromLink, true);
		};
	});

	// A link from another page, or an old /requests address, arrives with #request=...
	$effect(() => {
		if (!scripted) return;
		const linked = presetFromFragment(page.url.hash) ?? presetFromFragment(location.hash);
		if (linked) untrack(() => void arrive(linked));
	});

	/** Opens the dialog for a link's fragment, then takes the fragment out of the address. */
	async function arrive(linked: RequestPreset | undefined) {
		if (!linked) return;
		// On arrival the dialog is drawn in the same moment, so it opens once it is there.
		await tick();
		openWith(linked);
		replaceState(`${location.pathname}${location.search}`, page.state);
	}

	/** On an error page the flag reports the page as broken, with its whole address. */
	const onErrorPage = $derived(page.status >= 400);

	const record = $derived(preset?.record ?? pageRecord);

	/** What the request is about: the record (and its part), the address a link named, or else the page's address. */
	const material = $derived.by(() => {
		if (onErrorPage && !preset) return reportedAddress(page.url);
		if (record) return preset?.field ? `${record} (${preset.field})` : record;
		return preset?.material ?? reportedAddress(page.url);
	});
	const nationIdentifier = $derived(record.startsWith('tribes/') ? record.slice('tribes/'.length) : '');
	const toTeam = $derived(Boolean(preset?.toTeam && nationIdentifier));

	function reset() {
		kind = onErrorPage ? 'broken-page' : offeredKinds[0];
		values = {};
		errors = {};
		problem = undefined;
		sent = undefined;
		preset = undefined;
	}

	function open() {
		if (sent || preset || (onErrorPage && Object.keys(values).length === 0)) reset();
		modal?.open();
	}

	/** Opens the dialog with answers already filled in, keeping nothing from before. */
	function openWith(next: RequestPreset) {
		reset();
		preset = next;
		kind = next.toTeam ? 'question' : (next.kind ?? kind);
		values = {
			...(next.material && !next.record ? { material: next.material } : {}),
			...(next.details ? { details: next.details } : {})
		};
		modal?.open();
	}

	/** A new choice keeps what the reader typed; the old choice's messages go. */
	function choose(next: RequestKind) {
		kind = next;
		errors = {};
		problem = undefined;
	}

	async function received(result: ActionResult) {
		problem = undefined;
		errors = {};
		if (result.type === 'success' && result.data?.sent) {
			sent = result.data.sent as Sent;
			await tick();
			document.getElementById('report-sent')?.focus();
		} else if (result.type === 'failure') {
			const data = result.data ?? {};
			errors = (data.errors as Record<string, string> | undefined) ?? {};
			values = (data.values as Record<string, string> | undefined) ?? {};
			problem = data.problem as string | undefined;
		} else {
			problem = 'The request could not be sent. Please try again in a moment.';
		}
	}
</script>

<button
	bind:this={opener}
	class="icon-button"
	type="button"
	aria-haspopup="dialog"
	aria-label="Request a Change"
	title="Request a Change"
	onclick={open}
>
	<Flag size={24} />
</button>

{#if scripted}
	<Modal bind:this={modal} title={toTeam ? 'Write to the Nation’s Team' : 'Request a Change'} onclose={() => opener?.focus()}>
		{#if sent}
			<div id="report-sent" tabindex="-1">
				<RequestSent {sent} headingLevel={3} />
			</div>
			<p><button class="button" type="button" onclick={() => modal?.close()}>Close</button></p>
		{:else}
			{#snippet kindChoice()}
				<div class="field kind-choice">
					<Dropdown label="What would you like to do?" choices={kindChoices} value={kind} onchange={choose} />
				</div>
			{/snippet}
			<RequestForm
				lead={toTeam ? undefined : kindChoice}
				{kind}
				{nationIdentifier}
				{material}
				{values}
				{errors}
				{problem}
				{toTeam}
				headingLevel={3}
				compact
				prefix="report-"
				action="/requests"
				onresult={received}
			/>
		{/if}
	</Modal>
{/if}

<style>
	/* The choice heads the left column, level with the right column's first question. */
	.kind-choice :global(.dropdown) {
		margin-top: 0;
	}

	#report-sent:focus-visible {
		outline: none;
	}
</style>
