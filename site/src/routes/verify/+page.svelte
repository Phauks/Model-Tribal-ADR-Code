<script lang="ts">
	// Verify a file (site/DESIGN.md, section 10, "Checking a file"). Trevor asked on Nov. 23, 2026
	// for every download and document to come with a way to check it. A link from one file carries
	// its hash as /verify?sha256=<hash>&name=<file>; the page is built ahead of time, so the address
	// is read in the browser.
	import { onMount } from 'svelte';
	import FileVerifier from '#lib/components/FileVerifier.svelte';
	import { checksumsAddress, checksumsTextAddress } from '#lib/checksums.ts';
	import { isSha256 } from '#lib/sha256.ts';

	let expected = $state('');
	let name = $state('');
	let ready = $state(false);

	onMount(() => {
		const query = new URLSearchParams(location.search);
		const hash = query.get('sha256')?.trim().toLowerCase();
		if (isSha256(hash)) {
			expected = hash;
			name = (query.get('name') ?? '').slice(0, 200);
		}
		ready = true;
	});
</script>

<svelte:head>
	<title>Verify a file · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<h1>Verify a file</h1>
	<p class="lead">
		Check that a file you downloaded from this site, or a copy of a document someone gave you, is the file this site published, with nothing changed or missing.
	</p>
	<p>
		Every file has a SHA-256, a string of 64 letters and digits worked out from every byte in it. Change one byte and the SHA-256 changes. This page works out the SHA-256 of your file and compares it with the one this site published.
	</p>

	{#if ready}
		{#key expected}
			<FileVerifier {expected} {name} />
		{/key}
	{/if}

	<h2>Files inside a ZIP of documents</h2>
	<p>
		A ZIP of documents is put together when you ask for it, so the ZIP has no SHA-256 of its own. Open it and check the files inside: documents.csv lists the SHA-256 of each one, and you can choose them all here at once.
	</p>

	<h2>Check on your own computer</h2>
	<p>You can also work out a file’s SHA-256 without this site:</p>
	<ul>
		<li>Windows, in PowerShell: <code>Get-FileHash file.pdf -Algorithm SHA256</code></li>
		<li>Mac, in Terminal: <code>shasum -a 256 file.pdf</code></li>
		<li>Linux: <code>sha256sum file.pdf</code></li>
	</ul>
	<p>
		Compare the result with the SHA-256 shown beside the download, or with the full lists: <a href={checksumsTextAddress} download>checksums.txt</a>, in the form <code>sha256sum -c</code> reads, and <a href={checksumsAddress} download>checksums.json</a>. Both list every download and every copy of a document this site holds today.
	</p>
	<p class="muted">
		A match shows the file is the one published here. It does not show that what the file says is current: a nation may have amended a law since its copy was made. <a href="/copies">Copies of documents</a> gives the date each copy was made and where it was published.
	</p>
</div>
