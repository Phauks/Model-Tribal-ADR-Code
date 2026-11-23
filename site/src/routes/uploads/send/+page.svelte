<script lang="ts">
	// Send files (docs/uploads.md). Files go in the upload table
	// (src/lib/components/FileSender.svelte); the questions, which apply to
	// every file in the batch, sit beside it. A YouTube link can stand in for
	// a video file.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import X from '@lucide/svelte/icons/x';
	import FileSender from '#lib/components/FileSender.svelte';
	import { originLabels, origins, permittedUseLabels, permittedUses, type Origin, type PermittedUse } from '#lib/uploads.ts';
	import { nationNames } from '#lib/nation-names.ts';

	let description = $state('');
	let origin = $state<Origin | ''>('');
	let originNote = $state('');
	let permittedUse = $state<PermittedUse | ''>('');
	let nationFirst = $state(false);
	let underEighteen = $state(false);
	let confirmed = $state(false);
	let nationList = $state<[string, string][]>([]);
	let nationText = $state('');
	let nations = $state<[string, string][]>([]);
	let errors = $state<Record<string, string>>({});

	onMount(async () => {
		// If the list cannot be read, the picker stays empty; nations are optional.
		nationList = [...(await nationNames())];
	});

	function addNation() {
		const typed = nationText.trim().toLocaleLowerCase('en-US');
		const match = nationList.find(([, name]) => name.toLocaleLowerCase('en-US') === typed);
		if (match && !nations.some(([id]) => id === match[0])) nations = [...nations, match];
		if (match) nationText = '';
	}

	function answers() {
		return {
			answers: {
				description,
				origin,
				originNote,
				permittedUse,
				nationFirst,
				underEighteen,
				confirmed,
				nations: nations.map(([id]) => id)
			}
		};
	}

	/** The same checks the server makes, so a missing answer shows before anything is sent. */
	function answered(): boolean {
		const found: Record<string, string> = {};
		if (!description.trim()) found.description = 'Say in a few words what the files are.';
		if (!origin) found.origin = 'Choose where the files came from.';
		if ((origin === 'with-permission' || origin === 'published') && !originNote.trim()) {
			found.originNote = origin === 'published' ? 'Say where they were published.' : 'Say whose permission you have.';
		}
		if (!permittedUse) found.permittedUse = 'Choose how we may use them.';
		if (!confirmed) found.confirmed = 'Confirm that you may send these files.';
		errors = found;
		return Object.keys(found).length === 0;
	}
</script>

<svelte:head>
	<title>Send files · Model Tribal ADR Code</title>
</svelte:head>

