<script lang="ts">
	// "New essay": a plus button beside a section's name, in the sidebar and on
	// the section's page, that starts an essay in that section and opens it in
	// Editing (essay-editor-mockups/4 and v2-1). It replaces the form on
	// Workspace › Essays, which was removed (lead author, Nov. 23, 2026).
	import Plus from '@lucide/svelte/icons/plus';
	import Modal from '#lib/components/Modal.svelte';
	import { sendJson } from '#lib/send-json.ts';

	let { part, sectionLabel, size = 20, compact = false }: { part: string; sectionLabel: string; size?: number; /** Smaller, beside the section's name in the sidebar, as in the mockups. */ compact?: boolean } = $props();

	let dialog: Modal<string> | undefined = $state();
	let title = $state('');
	let address = $state('');
	let addressTouched = false;
	let problem = $state('');
	let busy = $state(false);
	const formId = $props.id();

	// The address follows the title until the writer changes it.
	function fromTitle(text: string): string {
		return text
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 80);
	}

	async function start(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		busy = true;
		problem = '';
		const sent = await sendJson<{ link: string }>(
			'/workspace/essays/new',
			'POST',
			{ title, part, identifier: address },
			{ complete: (answer) => !!answer.link, headers: { accept: 'application/json' } }
		);
		busy = false;
		if (!sent.ok) {
			problem = sent.problem;
			return;
		}
		location.href = `${sent.answer.link}?edit`;
	}
</script>

<button class="icon-button new-essay" class:compact type="button" aria-haspopup="dialog" title="New essay in {sectionLabel}" aria-label="New essay in {sectionLabel}" onclick={() => dialog?.open()}>
	<Plus {size} aria-hidden="true" />
</button>

<Modal bind:this={dialog} title="New essay in {sectionLabel}" fitContent>
	<form id="new-essay-{formId}" onsubmit={start}>
		{#if problem}<div class="notice notice-problem" role="alert"><p>{problem}</p></div>{/if}
		<div class="field">
			<label for="new-essay-title-{formId}">Title</label>
			<input
				type="text"
				id="new-essay-title-{formId}"
				required
				maxlength="300"
				bind:value={title}
				oninput={() => {
					if (!addressTouched) address = fromTitle(title);
				}}
			/>
		</div>
		<div class="field">
			<label for="new-essay-address-{formId}">Address</label>
			<p class="hint" id="new-essay-address-hint-{formId}">Lower-case words joined by hyphens. It becomes the page’s address and cannot be changed later.</p>
			<input
				type="text"
				id="new-essay-address-{formId}"
				required
				pattern="[a-z0-9]+(-[a-z0-9]+)*"
				aria-describedby="new-essay-address-hint-{formId}"
				bind:value={address}
				oninput={() => (addressTouched = true)}
			/>
		</div>
	</form>
	{#snippet actions()}
		<button class="button" type="submit" form="new-essay-{formId}" disabled={busy}>Start the essay</button>
		<button class="button button-quiet" type="button" onclick={() => dialog?.close()}>Cancel</button>
	{/snippet}
</Modal>

<style>
	/* A square with a rule, as beside Essays in the mockups. */
	.new-essay {
		flex: none;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		color: var(--color-ink);
	}

	.new-essay.compact {
		width: 2rem;
		height: 2rem;
		min-width: 0;
		min-height: 0;
	}
</style>
