<script lang="ts">
	import OfflineSaving from '#lib/components/OfflineSaving.svelte';

	// What can be saved and what stays online, and why (site/DESIGN.md, section 10). Trevor asked on
	// Nov. 23, 2026 for this page to reflect how the site keeps files and which files it may share.
	const rows: { what: string; where: string; saved: boolean; why: string }[] = [
		{
			what: 'Pages of this site: nations, tables, charts, Find recourse, stories, the glossary, essays',
			where: 'Saved',
			saved: true,
			why: 'Written or gathered by the project.'
		},
		{
			what: 'Pictures on a page',
			where: 'Saved with their page',
			saved: true,
			why: 'Part of the page. A picture that is withdrawn leaves your device at the next update.'
		},
		{
			what: 'Transcripts of video and sound',
			where: 'Saved with their page',
			saved: true,
			why: 'Part of the page.'
		},
		{
			what: 'The drawn map',
			where: 'Saved',
			saved: true,
			why: 'Built with the site.'
		},
		{
			what: 'A nation’s seal or logo',
			where: 'Online only',
			saved: false,
			why: 'So that a nation can withdraw it at once, on every device.'
		},
		{
			what: 'United States laws and government documents we hold',
			where: 'Saved, if you choose',
			saved: true,
			why: 'Works of the United States government are free for anyone to share.'
		},
		{
			what: 'Nations’ constitutions, laws and court opinions we hold',
			where: 'Saved, one nation at a time',
			saved: true,
			why: 'A removed document also leaves your device the next time you are online. All of them together come to several gigabytes, so each nation’s page has its own button.'
		},
		{
			what: 'Documents held by the National Indian Law Library',
			where: 'Link',
			saved: false,
			why: 'A nation’s permission to the library is not permission for anyone else to share the document.'
		},
		{
			what: 'Laws published by code publishers',
			where: 'Link',
			saved: false,
			why: 'Municode, eCode360, American Legal Publishing and Code Publishing hold rights in their editions.'
		},
		{
			what: 'Articles, books and other published works',
			where: 'Link',
			saved: false,
			why: 'Their authors and publishers hold the rights. Stories are the exception: each story is shown in full, and its page can be saved.'
		},
		{
			what: 'Video and sound',
			where: 'Online only',
			saved: false,
			why: 'YouTube videos play on YouTube. Other recordings are large.'
		},
		{
			what: 'The zoomable map',
			where: 'Online only',
			saved: false,
			why: 'Its map tiles come to over 2 GB. The drawn map works offline.'
		}
	];
</script>

<svelte:head>
	<title>Read offline · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<h1>Read offline</h1>
	<p class="lead">
		This site can be installed on a phone or computer and read without a connection. Most of it can
		be saved on your device. A few things stay online, and this page says which and why.
	</p>
	<h2>Install the site</h2>
	<p>
		In most browsers, open the browser’s menu and choose “Install” or “Add to Home Screen.” The site
		then opens like an app.
	</p>
	<h2>What is saved by itself</h2>
	<p>
		The home page, the glossary, search, the changelog and this page are saved on your device the
		first time you visit. Every other page you open is saved as you read it and updated the next time
		you are online.
	</p>
	<p>
		If you see this page while trying to open another one, that page has not been saved on this
		device yet. Connect to the internet and open it once to save it. The request form and sign-in are
		never saved, because they need a connection to send anything.
	</p>
	<h2>Save more now</h2>
	<p>
		You can save whole parts of the site, the United States documents we hold, and, from each
		nation’s page, that nation’s constitutions, laws and court opinions.
	</p>
	<OfflineSaving headingLevel={3} />
	<p class="muted">The same choices are under Settings, in “This device.”</p>

	<h2 id="what-stays-online">What can be saved, and what stays online</h2>
	<p>We save only what we are allowed to share. Everything else is a link to where it is kept.</p>
	<div class="table-scroll">
		<table>
			<caption>Material a nation has asked us to restrict, and anything that needs you to sign in, are never saved or downloaded.</caption>
			<thead>
				<tr>
					<th scope="col">What</th>
					<th scope="col">On your device</th>
					<th scope="col">Why</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.what)}
					<tr>
						<th scope="row">{row.what}</th>
						<td class:saved={row.saved} class:online={!row.saved}>{row.where}</td>
						<td>{row.why}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<h2>When a nation asks us to remove something</h2>
	<p>
		The next time your device is online, the site removes it from what you saved, before anything
		else. You do not have to do anything. A file you downloaded cannot be reached this way, which is
		why downloads hold less than saved pages.
	</p>

	<h2>Files to keep</h2>
	<p>
		Saved pages live inside your browser. For files you can open anywhere, such as the list of
		nations as a spreadsheet, see <a href="/downloads">Data sets</a>.
	</p>
</div>

<style>
	.table-scroll {
		overflow-x: auto;
		margin: 0 0 var(--space-5);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
	}

	table {
		border-collapse: collapse;
		width: 100%;
		min-width: 24rem;
	}

	caption {
		caption-side: bottom;
		text-align: left;
		padding: var(--space-2) var(--space-3);
		font-size: var(--font-size-small);
	}

	th,
	td {
		text-align: left;
		vertical-align: top;
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--color-line);
	}

	thead th {
		background: var(--color-surface);
	}

	tbody th {
		font-weight: 600;
	}

	.saved,
	.online {
		font-weight: 700;
	}

	.saved {
		color: var(--color-action);
	}
</style>
