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
	// number. Without scripts the control is a link to the request page, which
	// asks the same questions. An error page or an error box opens it already
	// filled in, as "Report a broken page" with the address (openReport in
	// src/lib/report-request.ts; site/ERRORS.md).
	import { onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import type { applyAction } from '$app/forms';
	import Flag from '@lucide/svelte/icons/flag';
	import { requestKindHints, requestKindLabels, type RequestKind } from '#lib/requests.ts';
	import { reportedAddress, reportRequestEvent, type ReportPreset } from '#lib/report-request.ts';
	import Dropdown from './Dropdown.svelte';
	import Modal from './Modal.svelte';
	import RequestForm from './RequestForm.svelte';
	import RequestSent from './RequestSent.svelte';

	/** The request page's address for this page, used without scripts. */
	let { link }: { link: string } = $props();

	/** The kinds of request the dialog offers; Contribute has its own link in the sidebar. */
	const reportKinds: RequestKind[] = ['correct', 'broken-page', 'add-nation', 'restrict', 'remove', 'question'];
	const kindChoices = reportKinds.map((value) => ({
		value,
		label: requestKindLabels[value],
		hint: requestKindHints[value]
	}));

	type ActionResult = Parameters<typeof applyAction>[0];
	type Sent = { reference: string; kind: RequestKind; receivedAt: string };

	let scripted = $state(false);
	let modal: Modal<string> | undefined = $state();
	let opener: HTMLButtonElement | undefined = $state();
	let kind = $state<RequestKind>(reportKinds[0]);
	let values = $state<Record<string, string>>({});
	let errors = $state<Record<string, string>>({});
	let problem = $state<string | undefined>();
	let sent = $state<Sent | undefined>();

	onMount(() => {
		scripted = true;
		const fromProblem = (event: Event) => openWith((event as CustomEvent<ReportPreset>).detail);
		addEventListener(reportRequestEvent, fromProblem);
		return () => removeEventListener(reportRequestEvent, fromProblem);
	});

	/** On an error page the flag reports the page as broken, with its whole address. */
	const onErrorPage = $derived(page.status >= 400);

	// The request page itself keeps the plain link: it already is the form.
	const onRequestPage = $derived(page.url.pathname === '/requests');

	/** The record named in the link, such as "tribes/navajo-nation". */
	const record = $derived(new URL(link, page.url.origin).searchParams.get('record') ?? '');

	/** What the report is about: the record, or else the page's address. */
	const material = $derived(onErrorPage ? reportedAddress(page.url) : record || reportedAddress(page.url));
	const nationIdentifier = $derived(record.startsWith('tribes/') ? record.slice('tribes/'.length) : '');

	function reset() {
		kind = onErrorPage ? 'broken-page' : reportKinds[0];
		values = {};
		errors = {};
		problem = undefined;
		sent = undefined;
	}

	function open() {
		if (sent || (onErrorPage && Object.keys(values).length === 0)) reset();
		modal?.open();
	}

	/** Opens the dialog with answers already filled in, keeping nothing from before. */
	function openWith(preset: ReportPreset) {
		reset();
		kind = preset.kind;
		values = { material: preset.material, ...(preset.details ? { details: preset.details } : {}) };
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

{#if scripted && !onRequestPage}
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
{:else}
	<a class="icon-button" href={link} aria-label="Request a Change" title="Request a Change">
		<Flag size={24} />
	</a>
{/if}

{#if scripted && !onRequestPage}
	<Modal bind:this={modal} title="Request a Change" onclose={() => opener?.focus()}>
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
				lead={kindChoice}
				{kind}
				{nationIdentifier}
				{material}
				{values}
				{errors}
				{problem}
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
	/* A link without scripts keeps the band's color after a visit. */
	a.icon-button:visited {
		color: inherit;
	}

	/* The choice heads the left column, level with the right column's first question. */
	.kind-choice :global(.dropdown) {
		margin-top: 0;
	}

	#report-sent:focus-visible {
		outline: none;
	}
</style>
