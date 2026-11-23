<script lang="ts">
	import OfflineSaving from '#lib/components/OfflineSaving.svelte';
</script>

<svelte:head>
	<title>Read offline · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<h1>Read offline</h1>
	<p class="lead">
		This site can be installed on a phone or computer and read without a connection.
	</p>
	<h2>Install the site</h2>
	<p>
		In most browsers, open the browser’s menu and choose “Install” or “Add to Home Screen.” The site
		then opens like an app.
	</p>
	<h2>What is saved</h2>
	<p>
		The home page, the glossary, the changelog and this page are saved on your device the first time
		you visit. Every other page you open is saved as you read it and updated the next time you are
		online.
	</p>
	<p>
		If you see this page while trying to open another one, that page has not been saved on this
		device yet. Connect to the internet and open it once to save it. The request form and co-author
		sign-in are never saved, because they need a connection to send anything.
	</p>
	<h2>Save more now</h2>
	<OfflineSaving headingLevel={3} />
	<p class="muted">
		The same choices are under Settings, in "This device." The PDF and the ebook will be on
		the <a href="/downloads">Downloads</a> page.
	</p>
</div>
