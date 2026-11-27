<!--
	@component
	Title 25 of the United States Code, Indians (src/lib/server/code-outline.ts;
	Trevor chose on Nov. 27, 2026, design/title-25-navigation, option A): a box
	that finds a section by its number or by words in its heading, and the
	title's chapters with how many of their sections are in force. A chapter
	whose sections were all repealed, moved or omitted is shown quieter and
	says so; the switch shows how many of each chapter's sections are no
	longer in force.

	Its trail goes up to Federal law.

	The box works on the page as one types; the side column's box on the other
	pages of Title 25 sends its words here as ?find=.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import Search from '@lucide/svelte/icons/search';
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let query = $state('');
	let showGone = $state(false);
	let input: HTMLInputElement | undefined = $state();

	onMount(() => {
		const asked = new URL(location.href).searchParams.get('find');
		if (asked) query = asked;
	});

	const words = $derived(
		query
			.toLowerCase()
			.replace(/§/g, '')
			.split(/\s+/)
			.filter((word) => word.length > 0)
	);
	const found = $derived.by(() => {
		if (words.length === 0) return [];
		const number = words.length === 1 && /^\d/.test(words[0]) ? words[0].replace(/[–]/g, '-') : undefined;
		return data.sections
			.filter((section) => (number ? section.number.toLowerCase().startsWith(number) : words.every((word) => section.heading.toLowerCase().includes(word))))
			.slice(0, 50);
	});

	function go(event: SubmitEvent) {
		event.preventDefault();
		const exact = data.sections.find((section) => section.number.toLowerCase() === query.trim().replace(/^§\s*/, '').toLowerCase());
		if (exact) location.href = exact.link;
		else if (found.length === 1) location.href = found[0].link;
	}

	function slash(event: KeyboardEvent) {
		if (event.key === '/' && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
			event.preventDefault();
			input?.focus();
		}
	}

	const longDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
</script>

<svelte:window onkeydown={slash} />

<svelte:head>
	<title>Title 25. Indians · United States Code · Tribal Law Project</title>
	<meta name="description" content="Title 25 of the United States Code, Indians: its {data.chapters.length} chapters and {data.inForce.toLocaleString('en-US')} sections in force, to browse or search." />
</svelte:head>