<div class="send-page">
	<p class="small"><a href="/uploads">Your uploads</a></p>
	<h1>Send files</h1>
	<p class="lead">
		Documents, pictures, sound recordings or videos that could help the code. We look at each one before anything is used.
	</p>
	<noscript>
		<div class="notice notice-problem"><p>Sending files needs JavaScript, so that large files can be sent in pieces.</p></div>
	</noscript>

	<FileSender
		extra={answers}
		ready={answered}
		refused={(found) => (errors = found)}
		finished={(count) => goto(`/uploads?sent=${count}`)}
		youtube
		sendLabel={(count) => `Send ${count} for review`}
	>
		{#snippet aside()}
			<h2 class="panel-heading">About these files</h2>
			<p class="hint">Your answers apply to every file.</p>

			<div class="field">
				<label for="description">What are they?</label>
				{#if errors.description}<p class="field-error">{errors.description}</p>{/if}
				<textarea
					id="description"
					rows="3"
					placeholder="Rules of the peacemaker court, 1987"
					bind:value={description}
					aria-invalid={errors.description ? 'true' : undefined}
				></textarea>
			</div>

			<div class="field">
				<label for="nation">Which Native nations?</label>
				{#if errors.nations}<p class="field-error">{errors.nations}</p>{/if}
				<div class="picker">
					{#each nations as [id, name] (id)}
						<button
							type="button"
							class="chip chosen"
							aria-label="Remove {name}"
							onclick={() => (nations = nations.filter(([other]) => other !== id))}
						>
							{name} <X size={14} aria-hidden="true" />
						</button>
					{/each}
					<input
						id="nation"
						type="text"
						list="nation-names"
						placeholder="Add a nation"
						autocomplete="off"
						bind:value={nationText}
						oninput={addNation}
						onkeydown={(event) => {
							if (event.key === 'Enter') {
								event.preventDefault();
								addNation();
							}
						}}
					/>
					<datalist id="nation-names">
						{#each nationList as [id, name] (id)}
							<option value={name}></option>
						{/each}
					</datalist>
				</div>
			</div>

			<fieldset class="field">
				<legend>Where did they come from?</legend>
				{#if errors.origin}<p class="field-error">{errors.origin}</p>{/if}
				{#each origins as value (value)}
					<label class="choice"><input type="radio" name="origin" {value} bind:group={origin} /> {originLabels[value]}</label>
				{/each}
			</fieldset>

			{#if origin === 'with-permission' || origin === 'published'}
				<div class="field">
					<label for="origin-note">{origin === 'published' ? 'Where were they published?' : 'Whose permission do you have?'}</label>
					{#if errors.originNote}<p class="field-error">{errors.originNote}</p>{/if}
					<input id="origin-note" type="text" bind:value={originNote} aria-invalid={errors.originNote ? 'true' : undefined} />
				</div>
			{/if}

			<fieldset class="field">
				<legend>How may we use them?</legend>
				{#if errors.permittedUse}<p class="field-error">{errors.permittedUse}</p>{/if}
				{#each permittedUses as value (value)}
					<label class="choice">
						<input type="radio" name="permitted-use" {value} bind:group={permittedUse} />
						{permittedUseLabels[value]}
					</label>
				{/each}
			</fieldset>

			<fieldset class="field">
				<legend>Should any of this stay private?</legend>
				<p class="hint">
					For example ceremonial knowledge, something told only in some seasons or to some people, or a person who did
					not agree to be shown.
				</p>
				<label class="choice"><input type="radio" name="private" value={false} bind:group={nationFirst} /> No</label>
				<label class="choice">
					<input type="radio" name="private" value={true} bind:group={nationFirst} /> Yes, or I am not sure. Ask the nation
					before anyone else sees it.
				</label>
			</fieldset>

			<label class="choice">
				<input type="checkbox" bind:checked={underEighteen} /> I am under 18. Credit me only by a description or a name I
				choose.
			</label>

			{#if errors.confirmed}<p class="field-error">{errors.confirmed}</p>{/if}
			<label class="choice confirm">
				<input type="checkbox" bind:checked={confirmed} /> I may share these files, and what I wrote is true as far as I know.
			</label>
			{#if Object.keys(errors).length > 0}
				<p class="field-error" role="alert">Answer the questions marked above.</p>
			{/if}
		{/snippet}
	</FileSender>

	<p class="small muted footnote">
		Only the project’s reviewers see what you send until it is filed. Your email address is never published. You can
		withdraw a file at any time before it is filed.
	</p>
</div>

<style>
	.send-page {
		max-width: 72rem;
		min-width: 0;
	}
	.panel-heading {
		font-size: var(--font-size-large, 1.25rem);
		margin: 0 0 var(--space-1);
	}
	.picker {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
		border: 2px solid var(--color-control-border);
		border-radius: var(--radius-control);
		padding: var(--space-1) var(--space-2);
		background: var(--color-paper);
	}
	.picker input {
		border: 0;
		flex: 1;
		min-width: 8rem;
		width: auto;
	}
	.chosen {
		color: var(--color-ink);
		display: inline-flex;
		gap: 4px;
		align-items: center;
		background: var(--color-surface);
		cursor: pointer;
		font: inherit;
		font-size: var(--font-size-small);
	}
	fieldset.field {
		border: 0;
		padding: 0;
	}
	.choice {
		display: flex;
		gap: var(--space-2);
		align-items: baseline;
		margin: var(--space-1) 0;
		font-weight: normal;
	}
	.confirm {
		margin: var(--space-4) 0 var(--space-2);
		font-weight: var(--font-weight-semibold);
	}
	.footnote {
		margin-top: var(--space-5);
	}
</style>
