<script lang="ts">
	// "Save this page on this device" (site/DESIGN.md, section 10): an icon button in the masthead, after Star, on every
	// page the reader can save for offline reading. It is a toggle (aria-pressed): pressed, the page is among what the
	// reader chose to save, alone or as part of a whole part or group they chose, which the Read offline page lists.
	// Laws, cases and biographies are saved one page at a time this way (Trevor, Nov. 26, 2026). Without scripts, or
	// before the service worker controls the page, the button is hidden.
	import HardDriveDownload from '@lucide/svelte/icons/hard-drive-download';
	import { page } from '$app/state';
	import { applyChoices, controllingWorker, pageChoice } from '#lib/offline-saving.ts';
	import type { PageChoice } from '#lib/offline-choices.ts';
	import { sendProblem } from '#lib/problem-reports.ts';

	const address = $derived(page.url.pathname);
	let choice = $state<PageChoice | undefined>();
	let working = $state(false);
	let message = $state('');
	const pressed = $derived(choice?.chosen === true);

	$effect(() => {
		const asked = address;
		message = '';
		choice = undefined;
		if (!controllingWorker() || page.status !== 200) return;
		void pageChoice(asked)
			.then((answer) => {
				if (asked === page.url.pathname) choice = answer;
			})
			.catch((problem) => sendProblem(problem, { code: 'offline.page-choice' }));
	});

	async function toggle(): Promise<void> {
		if (!choice || working) return;
		const saving = !choice.chosen;
		working = true;
		message = saving ? 'Saving this page on this device.' : '';
		try {
			await applyChoices([{ key: choice.path, kind: 'page', save: saving }], {
				onDone: () => {
					message = 'Saved on this device. The Read offline page lists what you saved.';
				},
				onFailed: () => {
					message = 'The page could not be saved. Try again once you are online.';
				}
			});
			choice = await pageChoice(address);
			if (!saving) message = 'Removed from this device.';
			else if (!choice.chosen) message = 'This page cannot be saved on its own.';
		} catch (problem) {
			sendProblem(problem, { code: 'offline.save-page' });
			message = 'The page could not be saved. Try again once you are online.';
		} finally {
			working = false;
		}
	}
</script>

{#if choice?.known}
	<button
		class="icon-button needs-scripts save-offline"
		type="button"
		aria-pressed={pressed}
		aria-label="Save this page on this device"
		title={pressed ? 'Saved on this device. Press to remove' : 'Save this page on this device'}
		disabled={working || (!pressed && typeof navigator !== 'undefined' && !navigator.onLine)}
		onclick={toggle}
	>
		<HardDriveDownload size={24} />
	</button>
	<span class="visually-hidden" role="status">{message}</span>
{/if}

<style>
	.save-offline[aria-pressed='true'] {
		background: var(--color-band-text);
		color: var(--color-band);
	}

	.save-offline:disabled {
		opacity: 0.6;
	}
</style>
