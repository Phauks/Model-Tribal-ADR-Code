<script lang="ts">
	// Send files (docs/uploads.md). The browser sends each file in pieces of
	// 10 MB, one after another, so a large video can stop and pick up where
	// it left off; the server checks each piece and says if a file cannot be
	// accepted. A YouTube link can stand in for a video file.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import AudioLines from '@lucide/svelte/icons/audio-lines';
	import FileText from '@lucide/svelte/icons/file-text';
	import Film from '@lucide/svelte/icons/film';
	import Image from '@lucide/svelte/icons/image';
	import Upload from '@lucide/svelte/icons/upload';
	import X from '@lucide/svelte/icons/x';
	import {
		filesAtOnce,
		largestFileBytes,
		originLabels,
		origins,
		permittedUseLabels,
		permittedUses,
		readableSize,
		type Origin,
		type PermittedUse
	} from '#lib/uploads.ts';
	import { nationNames } from '#lib/nation-names.ts';
	import { youtubeVideoIdentifier } from '#lib/video-links.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type FileState = 'waiting' | 'sending' | 'sent' | 'refused' | 'stopped';

	interface ChosenFile {
		key: number;
		file: File;
		state: FileState;
		/** 0 to 1. */
		progress: number;
		message: string;
	}

	interface ChosenLink {
		key: number;
		link: string;
		state: 'waiting' | 'sent' | 'refused';
		message: string;
	}

	let files = $state<ChosenFile[]>([]);
	let links = $state<ChosenLink[]>([]);
	let nextKey = 0;
	let linkText = $state('');
	let linkProblem = $state('');
	let dragging = $state(false);
	let fileInput: HTMLInputElement | undefined = $state();

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
	let problem = $state('');
	let sending = $state(false);

	onMount(async () => {
		// If the list cannot be read, the picker stays empty; nations are optional.
		nationList = [...(await nationNames())];
	});

	function addFiles(list: FileList | null) {
		if (!list) return;
		const room = filesAtOnce - files.length;
		const added = [...list].slice(0, Math.max(0, room));
		files = [
			...files,
			...added.map((file) => ({ key: nextKey++, file, state: 'waiting' as FileState, progress: 0, message: '' }))
		];
		problem = list.length > added.length ? `You can send ${filesAtOnce} files at a time. Send the rest next.` : '';
		if (fileInput) fileInput.value = '';
	}

	function addLink() {
		if (!youtubeVideoIdentifier(linkText)) {
			linkProblem = 'That is not a link to a YouTube video. Copy the address of the video’s page.';
			return;
		}
		links = [...links, { key: nextKey++, link: linkText.trim(), state: 'waiting', message: '' }];
		linkText = '';
		linkProblem = '';
	}

	function addNation() {
		const typed = nationText.trim().toLocaleLowerCase('en-US');
		const match = nationList.find(([, name]) => name.toLocaleLowerCase('en-US') === typed);
		if (match && !nations.some(([id]) => id === match[0])) nations = [...nations, match];
		if (match) nationText = '';
	}

	function iconFor(file: File) {
		if (file.type.startsWith('image/')) return Image;
		if (file.type.startsWith('audio/')) return AudioLines;
		if (file.type.startsWith('video/')) return Film;
		return FileText;
	}

	function stateText(chosen: ChosenFile): string {
		if (chosen.state === 'waiting') return 'Ready to send';
		if (chosen.state === 'sending') return `Sending, ${Math.floor(chosen.progress * 100)}%. Keep this page open.`;
		if (chosen.state === 'sent') return 'Sent';
		if (chosen.state === 'refused') return chosen.message;
		return `${chosen.message} Choose the same file again to pick up where it stopped.`;
	}

	function answers() {
		return {
			description,
			origin,
			originNote,
			permittedUse,
			nationFirst,
			underEighteen,
			confirmed,
			nations: nations.map(([id]) => id)
		};
	}

	async function post(address: string, body: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
		const response = await fetch(address, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		const data = (await response.json().catch(() => ({ message: response.statusText }))) as Record<string, unknown>;
		return { ok: response.ok, status: response.status, data };
	}

	/** Sends one piece, trying again twice if the connection drops. */
	async function sendPiece(reference: string, number: number, piece: Blob): Promise<Response> {
		for (let attempt = 1; ; attempt++) {
			try {
				return await fetch(`/uploads/pieces/${reference}/${number}`, { method: 'PUT', body: piece });
			} catch (problem) {
				if (attempt >= 3) throw problem;
				await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
			}
		}
	}

	async function sendFile(chosen: ChosenFile, groupIdentifier: string): Promise<boolean> {
		chosen.state = 'sending';
		const started = await post('/uploads/pieces', {
			fileName: chosen.file.name,
			sizeBytes: chosen.file.size,
			groupIdentifier,
			answers: answers()
		});
		if (!started.ok) {
			if (started.data.errors) {
				errors = started.data.errors as Record<string, string>;
				chosen.state = 'waiting';
				return false;
			}
			chosen.state = started.status === 413 ? 'refused' : 'stopped';
			chosen.message = String(started.data.message ?? 'It could not be sent.');
			return false;
		}
		const reference = String(started.data.reference);
		const size = Number(started.data.pieceBytes);
		const count = Number(started.data.pieceCount);
		const received = new Set(started.data.received as number[]);
		chosen.progress = received.size / count;
		for (let number = 1; number <= count; number++) {
			if (received.has(number)) continue;
			const piece = chosen.file.slice((number - 1) * size, Math.min(number * size, chosen.file.size));
			let response: Response;
			try {
				response = await sendPiece(reference, number, piece);
			} catch {
				chosen.state = 'stopped';
				chosen.message = 'The connection dropped.';
				return false;
			}
			if (response.status === 422) {
				const outcome = (await response.json()) as { reason: string };
				chosen.state = 'refused';
				chosen.message = outcome.reason;
				return false;
			}
			if (!response.ok) {
				const outcome = (await response.json().catch(() => ({}))) as { message?: string };
				chosen.state = 'stopped';
				chosen.message = outcome.message ?? 'It stopped.';
				return false;
			}
			received.add(number);
			chosen.progress = received.size / count;
		}
		const finished = await post(`/uploads/pieces/${reference}/finish`, {});
		if (!finished.ok) {
			chosen.state = 'stopped';
			chosen.message = String(finished.data.message ?? 'It could not be finished.');
			return false;
		}
		chosen.state = 'sent';
		chosen.progress = 1;
		return true;
	}

	async function send(event: SubmitEvent) {
		event.preventDefault();
		errors = {};
		problem = '';
		if (files.length + links.length === 0) {
			problem = 'Choose at least one file, or add a YouTube link.';
			return;
		}
		sending = true;
		const groupIdentifier = crypto.randomUUID();
		let allSent = true;
		try {
			for (const chosen of links.filter((link) => link.state === 'waiting')) {
				const added = await post('/uploads/links', { link: chosen.link, groupIdentifier, answers: answers() });
				if (added.data.errors) {
					errors = added.data.errors as Record<string, string>;
					return;
				}
				chosen.state = added.ok ? 'sent' : 'refused';
				chosen.message = added.ok ? '' : String(added.data.message ?? 'It could not be added.');
				allSent &&= added.ok;
			}
			for (const chosen of files.filter((file) => file.state === 'waiting' || file.state === 'stopped')) {
				const sent = await sendFile(chosen, groupIdentifier);
				if (Object.keys(errors).length > 0) return;
				allSent &&= sent;
			}
		} catch {
			problem = 'Something went wrong while sending. Check your connection and press Send again.';
			return;
		} finally {
			sending = false;
		}
		if (allSent) await goto(`/uploads?sent=${files.length + links.length}`);
		else problem = 'Some files were not sent. See the note under each one. The others are on Your uploads.';
	}
</script>

<svelte:head>
	<title>Send files · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<p class="small"><a href="/uploads">Your uploads</a></p>
	<h1>Send files</h1>
	<p class="lead">
		Send documents, pictures, sound recordings or videos that could help the code. We look at each one
		before anything is used, and you can follow it on <a href="/uploads">Your uploads</a>.
	</p>
	<noscript>
		<div class="notice notice-problem"><p>Sending files needs JavaScript, so that large files can be sent in pieces.</p></div>
	</noscript>

	<form onsubmit={send} novalidate>
		<div
			class="drop"
			class:dragging
			role="group"
			aria-label="Choose files"
			ondragover={(event) => {
				event.preventDefault();
				dragging = true;
			}}
			ondragleave={() => (dragging = false)}
			ondrop={(event) => {
				event.preventDefault();
				dragging = false;
				addFiles(event.dataTransfer?.files ?? null);
			}}
		>
			<Upload size={28} aria-hidden="true" />
			<p>
				<strong>Drag files here</strong> or
				<label class="button button-quiet choose">
					Choose files
					<input
						bind:this={fileInput}
						class="visually-hidden"
						type="file"
						multiple
						onchange={(event) => addFiles(event.currentTarget.files)}
					/>
				</label>
			</p>
			<p class="hint">
				Documents (PDF, Word, OpenDocument, Excel, text, CSV) up to {readableSize(largestFileBytes.document)}.
				Pictures up to {readableSize(largestFileBytes.picture)}. Sound recordings up to {readableSize(largestFileBytes.sound)}.
				Videos (MP4, MOV, WebM) up to {readableSize(largestFileBytes.video)}. Up to {filesAtOnce} files at a time{#if data.filesPerDay},
					and {data.filesPerDay} a day{/if}.
			</p>
		</div>

		{#if files.length + links.length > 0}
			<ul class="files">
				{#each files as chosen (chosen.key)}
					{@const Icon = iconFor(chosen.file)}
					<li>
						<span class="kind"><Icon size={20} aria-hidden="true" /></span>
						<div>
							<strong>{chosen.file.name}</strong>
							<span class="small muted">{readableSize(chosen.file.size)}</span>
							{#if chosen.state === 'sending' || chosen.state === 'sent'}
								<span class="bar" aria-hidden="true"><span style:width="{Math.floor(chosen.progress * 100)}%"></span></span>
							{/if}
							<span class="small" class:problem-text={chosen.state === 'refused' || chosen.state === 'stopped'} aria-live="polite">
								{stateText(chosen)}
							</span>
						</div>
						{#if chosen.state === 'waiting' && !sending}
							<button
								class="icon-button"
								type="button"
								aria-label="Remove {chosen.file.name}"
								onclick={() => (files = files.filter((file) => file !== chosen))}
							>
								<X size={18} />
							</button>
						{/if}
					</li>
				{/each}
				{#each links as chosen (chosen.key)}
					<li>
						<span class="kind"><Film size={20} aria-hidden="true" /></span>
						<div>
							<strong>{chosen.link}</strong>
							<span class="small muted">YouTube video</span>
							<span class="small" class:problem-text={chosen.state === 'refused'}>
								{chosen.state === 'sent' ? 'Sent' : chosen.state === 'refused' ? chosen.message : 'Ready to send'}
							</span>
						</div>
						{#if chosen.state === 'waiting' && !sending}
							<button
								class="icon-button"
								type="button"
								aria-label="Remove the link"
								onclick={() => (links = links.filter((link) => link !== chosen))}
							>
								<X size={18} />
							</button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

		<div class="field">
			<label for="youtube">Or add a YouTube video</label>
			<p class="hint">Paste the address of the video’s page. We look at it like any file.</p>
			{#if linkProblem}<p class="field-error">{linkProblem}</p>{/if}
			<div class="inline">
				<input
					id="youtube"
					type="text"
					inputmode="url"
					placeholder="https://www.youtube.com/watch?v=…"
					bind:value={linkText}
					aria-invalid={linkProblem ? 'true' : undefined}
					onkeydown={(event) => {
						if (event.key === 'Enter') {
							event.preventDefault();
							addLink();
						}
					}}
				/>
				<button class="button button-quiet" type="button" onclick={addLink}>Add</button>
			</div>
		</div>

		<h2>About these files</h2>
		<p class="hint">Your answers apply to every file above.</p>

		<div class="field">
			<label for="description">What are they?</label>
			<p class="hint">A few words, such as “Rules of the peacemaker court, 1987, and a photo of the chapter house where it met”.</p>
			{#if errors.description}<p class="field-error">{errors.description}</p>{/if}
			<textarea id="description" rows="3" bind:value={description} aria-invalid={errors.description ? 'true' : undefined}></textarea>
		</div>

		<div class="field">
			<label for="nation">Which Native nations are they about?</label>
			<p class="hint">Optional. Start typing a name and choose it from the list.</p>
			{#if errors.nations}<p class="field-error">{errors.nations}</p>{/if}
			<div class="picker">
				{#each nations as [id, name] (id)}
					<button
						type="button"
						class="chip chosen"
						aria-label="Remove {name}"
						onclick={() => (nations = nations.filter(([chosen]) => chosen !== id))}
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
				<label class="choice"><input type="radio" name="permitted-use" {value} bind:group={permittedUse} /> {permittedUseLabels[value]}</label>
			{/each}
		</fieldset>

		<fieldset class="field">
			<legend>Should any of this stay private?</legend>
			<p class="hint">
				For example ceremonial knowledge, something told only in some seasons or to some people, or a person who
				did not agree to be shown.
			</p>
			<label class="choice"><input type="radio" name="private" value={false} bind:group={nationFirst} /> No</label>
			<label class="choice">
				<input type="radio" name="private" value={true} bind:group={nationFirst} /> Yes, or I am not sure. Ask the nation
				before anyone else sees it.
			</label>
		</fieldset>

		<label class="choice">
			<input type="checkbox" bind:checked={underEighteen} /> I am under 18. We then credit you only by a description or a
			name you choose.
		</label>

		{#if errors.confirmed}<p class="field-error">{errors.confirmed}</p>{/if}
		<label class="choice confirm">
			<input type="checkbox" bind:checked={confirmed} /> I may share these files, and what I wrote is true as far as I know.
		</label>

		{#if problem}
			<div class="notice notice-problem" role="alert"><p>{problem}</p></div>
		{:else if Object.keys(errors).length > 0}
			<div class="notice notice-problem" role="alert"><p>Answer the questions marked above.</p></div>
		{/if}

		<p><button class="button" type="submit" disabled={sending}>{sending ? 'Sending…' : 'Send for review'}</button></p>
		<p class="small muted">
			Only the project’s reviewers see what you send until it is filed. Your email address is never published. You
			can withdraw a file at any time before it is filed.
		</p>
	</form>
</div>

<style>
	.drop {
		border: 2px dashed var(--color-control-border);
		border-radius: var(--radius-panel);
		padding: var(--space-5);
		text-align: center;
		background: var(--color-surface);
		margin-bottom: var(--space-4);
	}
	.drop.dragging {
		border-color: var(--color-link);
	}
	.drop p {
		margin: var(--space-2) 0;
	}
	.choose {
		cursor: pointer;
	}
	.choose:focus-within {
		outline: 3px solid var(--color-focus-ring);
		outline-offset: 2px;
	}
	.files {
		list-style: none;
		padding: 0;
		margin: 0 0 var(--space-5);
	}
	.files li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: var(--space-3);
		align-items: start;
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--color-line);
	}
	.files li > div {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.files strong {
		overflow-wrap: anywhere;
	}
	.kind {
		color: var(--color-link);
		padding-top: 2px;
	}
	.bar {
		display: block;
		height: 6px;
		border-radius: 3px;
		background: var(--color-line);
		margin: var(--space-1) 0;
	}
	.bar > span {
		display: block;
		height: 100%;
		border-radius: 3px;
		background: var(--color-link);
	}
	.problem-text {
		color: var(--color-danger);
	}
	.inline {
		display: flex;
		gap: var(--space-2);
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
		min-width: 10rem;
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
		margin: var(--space-4) 0;
		font-weight: var(--font-weight-semibold);
	}
</style>
