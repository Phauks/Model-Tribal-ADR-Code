<!--
	Attest to a section or subsection of an essay (src/lib/essays/
	attestations.ts): say that you wrote, edited or reviewed it as it stands.
	Lists who has attested so far, and lets a person withdraw their own.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import {
		attestationRoleChoices,
		attestationRoleLabels,
		attestationRoles,
		currentAttestations,
		namesShownByDefault,
		type Attestation,
		type AttestationRole,
		type AttestSection
	} from '#lib/essays/attestations.ts';
	import { essayDate } from '#lib/essays/dates.ts';

	let {
		essay,
		attestations,
		you,
		yourRole,
		canWriteOrEdit,
		onchange
	}: {
		essay: string;
		attestations: Attestation[];
		you: string | null;
		/** The person's role on the project, for whether the reader-name box starts checked. */
		yourRole: string;
		canWriteOrEdit: boolean;
		onchange: (attestations: Attestation[]) => void;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let section = $state<AttestSection | null>(null);
	let role = $state<AttestationRole>('wrote');
	let note = $state('');
	let shownToReaders = $state(true);
	let problem = $state('');
	let sending = $state(false);

	const kind = $derived(section?.level === 3 ? 'subsection' : 'section');
	const shown = $derived(section ? currentAttestations(attestations, section.slug) : []);
	const roles = $derived(canWriteOrEdit ? attestationRoles : (['reviewed'] as const));

	/** Opens the dialog for a section. */
	export async function show(chosen: AttestSection): Promise<void> {
		section = chosen;
		role = canWriteOrEdit ? 'wrote' : 'reviewed';
		shownToReaders = namesShownByDefault(yourRole, role);
		note = '';
		problem = '';
		sending = false;
		await tick();
		dialog?.showModal();
	}

	async function answer(response: Response): Promise<Attestation[] | null> {
		const body = (await response.json().catch(() => null)) as { attestations?: Attestation[]; message?: string } | null;
		if (!response.ok || !body?.attestations) {
			problem = body?.message || 'That did not go through. Try again.';
			return null;
		}
		return body.attestations;
	}

	async function attest(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!section || sending) return;
		sending = true;
		problem = '';
		const response = await fetch(`/workspace/essays/${essay}/attestations`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ role, slug: section.slug, title: section.title, level: section.level, text: section.text, note, shownToReaders })
		}).catch(() => null);
		const updated = response ? await answer(response) : ((problem = 'The site could not be reached. Try again.'), null);
		sending = false;
		if (!updated) return;
		onchange(updated);
		dialog?.close();
	}

	async function setShown(attestation: Attestation, shown: boolean): Promise<void> {
		sending = true;
		problem = '';
		const response = await fetch(`/workspace/essays/${essay}/attestations?attestation=${encodeURIComponent(attestation.identifier)}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ shownToReaders: shown })
		}).catch(() => null);
		const updated = response ? await answer(response) : ((problem = 'The site could not be reached. Try again.'), null);
		sending = false;
		if (updated) onchange(updated);
	}

	async function withdraw(attestation: Attestation): Promise<void> {
		sending = true;
		problem = '';
		const response = await fetch(`/workspace/essays/${essay}/attestations?attestation=${encodeURIComponent(attestation.identifier)}`, {
			method: 'DELETE'
		}).catch(() => null);
		const updated = response ? await answer(response) : ((problem = 'The site could not be reached. Try again.'), null);
		sending = false;
		if (updated) onchange(updated);
	}
</script>

<dialog bind:this={dialog} class="picker" aria-labelledby="attest-heading">
	{#if section}
		<form method="dialog" onsubmit={attest}>
			<h2 id="attest-heading">Attest to “{section.title}”</h2>
			<p class="small">
				You confirm your part in this {kind} as it stands now{section.level === 2 ? ', its subsections included' : ''}. The site keeps a copy of the text you attest to. If the text changes later, your attestation still shows, with its date and a note that the text has changed since, until you attest again.
			</p>
			{#if shown.length}
				<h3 class="small">Attested so far</h3>
				<ul class="attested">
					{#each shown as attestation (attestation.identifier)}
						<li>
							{attestationRoleLabels[attestation.role]} <strong>{attestation.personName}</strong>, {essayDate(attestation.createdAt)}{#if attestation.sectionSha256 !== section.sha256}, text changed since{/if}{#if attestation.note}: “{attestation.note}”{/if}. <span class="muted">{attestation.shownToReaders ? 'Shown to readers' : 'Not shown to readers'}</span>
							{#if attestation.personIdentifier === you}
								<button class="button button-quiet" type="button" disabled={sending} onclick={() => setShown(attestation, !attestation.shownToReaders)}>{attestation.shownToReaders ? 'Hide from readers' : 'Show to readers'}</button>
								<button class="button button-quiet" type="button" disabled={sending} onclick={() => withdraw(attestation)}>Withdraw</button>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
			<fieldset class="field">
				<legend>Your part</legend>
				{#each roles as choice (choice)}
					<label><input type="radio" name="attest-role" value={choice} bind:group={role} disabled={sending} onchange={() => (shownToReaders = namesShownByDefault(yourRole, choice))} /> {attestationRoleChoices[choice]}</label>
				{/each}
				{#if !canWriteOrEdit}<p class="small muted">You can attest that you reviewed it. Writing and editing are attested by people who can edit this essay.</p>{/if}
			</fieldset>
			<label class="field"><input type="checkbox" bind:checked={shownToReaders} disabled={sending} /> Show my name to readers under this {kind} on the published essay</label>
			<p class="small muted">Readers see it only once the published {kind} is the text you attest to now.</p>
			<div class="field">
				<label for="attest-note">Note (optional)</label>
				<input id="attest-note" type="text" maxlength="500" bind:value={note} disabled={sending} placeholder="Checked every citation" />
			</div>
			{#if problem}<p class="field-error" role="alert">{problem}</p>{/if}
			<p class="row">
				<button class="button" type="submit" disabled={sending}>{sending ? 'Sending…' : 'Attest'}</button>
				<button class="button button-quiet" type="button" onclick={() => dialog?.close()}>Cancel</button>
			</p>
		</form>
	{/if}
</dialog>

<style>
	/* The same dialog as the editor's pickers (EssayEditor.svelte). */
	.picker {
		width: min(40rem, 100% - 2 * var(--space-4));
		max-height: 85vh;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-paper);
		color: var(--color-ink);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.attested {
		padding-left: var(--space-4);
		margin: 0 0 var(--space-3);
	}

	.attested li {
		margin-bottom: var(--space-1);
	}

	fieldset {
		border: 0;
		padding: 0;
		margin: 0 0 var(--space-3);
		display: grid;
		gap: var(--space-1);
	}

	legend {
		font-weight: var(--font-weight-semibold);
		margin-bottom: var(--space-1);
	}

	input[type='text'] {
		width: 100%;
	}
</style>
