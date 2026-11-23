<script lang="ts">
	/**
	 * A link shown once for someone to copy and send on, such as a video
	 * room's invite link: the whole address, selectable, with a copy button
	 * that says when it worked.
	 */
	import Copy from '@lucide/svelte/icons/copy';

	let { link, label }: { link: string; label: string } = $props();

	const id = `copy-${Math.random().toString(36).slice(2, 10)}`;
	let copied = $state('');

	async function copy() {
		try {
			await navigator.clipboard.writeText(link);
			copied = 'Copied.';
		} catch {
			copied = 'Could not copy. Select the link and copy it yourself.';
		}
	}
</script>

<div class="field copy-link">
	<label for={id}>{label}</label>
	<div class="row">
		<input type="text" id={id} value={link} readonly onfocus={(event) => event.currentTarget.select()} />
		<button class="button button-quiet" type="button" onclick={copy}><Copy size={18} strokeWidth={1.75} /> Copy</button>
	</div>
	<p class="hint" role="status">{copied}</p>
</div>

<style>
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.row input {
		flex: 1 1 20rem;
		min-width: 0;
	}

	.button {
		gap: var(--space-2);
	}
</style>
