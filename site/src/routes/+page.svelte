<script lang="ts">
	import { siteName } from '#lib';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{siteName}</title>
	<meta
		name="description"
		content="Model provisions and commentary on dispute resolution that Native nations may adapt through their own processes."
	/>
</svelte:head>

<!-- The top of the page in two columns: the name and purpose on the left, the logo on the right (Trevor, Nov. 22, 2026). They stack on narrow screens. -->
<div class="home-top">
	<div class="home-introduction">
		<h1>{siteName}</h1>
		<p class="lead">
			Model provisions and commentary on dispute resolution, offered as an optional framework that a Native nation may adapt through its own processes. It does not speak for any nation.
		</p>
	</div>
	<div class="art-reserved home-logo" role="img" aria-label="Space reserved for the logo">
		<p>Space reserved for the logo.</p>
	</div>
</div>

<!-- The cards give no counts of what the pages hold, since those change with every update (Trevor, Nov. 22, 2026). -->
<h2>Contents</h2>
<div class="contents-band">
	<section class="panel" aria-labelledby="code-heading">
		<h3 id="code-heading">The model code</h3>
		<p class="muted">
			Model provisions with commentary, in two tracks: the ADR track and the peacemaking track. Not
			yet published.
		</p>
	</section>
	<section class="panel" aria-labelledby="nations-heading">
		<h3 id="nations-heading"><a href="/nations">Native nations</a></h3>
		<p>
			{#if data.nationCount > 0}
				A page for each nation and community, drafted from public sources.
			{:else}
				One page for every nation and community, drafted from public sources. A sample page shows the
				layout until the records are published.
			{/if}
		</p>
	</section>
	{#if data.storyCount > 0}
		<section class="panel" aria-labelledby="stories-heading">
			<h3 id="stories-heading"><a href="/stories">Stories</a></h3>
			<p>Stories, accounts and teachings about making peace, quoted in the words of the nations and people who tell them.</p>
		</section>
	{/if}
	<section class="panel" aria-labelledby="glossary-heading">
		<h3 id="glossary-heading"><a href="/glossary">Glossary</a></h3>
		<p>Legal terms, with how and when to use them.</p>
	</section>
	<section class="panel" aria-labelledby="changelog-heading">
		<h3 id="changelog-heading"><a href="/changelog">Changelog</a></h3>
		<p>What changed in the content, the website and the print edition, version by version.</p>
	</section>
</div>

<section class="panel panel-filled reading" aria-labelledby="for-nations-heading">
	<h2 id="for-nations-heading">For Native nations</h2>
	<p>
		A nation can ask us to correct, restrict or remove material about it, or offer to
		contribute. Requests are private and need no account.
	</p>
	<p><a class="button" href="/requests">Make a request</a></p>
</section>

<style>
	.contents-band {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(15rem, 100%), 1fr));
		gap: 0 var(--space-4);
	}

	.contents-band .panel {
		margin: var(--space-2) 0;
	}

	.contents-band h3 {
		margin-top: 0;
	}

	.home-top {
		display: grid;
		grid-template-columns: minmax(0, var(--layout-measure)) minmax(14rem, 1fr);
		gap: var(--space-5) var(--space-7);
		align-items: center;
		margin: var(--space-5) 0 var(--space-6);
	}

	.home-logo {
		margin: 0;
		min-height: 12rem;
		display: grid;
		place-items: center;
		text-align: center;
	}

	@media (max-width: 48rem) {
		.home-top {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