<article class="title-page">
	<Breadcrumbs trail={[{ label: 'Federal law', href: '/laws' }]} current="U.S. Code, Title 25" />
	<h1>Title 25. Indians</h1>
	<p class="lead-line">
		<span>United States Code, {data.edition} edition{#if data.currentThrough}{' '}(current through {longDate(data.currentThrough)}){/if}</span>
		<span>{data.chapters.length} chapters</span>
		<span>{data.inForce.toLocaleString('en-US')} sections in force</span>
	</p>

	<form class="find" role="search" onsubmit={go}>
		<label class="visually-hidden" for="title-find">Find a section</label>
		<Search size={18} aria-hidden="true" />
		<input id="title-find" type="search" bind:this={input} bind:value={query} placeholder="Find a section: type a number (5321) or words (self-determination)" autocomplete="off" />
		<kbd aria-hidden="true">/</kbd>
	</form>

	{#if words.length > 0}
		<section class="found" aria-live="polite">
			<h2 class="visually-hidden">Sections found</h2>
			{#if found.length === 0}
				<p class="muted">No section in force has that number or those words in its heading.</p>
			{:else}
				<ul>
					{#each found as section (section.link)}
						<li><a href={section.link}>§ {section.number}</a> <span>{section.heading}</span> <span class="muted">Chapter {section.chapter}</span></li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}

	<label class="switch">
		<input type="checkbox" bind:checked={showGone} />
		<span>Show how many sections are repealed, moved or omitted</span>
	</label>

	<h2 id="chapters">Chapters</h2>
	<div class="table-scroll">
		<table class="chapters">
			<thead>
				<tr><th scope="col">Chapter</th><th scope="col">Name</th><th scope="col" class="count">In force</th>{#if showGone}<th scope="col" class="count">Not in force</th>{/if}</tr>
			</thead>
			<tbody>
				{#each data.chapters as chapter (chapter.number)}
					<tr class:gone={chapter.inForce === 0}>
						<td class="number">Ch. {chapter.number}</td>
						<td>
							<a href={chapter.link}>{chapter.heading}</a>
							{#if chapter.inForce === 0}<span class="all-gone">all {chapter.notInForce.toLocaleString('en-US')} repealed, moved or omitted</span>{/if}
							{#if chapter.groups.length > 0}
								<details class="groups">
									<summary>{chapter.groups.length} subchapters</summary>
									<ul>
										{#each chapter.groups as group (group.link)}
											<li><a href={group.link}>{group.label}. {group.heading}</a> <span class="muted">({group.inForce})</span></li>
										{/each}
									</ul>
								</details>
							{/if}
						</td>
						<td class="count">{chapter.inForce.toLocaleString('en-US')}</td>
						{#if showGone}<td class="count">{chapter.notInForce.toLocaleString('en-US')}</td>{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<p class="source muted">Source: <a href={data.source}>United States Code, Title 25, {data.edition} edition, GovInfo</a>.</p>
</article>

<style>
	.lead-line {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 0.9rem;
		margin: 0.25rem 0 1rem;
		color: var(--color-ink-muted);
		font-size: 1.1rem;
	}

	.find {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		max-width: 44rem;
		padding: 0 0.9rem;
		border: 1px solid var(--color-control-border);
		border-radius: 8px;
		background: var(--color-surface-raised);
		color: var(--color-ink-muted);
	}

	.find:focus-within {
		outline: 3px solid var(--color-focus-ring);
	}

	/* The box is the field: the input fills its height and keeps the site's target size. */
	.find input[type='search'] {
		flex: 1;
		min-width: 0;
		border: 0;
		padding: 0;
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		font-size: 1.05rem;
	}

	.find input[type='search']:focus {
		outline: none;
	}

	.find kbd {
		border: 1px solid var(--color-line);
		border-radius: 4px;
		padding: 0 0.3rem;
		font: inherit;
		font-size: 0.75rem;
	}

	.found ul {
		list-style: none;
		margin: 0.75rem 0 0;
		padding: 0;
		max-width: 52rem;
	}

	.found li {
		padding: 0.3rem 0;
		border-bottom: 1px solid var(--color-line);
	}

	.switch {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0.9rem 0 0;
		cursor: pointer;
	}

	/* A switch: a track with a knob that moves across when on. */
	.switch input {
		appearance: none;
		position: relative;
		flex: none;
		width: 2.2rem;
		height: 1.25rem;
		margin: 0;
		border-radius: 999px;
		background: var(--color-control-border);
		cursor: pointer;
	}

	.switch input::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: calc(1.25rem - 4px);
		height: calc(1.25rem - 4px);
		border-radius: 50%;
		background: var(--color-surface-raised);
		transition: left var(--motion-duration-short);
	}

	.switch input:checked {
		background: var(--color-link);
	}

	.switch input:checked::after {
		left: calc(100% - 1.25rem + 2px);
	}

	.chapters {
		width: 100%;
		border-collapse: collapse;
	}

	.chapters th {
		text-align: left;
		font-size: 0.85rem;
		color: var(--color-ink-muted);
		background: var(--color-surface);
		padding: 0.45rem 0.5rem;
		border-bottom: 1px solid var(--color-line);
	}

	.chapters td {
		padding: 0.45rem 0.5rem;
		border-bottom: 1px solid var(--color-line);
		vertical-align: top;
	}

	.chapters .number {
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.chapters .count {
		text-align: right;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.chapters tr.gone td,
	.chapters tr.gone a {
		color: var(--color-ink-muted);
	}

	.all-gone {
		display: inline-block;
		margin-left: 0.4rem;
		border: 1px solid currentColor;
		border-radius: 999px;
		padding: 0 0.45rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-ink-muted);
	}

	.groups {
		display: inline;
		margin-left: 0.4rem;
	}

	.groups[open] {
		display: block;
		margin-left: 0;
	}

	.groups summary {
		display: inline;
		cursor: pointer;
		color: var(--color-ink-muted);
		font-size: 0.85rem;
	}

	.groups ul {
		list-style: none;
		margin: 0.35rem 0 0.1rem;
		padding: 0 0 0 0.9rem;
		border-left: 2px solid var(--color-line);
		font-size: 0.9rem;
	}

	.source {
		margin-top: 1.5rem;
		font-size: 0.9rem;
	}
</style>
