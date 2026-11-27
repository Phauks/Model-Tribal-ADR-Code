<!--
	@component
	The "Stub" badge beside a page's title (src/lib/stubs.ts): a status badge
	like ReviewStatus, whose panel says why the page is a stub and links to
	the request form to expand it or suggest a source. It is the page's only
	stub notice (Trevor, Nov. 27, 2026: "we don't need to state stub twice on
	a page"). It is a <details> element, so it works without scripts. The
	panel never prints.
-->
<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Sprout from '@lucide/svelte/icons/sprout';
	import { onMount } from 'svelte';
	import { closeStatusPopovers } from '#lib/status-popovers.ts';
	import { stubPanelText, stubRequestLink, type Stub } from '#lib/stubs.ts';

	let { stub }: { stub: Stub } = $props();

	onMount(closeStatusPopovers);
</script>

<details class="status-popover stub-status">
	<summary class="review-badge stub-badge"
		><Sprout class="stub-mark" size={16} strokeWidth={2} aria-hidden="true" />Stub<ChevronDown class="status-popover-mark" size={14} strokeWidth={2} aria-hidden="true" /></summary
	>
	<div class="status-panel">
		<p><strong>Stub.</strong> {stubPanelText[stub.kind]}</p>
		<p class="stub-actions no-print"><a href={stubRequestLink(stub, 'write-up')}>Expand this page</a><a href={stubRequestLink(stub, 'sources')}>Suggest a source</a></p>
	</div>
</details>
