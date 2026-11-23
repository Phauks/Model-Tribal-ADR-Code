<script lang="ts">
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
	<title>Versions of {title} · {section} · Model Tribal ADR Code</title>
</svelte:head>

<nav aria-label="Breadcrumb" class="small">
	<a href={sectionLink}>{section}</a> › <a href={path}>{title}</a> › Versions
</nav>

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
