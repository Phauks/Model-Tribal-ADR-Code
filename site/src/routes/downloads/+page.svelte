<script lang="ts">
	import { repositoryLink } from '#lib';
	import Download from '@lucide/svelte/icons/download';
</script>

<svelte:head>
	<title>Downloads · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<h1>Downloads</h1>
	<p class="lead">
		The book and the data behind this site, to keep, print or share.
	</p>

	<!-- Empty state: says what will appear and when (site/DESIGN.md, section 12). -->
	<section class="panel panel-filled empty-state" aria-labelledby="nothing-yet-heading">
		<h2 id="nothing-yet-heading">
			<Download size={24} />
			Nothing to download yet
		</h2>
		<p>
			Downloads will appear here when the first edition is released. Each one will name its version
			and the date it was made.
		</p>
	</section>

	<h2>What this page will offer</h2>
	<ul>
		<li>The book as a PDF, for printing or reading on a screen.</li>
		<li>The book as an EPUB ebook, for e-readers and reading apps.</li>
		<li>
			The data behind the site, such as the nation profiles, the glossary and the sources, in open
			file formats.
		</li>
	</ul>
	<p>
		Material that a nation has asked the project to restrict is never included in a download
		(<a href="{repositoryLink}/blob/main/docs/data-model.md#sensitivity-flags">data model,
			sensitivity flags</a
		>).
	</p>

	<h2>Until then</h2>
	<p>
		Every page of this site can be saved on your device and read without a connection. See
		<a href="/offline">Read offline</a>. The files the site is built from are public in the
		<a href={repositoryLink}>project’s repository</a>.
	</p>
</div>

<style>
	.empty-state h2 {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-top: 0;
	}
</style>
