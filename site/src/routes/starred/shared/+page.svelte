<script lang="ts">
	// A shared collection (site/DESIGN.md, section 6, "Star"; decision record
	// 0032). The list is in the link after "#", which never reaches the server,
	// so this page is built ahead of time and reads the link in the browser
	// (src/lib/shared-collection.ts). The title and description are a
	// reader's words, so they are shown as plain text under the label "A
	// reader's collection, shared by link." Each page's name comes
	// from the site's own search index, not from the link, so a link cannot
	// put other words on the site. The whole site is kept out of search
	// engines (noindex in the layout).
	import Info from '@lucide/svelte/icons/info';
	import Star from '@lucide/svelte/icons/star';
	import { onMount } from 'svelte';
	import { decodeSharedCollection, type SharedCollection } from '#lib/shared-collection.ts';
	import { loadSearchIndex } from '#lib/site-search.ts';
	import {
		loadStarred,
		mergeStarred,
		saveStarred,
		starredKindLabels,
		starredKindOf,
		type StarredItem
	} from '#lib/starred-items.ts';

	type Entry = { address: string; title: string; kind: string; detail?: string };

	let status = $state<'reading' | 'shown' | 'unreadable'>('reading');
	let collection = $state<SharedCollection | undefined>();
	let entries = $state<Entry[]>([]);
	let message = $state('');

	const heading = $derived(collection?.title || 'A shared collection');

	async function read(): Promise<void> {
		message = '';
		collection = decodeSharedCollection(location.hash);
		if (!collection) {
			status = 'unreadable';
			return;
		}
		const names = new Map<string, { title: string; detail?: string }>();
		try {
			for (const entry of await loadSearchIndex()) names.set(entry.link, { title: entry.title, detail: entry.detail });
		} catch {
			// Offline with no saved index: the pages show by their addresses.
		}
		entries = collection.addresses.map((address) => {
			const kind = starredKindOf(address);
			const known = names.get(address);
			return {
				address,
				title: known?.title ?? address,
				kind: kind ? starredKindLabels[kind] : 'Page',
				detail: known?.detail
			};
		});
		status = 'shown';
	}

	onMount(() => {
		read();
		window.addEventListener('hashchange', read);
		return () => window.removeEventListener('hashchange', read);
	});

	function starAll(): void {
		const now = new Date().toISOString();
		const incoming: StarredItem[] = entries.map((entry) => ({ address: entry.address, title: entry.title, starredAt: now, note: '' }));
		const own = loadStarred();
		const added = incoming.filter((item) => !own.some((entry) => entry.address === item.address)).length;
		const kept = saveStarred(mergeStarred(own, incoming));
		if (!kept) message = 'This browser is not keeping data for this site, so the pages could not be starred.';
		else if (added === 0) message = 'You had already starred every page here.';
		else message = `Starred ${added === 1 ? 'one page' : `${added} pages`}. ${added === incoming.length ? '' : 'The others were already starred. '}They are on your Starred page.`;
	}
</script>

<svelte:head>
	<title>{collection?.title ? `${collection.title} · ` : ''}Shared collection · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<h1>{heading}</h1>
	<p class="made-by" role="note">
		<Info size={20} strokeWidth={1.75} />
		<span>A reader’s collection, shared by link.</span>
	</p>
	<noscript>
		<p class="notice" role="note">This page reads the collection from its link with a script, and scripts are turned off in this browser.</p>
	</noscript>

	{#if status === 'unreadable'}
		<div class="notice notice-problem" role="note">
			<p>
				This link does not hold a collection this site can read. It may have been cut short when it was copied; ask the person
				who sent it to copy it again. You can still <a href="/nations">browse the nations</a> or
				<a href="/glossary">the glossary</a>.
			</p>
		</div>
	{:else if status === 'shown' && collection}
		{#if collection.description}<p class="description">{collection.description}</p>{/if}
		<p class="muted">{entries.length === 1 ? 'One page' : `${entries.length} pages`}. The link shows the pages as they are on the site today.</p>
		<ol class="shared-list">
			{#each entries as entry (entry.address)}
				<li>
					<a href={entry.address}>{entry.title}</a>
					<span class="hint">{entry.kind}{entry.detail && entry.kind !== 'Glossary entry' ? ` · ${entry.detail}` : ''}</span>
				</li>
			{/each}
		</ol>
		<p class="actions">
			<button class="button" type="button" onclick={starAll}>
				<Star size={20} strokeWidth={1.75} />
				Star all of these
			</button>
			<a class="button button-quiet" href="/starred">Your starred pages</a>
		</p>
		<p class="hint">Starring keeps the pages in this browser on this device, with nothing sent to the site.</p>
		<p role="status">{message}</p>
	{/if}
</div>

<style>
	.made-by {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
		margin-top: calc(-1 * var(--space-2));
	}

	.made-by :global(svg) {
		flex: none;
	}

	/* A reader's words: plain text, keeping their line breaks. */
	.description {
		white-space: pre-line;
		overflow-wrap: anywhere;
	}

	h1 {
		overflow-wrap: anywhere;
	}

	.shared-list {
		padding-left: var(--space-5);
	}

	.shared-list li {
		margin: var(--space-2) 0;
	}

	.shared-list .hint {
		display: block;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}

	.actions .button {
		gap: var(--space-2);
	}
</style>
