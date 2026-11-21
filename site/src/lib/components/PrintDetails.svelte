<script lang="ts">
	// "Page details" (site/DESIGN.md, section 6, "Print"): a line that appears
	// only on paper, under the site's name and content version, with the
	// page's address and the date it was printed, so a reader of a paper copy
	// can find the current version. The print option of the same name turns it
	// off. Pages are built ahead of time, where the site's own address is not
	// known, so the browser fills in the address and the date; without
	// scripts the line gives the page's path only.
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	let printedOn = $state<string | undefined>();
	let origin = $state('');

	onMount(() => {
		origin = window.location.origin;
		const update = () => {
			printedOn = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
		};
		update();
		window.addEventListener('beforeprint', update);
		return () => window.removeEventListener('beforeprint', update);
	});
</script>

<div class="print-only print-details page-width" data-print-part="pageDetails">
	<p>
		Printed from <span class="address">{origin}{page.url.pathname}</span>{#if printedOn}{' '}on
			{printedOn}{/if}. The page may have changed since.
	</p>
</div>

<style>
	.print-details p {
		margin: 0 0 var(--space-3);
		font-size: var(--font-size-small);
		border-bottom: 1px solid var(--color-line);
		padding-bottom: var(--space-2);
	}

	.address {
		overflow-wrap: anywhere;
	}
</style>
