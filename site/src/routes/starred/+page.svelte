<script lang="ts">
	// The Starred page (site/DESIGN.md, section 6, "Star"): the pages a reader
	// starred, newest first, each with a private note, and a form that makes
	// a link to share some of them (src/lib/shared-collection.ts). Everything
	// is read from and kept in this browser; the page is built ahead of time
	// and the site never sees it. Approved by Trevor on Nov. 21 and 22, 2026
	// (decision record 0032).
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import Link from '@lucide/svelte/icons/link';
	import StarOff from '@lucide/svelte/icons/star-off';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import { onMount, tick } from 'svelte';
	import { sharedCollectionLink, sharedDescriptionLimit, sharedItemsLimit, sharedTitleLimit } from '#lib/shared-collection.ts';
	import {
		loadStarred,
		noteLengthLimit,
		onStarredChange,
		saveStarred,
		setStarredNote,
		starredKindLabels,
		starredKindOf,
		type StarredItem
	} from '#lib/starred-items.ts';

	let items = $state<StarredItem[]>([]);
	let loaded = $state(false);
	let removed = $state<{ item: StarredItem; index: number } | undefined>();
	let removedNotice: HTMLParagraphElement | undefined = $state();
	let listHeading: HTMLHeadingElement | undefined = $state();

	const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

	onMount(() => {
		const refresh = () => {
			// A note being typed is saved before it is read back, so nothing is lost.
			if (pendingNote) return;
			items = loadStarred();
			loaded = true;
		};
		refresh();
		return onStarredChange(refresh);
	});

	function kindLabel(item: StarredItem): string {
		const kind = starredKindOf(item.address);
		return kind ? starredKindLabels[kind] : 'Page';
	}

	function starredDate(item: StarredItem): string {
		return item.starredAt ? `Starred ${dateFormat.format(new Date(item.starredAt))}` : 'Starred';
	}

	// Notes save shortly after the reader stops typing, and when they leave the box.
	let pendingNote: { address: string; text: string } | undefined;
	let noteTimer: ReturnType<typeof setTimeout> | undefined;

	function typeNote(address: string, text: string): void {
		pendingNote = { address, text };
		clearTimeout(noteTimer);
		noteTimer = setTimeout(saveNote, 500);
	}

	function saveNote(): void {
		clearTimeout(noteTimer);
		if (!pendingNote) return;
		const { address, text } = pendingNote;
		pendingNote = undefined;
		items = setStarredNote(loadStarred(), address, text);
		saveStarred(items);
	}

	async function unstar(item: StarredItem): Promise<void> {
		saveNote();
		const current = loadStarred();
		const index = current.findIndex((entry) => entry.address === item.address);
		if (index === -1) return;
		removed = { item: current[index], index };
		items = current.filter((entry) => entry.address !== item.address);
		saveStarred(items);
		chosen = chosen.filter((address) => address !== item.address);
		await tick();
		removedNotice?.focus();
	}

	async function undo(): Promise<void> {
		if (!removed) return;
		const current = loadStarred().filter((entry) => entry.address !== removed?.item.address);
		current.splice(Math.min(removed.index, current.length), 0, removed.item);
		items = current;
		saveStarred(items);
		removed = undefined;
		await tick();
		listHeading?.focus();
	}

	// Sharing: which pages go in the link, its title and description.
	let chosen = $state<string[]>([]);
	let choosing = $state(false);
	let shareTitle = $state('');
	let shareDescription = $state('');
	let shareLink = $state('');
	let shareProblem = $state('');
	let copied = $state(false);
	let linkField: HTMLInputElement | undefined = $state();

	function startSharing(): void {
		chosen = items.slice(0, sharedItemsLimit).map((item) => item.address);
		choosing = true;
	}

	async function makeLink(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		copied = false;
		shareProblem = '';
		if (!shareTitle.trim()) {
			shareProblem = 'Give the collection a title.';
			return;
		}
		if (chosen.length === 0) {
			shareProblem = 'Choose at least one page.';
			return;
		}
		if (chosen.length > sharedItemsLimit) {
			shareProblem = `A link can hold up to ${sharedItemsLimit} pages. Untick ${chosen.length - sharedItemsLimit}.`;
			return;
		}
		const order = items.map((item) => item.address).filter((address) => chosen.includes(address));
		shareLink = sharedCollectionLink(location.origin, { title: shareTitle, description: shareDescription, addresses: order });
		await tick();
		linkField?.focus();
		linkField?.select();
	}

	async function copyLink(): Promise<void> {
		try {
			await navigator.clipboard.writeText(shareLink);
			copied = true;
		} catch {
			linkField?.select();
			shareProblem = 'This browser did not let the page copy. The link is selected; copy it with your keyboard or menu.';
		}
	}
