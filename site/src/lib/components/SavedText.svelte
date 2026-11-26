<!--
	@component
	The "Text" section of a law's or a case's page: the copy of its text this
	site keeps, in a frame (src/lib/public-copies.ts). A PDF opens in the
	browser's own viewer; a saved text or web page is shown in a sandbox that
	runs nothing and loads nothing (src/lib/server/public-copy-serving.ts).
-->
<script lang="ts">
	import Collapsible from '#lib/components/Collapsible.svelte';

	interface Props {
		/** The copy's address on this site, /copies/<key>. */
		file: string;
		isPdf: boolean;
		/** The law's or case's name, for the frame's title. */
		name: string;
		/** The section's id on the page. */
		identifier: string;
	}

	let { file, isPdf, name, identifier }: Props = $props();
</script>

<Collapsible heading="Text" {identifier}>
	<!-- Its own block, so the frame takes the width beside At a glance instead of dropping below it. -->
	<div class="saved-text-box">
		{#if isPdf}
			<iframe class="saved-text" src={file} title="{name} (PDF)" loading="lazy"></iframe>
		{:else}
			<iframe class="saved-text saved-text-short" src={file} title={name} sandbox="" referrerpolicy="no-referrer" loading="lazy"></iframe>
		{/if}
	</div>
</Collapsible>

<style>
	.saved-text-box {
		display: flow-root;
	}

	.saved-text {
		display: block;
		width: 100%;
		height: 70vh;
		min-height: 24rem;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		background: var(--color-surface-raised);
	}

	/* A short text needs no tall frame. */
	.saved-text-short {
		height: 24rem;
	}
</style>
