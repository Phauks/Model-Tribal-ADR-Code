<script lang="ts">
	// "Report a problem" in the masthead (site/DESIGN.md, section 6). Trevor
	// asked on Nov. 22, 2026 that it be a button and open a dialog over the
	// page rather than a new page. The dialog is the shared Modal: the reader
	// picks what is wrong (one choice is a missing nation), then answers the
	// request form's questions for it (RequestForm.svelte), with the page they
	// were on already filled in. The form is sent in place, and the dialog
	// shows the reference number. Without scripts the control is a link to the
	// request page, which asks the same questions.
	import { onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import type { applyAction } from '$app/forms';
	import Flag from '@lucide/svelte/icons/flag';
	import { requestKindHints, requestKindLabels, type RequestKind } from '#lib/requests.ts';
	import Modal from './Modal.svelte';
	import RequestForm from './RequestForm.svelte';
	import RequestSent from './RequestSent.svelte';

	/** The request page's address for this page, used without scripts. */
	let { link }: { link: string } = $props();

	/** The kinds of request that report a problem; Contribute has its own button. */
	const reportKinds: RequestKind[] = ['correct', 'add-nation', 'restrict', 'remove', 'question'];

	type ActionResult = Parameters<typeof applyAction>[0];
	type Sent = { reference: string; kind: RequestKind; receivedAt: string };

	let scripted = $state(false);
	let modal: Modal<string> | undefined = $state();
	let opener: HTMLButtonElement | undefined = $state();
	let choice = $state<RequestKind | undefined>();
	let kind = $state<RequestKind | undefined>();
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
		choice = undefined;
		kind = undefined;
		values = {};
		errors = {};
		problem = undefined;
		sent = undefined;
	}

	function open() {
		if (sent) reset();
		modal?.open();
	}

	async function proceed(event: SubmitEvent) {
		event.preventDefault();
		if (!choice) return;
		kind = choice;
		await tick();
		document.getElementById('report-form-start')?.focus();
	}

	async function chooseAgain() {
		kind = undefined;
		values = {};
		errors = {};
		problem = undefined;
		await tick();
		document.getElementById(`report-kind-${choice ?? reportKinds[0]}`)?.focus();
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
		{:else if !kind}
			<p class="small muted">About: {material}</p>
			<form onsubmit={proceed}>
				<fieldset>
					<legend><h3>What is wrong?</h3></legend>
					{#each reportKinds as option (option)}
						<div class="choice">
							<input type="radio" id="report-kind-{option}" name="report-kind" value={option} bind:group={choice} required />
							<label for="report-kind-{option}">
								{requestKindLabels[option]}
								<span class="hint">{requestKindHints[option]}</span>
							</label>
						</div>
					{/each}
				</fieldset>
				<p><button class="button" type="submit">Continue</button></p>
			</form>
		{:else}
			<p id="report-form-start" tabindex="-1">
				<strong>{requestKindLabels[kind]}.</strong>
				{requestKindHints[kind]}
				<button class="text-button" type="button" onclick={chooseAgain}>Choose something else</button>
			</p>
			<RequestForm
				{kind}
				{nationIdentifier}
				{material}
				{values}
				{errors}
				{problem}
				headingLevel={3}
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

	fieldset {
		border: 0;
		margin: 0 0 var(--space-5);
		padding: 0;
		min-width: 0;
	}

	legend {
		padding: 0;
	}

	legend h3 {
		margin: 0 0 var(--space-2);
	}

	.choice {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		margin: var(--space-3) 0;
	}

	.choice input {
		margin-top: 0.3em;
		width: 1.25rem;
		height: 1.25rem;
		flex: none;
	}

	.choice .hint {
		display: block;
	}

	/* "Choose something else" acts in place, so it is a button that reads as a link. */
	.text-button {
		padding: 0;
		border: 0;
		background: none;
		color: var(--color-link);
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}

	#report-form-start:focus-visible,
	#report-sent:focus-visible {
		outline: none;
	}

	p.muted {
		overflow-wrap: anywhere;
	}
</style>