</script>

<svelte:head>
	<title>Starred · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<h1>Starred</h1>
	<p class="lead">
		Pages you star, with your own notes. They are kept in this browser on this device only. Nothing is sent to the site, and
		no account is needed.
	</p>
	<noscript>
		<p class="notice" role="note">Starring needs scripts, which are turned off in this browser.</p>
	</noscript>

	{#if removed}
		<p class="removed notice" role="status" tabindex="-1" bind:this={removedNotice}>
			Removed the star from “{removed.item.title}”{removed.item.note ? ', with your note' : ''}.
			<button class="button button-quiet" type="button" onclick={undo}>
				<Undo2 size={20} strokeWidth={1.75} />
				Undo
			</button>
		</p>
	{/if}

	{#if loaded && items.length === 0}
		<p>
			Nothing is starred yet. Press <strong>Star</strong>, beside Print at the top of a nation’s page, a glossary entry or a
			story, to keep it here.
		</p>
	{:else if loaded}
		<h2 class="visually-hidden" tabindex="-1" bind:this={listHeading}>Your starred pages</h2>
		<p class="muted">
			{items.length === 1 ? 'One page' : `${items.length} pages`}, newest first. Notes save as you type and only you can see
			them. To carry them to another device, use Export in Settings, under Data.
		</p>
		<ol class="starred-list">
			{#each items as item, index (item.address)}
				<li class="starred-item">
					<h3 class="item-title"><a href={item.address}>{item.title}</a></h3>
					<p class="hint item-detail">{kindLabel(item)} · {starredDate(item)}</p>
					<label class="note-label" for="note-{index}">Your note</label>
					<textarea
						id="note-{index}"
						rows="3"
						maxlength={noteLengthLimit}
						value={item.note}
						aria-describedby="note-{index}-hint"
						oninput={(event) => typeNote(item.address, event.currentTarget.value)}
						onblur={saveNote}
					></textarea>
					<p class="hint" id="note-{index}-hint">Up to {noteLengthLimit.toLocaleString('en-US')} characters. Never shared.</p>
					<p class="item-actions">
						<button class="button button-quiet" type="button" onclick={() => unstar(item)}>
							<StarOff size={20} strokeWidth={1.75} />
							Remove star<span class="visually-hidden">: {item.title}</span>
						</button>
					</p>
				</li>
			{/each}
		</ol>

		<h2>Share a collection</h2>
		<p>
			Make a link to some of these pages to send to a classmate, a colleague or a council. The link holds the pages and the
			title you give it, and nothing else: not your name and not your notes. The pages are all public already. A link cannot
			be taken back once sent, and changing your stars later does not change it.
		</p>
		{#if !choosing}
			<p>
				<button class="button button-quiet" type="button" onclick={startSharing}>
					<Link size={20} strokeWidth={1.75} />
					Choose pages to share
				</button>
			</p>
		{:else}
			<form class="share-form" onsubmit={makeLink} novalidate>
				<p class="field">
					<label for="share-title">Title</label>
					<span class="hint" id="share-title-hint">Shown at the top of the shared page, as plain text. Up to {sharedTitleLimit} characters.</span>
					<input
						id="share-title"
						type="text"
						maxlength={sharedTitleLimit}
						bind:value={shareTitle}
						aria-describedby="share-title-hint"
						autocomplete="off"
					/>
				</p>
				<p class="field">
					<label for="share-description">Description <span class="optional">(optional)</span></label>
					<span class="hint" id="share-description-hint">Up to {sharedDescriptionLimit} characters. Copy a note in here only if you want to share it.</span>
					<textarea
						id="share-description"
						rows="3"
						maxlength={sharedDescriptionLimit}
						bind:value={shareDescription}
						aria-describedby="share-description-hint"
					></textarea>
				</p>
				<fieldset class="share-pages">
					<legend>Pages in the link</legend>
					<p class="hint">{chosen.length} of {items.length} chosen. A link holds up to {sharedItemsLimit}.</p>
					{#each items as item, index (item.address)}
						<div class="choice">
							<input type="checkbox" id="share-{index}" value={item.address} bind:group={chosen} />
							<label for="share-{index}">{item.title}</label>
						</div>
					{/each}
				</fieldset>
				{#if shareProblem}<p class="field-error" role="alert">{shareProblem}</p>{/if}
				<p>
					<button class="button" type="submit">
						<Link size={20} strokeWidth={1.75} />
						Make the link
					</button>
				</p>
			</form>
			{#if shareLink}
				<div class="share-result">
					<label for="share-link">Link to share</label>
					<input id="share-link" type="text" readonly value={shareLink} bind:this={linkField} />
					<p class="item-actions">
						<button class="button button-quiet" type="button" onclick={copyLink}>
							{#if copied}<Check size={20} strokeWidth={1.75} />{:else}<Copy size={20} strokeWidth={1.75} />{/if}
							{copied ? 'Copied' : 'Copy the link'}
						</button>
						<a class="button button-quiet" href={shareLink} target="_blank" rel="noopener">
							See what others will see<span class="visually-hidden"> (opens in a new tab)</span>
						</a>
					</p>
					<p class="visually-hidden" role="status">{copied ? 'Link copied.' : ''}</p>
				</div>
			{/if}
		{/if}
	{/if}
</div>

<style>
	.starred-list {
		list-style: none;
		margin: var(--space-4) 0 var(--space-6);
		padding: 0;
	}

	.starred-item {
		padding: var(--space-4) 0;
		border-top: 1px solid var(--color-line);
	}

	.starred-item:last-child {
		border-bottom: 1px solid var(--color-line);
	}

	.item-title {
		margin: 0;
		font-size: var(--font-size-lead);
	}

	.item-detail {
		margin: var(--space-1) 0 var(--space-3);
	}

	.note-label,
	.share-result label,
	.field label {
		display: block;
		font-weight: var(--font-weight-semibold);
	}

	textarea,
	input[type='text'] {
		margin-top: var(--space-1);
	}

	.starred-item .hint {
		margin-top: var(--space-1);
	}

	.item-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin: var(--space-3) 0 0;
	}

	.item-actions .button,
	.removed .button {
		gap: var(--space-2);
	}

	.removed {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}

	.field {
		margin: 0 0 var(--space-4);
	}

	.field .hint {
		display: block;
	}

	.optional {
		font-weight: var(--font-weight-regular);
	}

	.share-pages {
		margin: 0 0 var(--space-4);
		padding: 0;
		border: 0;
	}

	.share-pages legend {
		font-weight: var(--font-weight-semibold);
	}

	.choice {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		margin: var(--space-2) 0;
	}

	.choice input {
		margin-top: 0.3em;
		width: 1.25rem;
		height: 1.25rem;
		flex: none;
		accent-color: var(--color-action);
	}

	.share-form .button,
	.share-result .button {
		gap: var(--space-2);
	}

	.share-result {
		margin: var(--space-4) 0;
	}
</style>
