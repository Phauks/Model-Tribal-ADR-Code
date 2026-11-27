<!--
	@component
	A page's References when the list is too long to send with the page, such as the Map page's two thousand sources (SourceList.svelte shows them).

	The browser fetches the list from `url` as the reader nears it, or at once when the address points into it. Until then a folded References heading with the count holds its place.

	For readers without scripts the server puts the whole list in the page inside <noscript>. A browser running scripts keeps that as plain text, never laid out, so it costs the page almost nothing; if the reader prints before the list has come, that text is shown for printing.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { SourceEntry } from '#lib/server/source-uses.ts';
	import Collapsible from './Collapsible.svelte';
	import SourceList from './SourceList.svelte';

	let {
		count,
		url,
		serverSources
	}: {
		/** How many sources the list has, for the heading. */
		count: number;
		/** Where the list is fetched from, as JSON. */
		url: string;
		/** The list itself, given only while the page is built on the server, for readers without scripts. */
		serverSources?: SourceEntry[];
	} = $props();

	let sources = $state.raw<SourceEntry[] | undefined>();
	let problem = $state('');
	let holder = $state<HTMLElement | undefined>();
	let fallback = $state<HTMLElement | undefined>();
	let loading: Promise<void> | undefined;

	function load(): Promise<void> {
		loading ??= fetch(url)
			.then((response) => {
				if (!response.ok) throw new Error(String(response.status));
				return response.json() as Promise<SourceEntry[]>;
			})
			.then((list) => {
				sources = list;
			})
			.catch(() => {
				loading = undefined;
				problem = 'The references could not be loaded. Open this section again to retry.';
			});
		return loading;
	}

	onMount(() => {
		if (/^#(source|cite)-/.test(location.hash)) void load();
		const onHash = () => {
			if (/^#(source|cite)-/.test(location.hash)) void load();
		};
		window.addEventListener('hashchange', onHash);
		// Fetched a little before the reader reaches it, so it is there when they do.
		const watcher = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					watcher.disconnect();
					void load();
				}
			},
			{ rootMargin: '1500px 0px' }
		);
		if (holder) watcher.observe(holder);

		// Printing cannot wait for a fetch, so a list that has not come yet prints from the copy the server put in the page.
		let printCopy: HTMLElement | undefined;
		const beforePrint = () => {
			if (sources || !fallback) return;
			const text = holder?.querySelector('noscript')?.textContent;
			if (!text) return;
			printCopy = document.createElement('div');
			printCopy.className = 'print-only';
			printCopy.innerHTML = text;
			fallback.after(printCopy);
		};
		const afterPrint = () => {
			printCopy?.remove();
			printCopy = undefined;
		};
		window.addEventListener('beforeprint', beforePrint);
		window.addEventListener('afterprint', afterPrint);
		return () => {
			watcher.disconnect();
			window.removeEventListener('hashchange', onHash);
			window.removeEventListener('beforeprint', beforePrint);
			window.removeEventListener('afterprint', afterPrint);
		};
	});
</script>

{#if sources}
	<SourceList {sources} />
{:else}
	<div bind:this={holder}>
		<div class="needs-scripts no-print" bind:this={fallback} ontogglecapture={() => void load()}>
			<Collapsible heading="References" identifier="sources-heading-waiting" {count} open={false}>
				<p class="muted" role="status">{problem}</p>
			</Collapsible>
		</div>
		<noscript>
			{#if serverSources}<SourceList sources={serverSources} />{/if}
		</noscript>
	</div>
{/if}

