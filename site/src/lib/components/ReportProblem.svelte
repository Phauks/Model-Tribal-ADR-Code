<script lang="ts">
	// "Report a problem" in the masthead (site/DESIGN.md, section 6). Trevor
	// asked on Nov. 22, 2026 that it be a button and open a dialog over the
	// page rather than a new page. The dialog is the shared Modal, on one page
	// (Trevor, Nov. 23, 2026): a dropdown for what is wrong (one choice is a
	// missing nation), and under it the request form's questions for that
	// choice (RequestForm.svelte, compact), with the page they were on already
	// filled in. The form is sent in place, and the dialog shows the reference
	// number. Without scripts the control is a link to the
	// request page, which asks the same questions.
	import { onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import type { applyAction } from '$app/forms';
	import Flag from '@lucide/svelte/icons/flag';
	import { requestKindHints, requestKindLabels, type RequestKind } from '#lib/requests.ts';
	import Dropdown from './Dropdown.svelte';
	import Modal from './Modal.svelte';
	import RequestForm from './RequestForm.svelte';
	import RequestSent from './RequestSent.svelte';

	/** The request page's address for this page, used without scripts. */
	let { link }: { link: string } = $props();

	/** The kinds of request that report a problem; Contribute has its own button. */
	const reportKinds: RequestKind[] = ['correct', 'add-nation', 'restrict', 'remove', 'question'];
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
	});

	// The request page itself keeps the plain link: it already is the form.
	const onRequestPage = $derived(page.url.pathname === '/requests');

	/** The record named in the link, such as "tribes/navajo-nation". */
	const record = $derived(new URL(link, page.url.origin).searchParams.get('record') ?? '');

	/** What the report is about: the record, or else the page's address. */
	const material = $derived(record || `${page.url.origin}${page.url.pathname}`);
	const nationIdentifier = $derived(record.startsWith('tribes/') ? record.slice('tribes/'.length) : '');

	function reset() {
		kind = reportKinds[0];
		values = {};
		errors = {};
		problem = undefined;
		sent = undefined;
	}

	function open() {
		if (sent) reset();
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
	<button bind:this={opener} class="report-button" type="button" aria-haspopup="dialog" onclick={open}>
		<Flag size={20} strokeWidth={1.75} />
		<span>Report a problem</span>
	</button>
{:else}
	<a class="report-button" href={link}>
		<Flag size={20} strokeWidth={1.75} />
		<span>Report a problem</span>
	</a>
{/if}

{#if scripted && !onRequestPage}
	<Modal bind:this={modal} title="Report a problem" onclose={() => opener?.focus()}>
		{#if sent}
			<div id="report-sent" tabindex="-1">
				<RequestSent {sent} headingLevel={3} />
			</div>
			<p><button class="button" type="button" onclick={() => modal?.close()}>Close</button></p>
		{:else}
			<div class="report-kind">
				<Dropdown label="What is wrong?" choices={kindChoices} value={kind} onchange={choose} />
			</div>
			<RequestForm
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
	/* Outlined on the band, like Print and Download beside it. */
	.report-button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-band-text);
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--color-band-text);
		font: inherit;
		font-weight: var(--font-weight-semibold);
		text-decoration: none;
		cursor: pointer;
	}

	.report-button:visited {
		color: var(--color-band-text);
	}

	/* The dropdown sits at the top of the dialog, with room before the first question. */
	.report-kind {
		margin: calc(-1 * var(--space-4)) 0 var(--space-5);
	}

	#report-sent:focus-visible {
		outline: none;
	}
</style>
