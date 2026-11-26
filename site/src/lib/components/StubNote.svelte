<!--
	@component
	The note at the end of a stub (src/lib/stubs.ts), where Wikipedia puts its
	stub template: that the page is a stub, and links to help expand it.
-->
<script lang="ts">
	import Sprout from '@lucide/svelte/icons/sprout';
	import { stubNoteText, stubRequestLink, type Stub } from '#lib/stubs.ts';

	let { stub }: { stub: Stub } = $props();
</script>

<aside class="stub-note" aria-label="Stub">
	<Sprout class="stub-mark" size={20} strokeWidth={2} aria-hidden="true" />
	<div>
		<p><strong>This page is a stub.</strong> {stubNoteText[stub.kind]}</p>
		<p class="stub-actions no-print"><a href={stubRequestLink(stub, 'write-up')}>Expand this page</a><a href={stubRequestLink(stub, 'sources')}>Suggest a source</a></p>
	</div>
</aside>
