<!--
	Chooses a profile picture (docs/contributor-profiles.md, "Profile pictures").
	In the browser the picture is cropped to a square from its middle and made
	into a 400 by 400 JPEG before it is sent, so the original photo, with its
	camera details and location, never leaves the device. Without scripts the
	file is sent as it is, and the server accepts it only if it is a small JPEG.
-->
<script lang="ts">
	import { onMount } from 'svelte';

	let {
		side = 400,
		describedBy
	}: {
		/** Pixels on each side of the picture made in the browser. */
		side?: number;
		describedBy?: string;
	} = $props();

	let input: HTMLInputElement | undefined = $state();
	let preview: string | null = $state(null);
	let problem: string | null = $state(null);
	let preparing = $state(false);
	let ready = $state(false);

	onMount(() => {
		ready = typeof createImageBitmap === 'function' && typeof DataTransfer === 'function';
		return () => {
			if (preview) URL.revokeObjectURL(preview);
		};
	});

	async function prepare() {
		const file = input?.files?.[0];
		problem = null;
		if (!ready || !input || !file) return;
		preparing = true;
		try {
			// Browsers turn the picture the right way up from its camera details here.
			const bitmap = await createImageBitmap(file);
			const crop = Math.min(bitmap.width, bitmap.height);
			const canvas = document.createElement('canvas');
			canvas.width = side;
			canvas.height = side;
			const context = canvas.getContext('2d');
			if (!context) throw new Error('No canvas');
			// A transparent picture gets a white background, as a JPEG cannot be transparent.
			context.fillStyle = 'white';
			context.fillRect(0, 0, side, side);
			context.imageSmoothingQuality = 'high';
			context.drawImage(bitmap, (bitmap.width - crop) / 2, (bitmap.height - crop) / 2, crop, crop, 0, 0, side, side);
			bitmap.close();
			const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
			if (!blob) throw new Error('No picture');
			const transfer = new DataTransfer();
			transfer.items.add(new File([blob], 'picture.jpg', { type: 'image/jpeg' }));
			input.files = transfer.files;
			if (preview) URL.revokeObjectURL(preview);
			preview = URL.createObjectURL(blob);
		} catch {
			input.value = '';
			problem = 'This file could not be opened as a picture. Choose a photo or picture file.';
		} finally {
			preparing = false;
		}
	}
</script>

<div class="picker">
	<input
		bind:this={input}
		id="picture"
		name="picture"
		type="file"
		accept="image/*"
		required
		aria-describedby={describedBy}
		onchange={prepare}
	/>
	{#if preparing}<p class="small muted" role="status">Preparing the picture…</p>{/if}
	{#if problem}<p class="field-error" role="alert"><span class="visually-hidden">Error:</span> {problem}</p>{/if}
	{#if preview}
		<div class="preview">
			<img src={preview} alt="Preview, as it will be shown" width="96" height="96" />
			<p class="small muted">This is how it will look.</p>
		</div>
	{/if}
</div>

<style>
	.preview {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin-top: var(--space-2);
	}

	.preview img {
		width: 6rem;
		height: 6rem;
		border-radius: 50%;
		object-fit: cover;
	}
</style>
