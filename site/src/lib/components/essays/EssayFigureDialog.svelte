<!--
	Adds a picture, video or sound recording to an essay (src/lib/essays/
	figures.ts). A file is sent through the shared upload path in pieces, with
	a progress bar; a video can instead be a YouTube link. The caption,
	description, credit and transcript become the figure's text in the essay,
	where they can be edited like any other text.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { figureKindFor, figureKindLabels, figureSource, type FigureKind, type NewFigure } from '#lib/essays/figures.ts';
	import { sendFigureFile, type SendProgress } from '#lib/essays/figure-upload.ts';
	import { readableSize } from '#lib/uploads.ts';


	let { essay, onadd }: { essay: string; onadd: (figure: NewFigure) => void } = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let from = $state<'file' | 'youtube'>('file');
	let file = $state<File | null>(null);
	let youtubeLink = $state('');
	let caption = $state('');
	let description = $state('');
	let credit = $state('');
	let transcript = $state('');
	let problem = $state('');
	let progress = $state<SendProgress | null>(null);
	let sending = $state(false);
	let stop: AbortController | null = null;

	const kind = $derived<FigureKind | undefined>(from === 'youtube' ? 'video' : file ? figureKindFor(file.type) : undefined);

	/** Opens the dialog empty. */
	export async function show(): Promise<void> {
		from = 'file';
		file = null;
		youtubeLink = '';
		caption = description = credit = transcript = problem = '';
		progress = null;
		sending = false;
		await tick();
		dialog?.showModal();
	}

	function close(): void {
		stop?.abort();
		stop = null;
		dialog?.close();
	}

	async function add(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		problem = '';
		if (!kind) {
			problem = from === 'file' ? 'Choose a picture, a video or a sound recording.' : 'Paste a link to a YouTube video.';
			return;
		}
		let address = '';
		if (from === 'youtube') {
			const source = figureSource('video', youtubeLink);
			if (!source) {
				problem = 'That is not a link to one YouTube video.';
				return;
			}
			address = source.address;
		} else if (file) {
			sending = true;
			stop = new AbortController();
			try {
				address = await sendFigureFile(file, essay, (now) => (progress = now), stop.signal);
			} catch (failure) {
				if ((failure as Error).name !== 'AbortError') problem = (failure as Error).message;
				sending = false;
				return;
			}
			sending = false;
		}
		onadd({ kind, address, caption: caption.trim(), description: description.trim(), credit: credit.trim(), transcript: transcript.trim() });
		stop = null;
		dialog?.close();
	}
</script>

<dialog bind:this={dialog} class="picker" aria-labelledby="figure-heading" onclose={() => stop?.abort()}>
	<form method="dialog" onsubmit={add}>
		<h2 id="figure-heading">Add a picture, video or recording</h2>
		<fieldset class="field">
			<legend>What to add</legend>
			<label><input type="radio" name="figure-from" value="file" bind:group={from} disabled={sending} /> A file from this device</label>
			<label><input type="radio" name="figure-from" value="youtube" bind:group={from} disabled={sending} /> A YouTube video</label>
		</fieldset>
		{#if from === 'file'}
			<div class="field">
				<label for="figure-file">Picture, video or sound recording</label>
				<input
					id="figure-file"
					type="file"
					accept="image/*,video/*,audio/*"
					disabled={sending}
					onchange={(event) => (file = event.currentTarget.files?.[0] ?? null)}
				/>
				{#if file}<p class="small muted">{kind ? figureKindLabels[kind] : 'Not a picture, video or recording'}, {readableSize(file.size)}. It is kept in the project's own storage and shown only with this essay.</p>{/if}
			</div>
		{:else}
			<div class="field">
				<label for="figure-youtube">YouTube link</label>
				<input id="figure-youtube" type="url" bind:value={youtubeLink} placeholder="https://www.youtube.com/watch?v=" disabled={sending} />
				<p class="small muted">Readers see a still frame; YouTube's player loads only when someone presses play.</p>
			</div>
		{/if}
		<div class="field">
			<label for="figure-caption">Caption</label>
			<textarea id="figure-caption" rows="2" bind:value={caption} required disabled={sending}></textarea>
		</div>
		{#if kind !== 'sound'}
			<div class="field">
				<label for="figure-description">Description, read aloud in place of the {kind === 'video' ? 'video' : 'picture'}</label>
				<textarea id="figure-description" rows="2" bind:value={description} disabled={sending}></textarea>
			</div>
		{/if}
		<div class="field">
			<label for="figure-credit">Credit (who made it)</label>
			<input id="figure-credit" type="text" bind:value={credit} placeholder="Photo by" disabled={sending} />
		</div>
		{#if kind === 'video' || kind === 'sound'}
			<div class="field">
				<label for="figure-transcript">Transcript (what is said; can be added later)</label>
				<textarea id="figure-transcript" rows="4" bind:value={transcript} disabled={sending}></textarea>
			</div>
		{/if}
		{#if progress && sending}
			<label class="small" for="figure-progress">Sending {readableSize(progress.sentBytes) || '0 KB'} of {readableSize(progress.totalBytes)}</label>
			<progress id="figure-progress" max={progress.totalBytes} value={progress.sentBytes}></progress>
		{/if}
		{#if problem}<p class="field-error" role="alert">{problem}</p>{/if}
		<p class="row">
			<button class="button" type="submit" disabled={sending}>{sending ? 'Sending…' : 'Add'}</button>
			<button class="button button-quiet" type="button" onclick={close}>Cancel</button>
		</p>
	</form>
</dialog>

<style>
	/* The same dialog as the editor's pickers (EssayEditor.svelte). */
	.picker {
		width: min(var(--layout-panel), 100% - 2 * var(--space-4));
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

	textarea {
		width: 100%;
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

	progress {
		display: block;
		width: 100%;
	}
</style>
