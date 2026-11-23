<script lang="ts">
	// The list of published essays in one part of the work (Foundations or Essays).
	// For someone signed in, the drafts not published yet that they can open
	// are listed too, from the workspace, so they can find them to edit.
	import { onMount } from 'svelte';
	import { readSignedInHint } from '#lib/signed-in-hint.ts';

	let {
		section,
		lead,
		part,
		essays
	}: {
		section: string;
		lead: string;
		/** The part's key, for its drafts: foundations, essays or back-matter. */
		part?: string;
		essays: { identifier: string; title: string; link: string; publishedAtText: string }[];
	} = $props();

	let drafts = $state<{ identifier: string; title: string; link: string; canEdit: boolean }[]>([]);

	onMount(() => {
		if (!part || !readSignedInHint(document.cookie).signedIn) return;
		void fetch(`/workspace/essays/drafts.json?part=${part}`, { headers: { Accept: 'application/json' }, redirect: 'manual' })
			.then((response) => (response.ok ? response.json() : null))
			.then((body: { drafts?: typeof drafts } | null) => (drafts = body?.drafts ?? []))
			.catch(() => undefined);
	});
</script>

<svelte:head>
	<title>{section} · Model Tribal ADR Code</title>
	<meta name="description" content={lead} />
</svelte:head>

<div class="reading">
	<h1>{section}</h1>
	<p class="lead">{lead}</p>
	{#if drafts.length}
		<section class="drafts panel no-print" aria-labelledby="drafts-heading">
			<h2 id="drafts-heading">Drafts not published yet</h2>
			<p class="small muted">Only people working on them see these.</p>
			<ul class="essay-list">
				{#each drafts as draft (draft.identifier)}
					<li>
						<a href={draft.link}>{draft.title}</a>
						{#if draft.canEdit}<a class="small" href="{draft.link}?edit">Edit</a>{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
	{#if essays.length === 0}
		<p>Nothing is published here yet.</p>
	{:else}
		<ul class="essay-list">
			{#each essays as essay (essay.identifier)}
				<li>
					<a href={essay.link}>{essay.title}</a>
					<span class="small muted">Published {essay.publishedAtText}</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>
