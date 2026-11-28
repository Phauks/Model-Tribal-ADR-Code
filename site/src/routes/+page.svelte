<script lang="ts">
	import { siteName } from '#lib';
	import { nationNames } from 'virtual:section-lists';
	import Search from '@lucide/svelte/icons/search';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import SearchableDropdown from '#lib/components/SearchableDropdown.svelte';
	import SponsorRow from '#lib/components/SponsorRow.svelte';
	import { lawSubjects, type LawSubjectChoice } from '#lib/find-the-law.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Find the law, from the home page: the two pickers send the reader to /nations/law with both in the address.
	const nationChoices = nationNames.map(([label, id]) => ({ value: id, label }));
	const subjectChoices: { value: LawSubjectChoice; label: string }[] = [
		{ value: 'all', label: 'All subjects' },
		...lawSubjects.map((subject) => ({ value: subject.key, label: subject.label }))
	];
	let lawNation = $state('');
	let lawSubject = $state<LawSubjectChoice>('all');
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

<section class="panel panel-filled find-law" aria-labelledby="find-law-heading">
	<h2 id="find-law-heading"><a href="/nations/law">Find the law</a></h2>
	<form class="find-law-form" method="get" action="/nations/law">
		<div class="find-law-nation">
			<SearchableDropdown label="Native nation" name="nation" choices={nationChoices} value={lawNation} onchange={(value) => (lawNation = value)} placeholder="Type a nation’s name" />
		</div>
		<div class="find-law-subject">
			<Dropdown label="Subject" name="subject" choices={subjectChoices} bind:value={lawSubject} />
		</div>
		<button type="submit" class="button"><Search aria-hidden="true" size="1.1em" strokeWidth={1.75} />Find</button>
	</form>
</section>

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
			<p>Stories, accounts and teachings about law, justice and governance, quoted in the words of the nations and people who tell them.</p>
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
	<p><a class="button" href="#request">Make a request</a></p>
</section>

<!-- The rolling row of sponsors (Trevor, Nov. 27, 2026; docs/sponsorship.md, "The home page row"). -->
<SponsorRow />

<style>
	.find-law {
		margin: 0 0 var(--space-6);
	}

	.find-law h2 {
		margin-top: 0;
	}

	.find-law-form {
		display: grid;
		grid-template-columns: minmax(0, 24rem) minmax(0, 16rem) auto;
		gap: var(--space-3) var(--space-4);
		align-items: end;
	}

	.find-law-form .button {
		display: inline-flex;
		align-items: center;
		justify-self: start;
		gap: var(--space-2);
	}

	@media (max-width: 48rem) {
		.find-law-form {
			grid-template-columns: minmax(0, 1fr);
		}
	}

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
