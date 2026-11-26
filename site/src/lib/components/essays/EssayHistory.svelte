<script lang="ts">
	import Breadcrumbs from '../Breadcrumbs.svelte';
	// Every published version of an essay, newest first. Each stays readable.
	let {
		section,
		sectionLink,
		path,
		title,
		publications
	}: {
		section: string;
		sectionLink: string;
		path: string;
		title: string;
		publications: { number: number; publishedAtText: string; link: string; title: string }[];
	} = $props();
</script>

<svelte:head>
	<title>Versions of {title} · {section} · Tribal Law Project</title>
</svelte:head>

<Breadcrumbs
	trail={[
		{ label: section, href: sectionLink },
		{ label: title, href: path }
	]}
/>

<div class="reading">
	<h1>Versions of {title}</h1>
	<ol class="essay-list" reversed>
		{#each publications as publication, index (publication.number)}
			<li>
				<a href={publication.link}>Published {publication.publishedAtText}</a>
				{#if index === 0}<span class="small muted">(current)</span>{/if}
				{#if publication.title !== title}<span class="small muted">, then titled “{publication.title}”</span>{/if}
			</li>
		{/each}
	</ol>
	<p><a href="/changes?page={encodeURIComponent(path)}">Compare versions, and see who changed what</a></p>
</div>
