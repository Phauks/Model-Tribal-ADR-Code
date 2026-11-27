<!--
	@component
	One section of Title 25 of the United States Code
	(src/lib/server/code-outline.ts; Trevor chose on Nov. 27, 2026,
	design/title-25-navigation, option A): its chapter's outline in the side
	column, the trail up to its chapter and subchapter, its status and the Act
	that enacted it, the sections before and after it, and its text. A
	section no longer in force says what became of it in the Code's own words.

	The text block is the place for the site's shared document text component
	(thread "Standardize how document text is shown"); until it comes, the
	section links to its page in our saved copy of its chapter and to GovInfo.
	What the site's older record of the section holds (its box, the accounts of
	its impact, where the site cites it) follows.
-->
<script lang="ts">
	import Collapsible from '#lib/components/Collapsible.svelte';
	import ImpactAccounts from '#lib/components/ImpactAccounts.svelte';
	import InfoPage from '#lib/components/InfoPage.svelte';
	import RecordBoxSections from '#lib/components/RecordBoxSections.svelte';
	import CodePager from '#lib/components/code/CodePager.svelte';
	import StatusTag from '#lib/components/code/StatusTag.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const inForce = $derived(data.status === 'in force');
	const kept = $derived(data.kept ?? []);
	const essays = $derived(kept.flatMap((record) => record.essays));
	const nations = $derived(kept.flatMap((record) => record.nations));
	const sources = $derived(kept.flatMap((record) => record.sources));
	const longDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
</script>

<svelte:head>
	<title>25 U.S.C. {data.number} · {data.heading} · Tribal Law Project</title>
	<meta name="description" content="25 U.S.C. {data.number}, {data.heading}: its place in Title 25 of the United States Code, its status and its text." />
</svelte:head>

<InfoPage title={data.name} trail={data.trail} crumb={data.number} {sources}>
	<p class="section-lead">
		<span>{data.citation}</span>
		<StatusTag status={data.status} movedTo={data.movedTo} />
		{#if data.act}<span>Enacted by {#if data.act.link}<a href={data.act.link}>{data.act.name}</a>{:else}{data.act.name}{/if}</span>{/if}
	</p>

	<CodePager previous={data.previous} next={data.next} look="line" />

	{#if !inForce}
		<p class="gone-note">
			{#if data.status === 'moved' && data.movedTo}
				This section is now {#if data.movedTo.link}<a href={data.movedTo.link}>{data.movedTo.label}</a>{:else}{data.movedTo.label}{/if}.
			{/if}
			{#if data.note}<span class="code-words">{data.note}</span>{/if}
		</p>
	{/if}

	{#if data.movedFrom.length > 0}
		<p class="moved-from muted">Formerly {#each data.movedFrom as from, index (from.label)}{#if index > 0}, {/if}{#if from.link}<a href={from.link}>{from.label}</a>{:else}{from.label}{/if}{/each}.</p>
	{/if}

	{#if inForce}
		<Collapsible heading="Text" identifier="text">
			<!-- The shared document text component takes this place (thread "Standardize how document text is shown"). -->
			<div class="text-slot">
				<p>
					Read § {data.slug.replace(/-/g, '–')} in
					{#if data.reading}<a href={data.reading}>our copy of chapter {data.chapter.number}</a> or{/if}
					<a href={data.official}>GovInfo</a>, from the {data.edition} edition{#if data.currentThrough}, current through {longDate(data.currentThrough)}{/if}.
				</p>
			</div>
		</Collapsible>
	{/if}

	{#each kept as record (record.key)}
		<RecordBoxSections sections={record.boxSections} />
		<ImpactAccounts accounts={record.accounts} />
	{/each}

	{#if essays.length + nations.length > 0}
		<Collapsible heading="On this site" identifier="on-this-site" count={essays.length + nations.length}>
			<dl class="summary-list">
				{#if nations.length > 0}
					<div>
						<dt>Nation pages</dt>
						<dd>
							{#each nations as nation (nation.id)}
								<p><a href="/nations/{nation.id}">{nation.name}</a>{#if nation.what.length > 0}<span class="muted">&nbsp;› {nation.what.join('; ')}</span>{/if}</p>
							{/each}
						</dd>
					</div>
				{/if}
				{#if essays.length > 0}
					<div>
						<dt>Essays</dt>
						<dd>
							{#each essays as essay (essay.link)}
								<p><a href={essay.link}>{essay.title}</a>{#if essay.where}<span class="muted">&nbsp;› {essay.where}</span>{/if}</p>
							{/each}
						</dd>
					</div>
				{/if}
			</dl>
		</Collapsible>
	{/if}

	<CodePager previous={data.previous} next={data.next} />
</InfoPage>

<style>
	.section-lead {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 0.75rem;
		margin: 0.25rem 0 1rem;
		color: var(--color-ink-muted);
		font-size: 1.1rem;
	}

	.gone-note {
		margin: 0 0 1rem;
	}

	.code-words {
		display: block;
		margin-top: 0.35rem;
		color: var(--color-ink-muted);
	}

	.moved-from {
		margin: 0 0 1rem;
	}

	.text-slot {
		border: 1px solid var(--color-line);
		border-radius: 10px;
		padding: 1rem 1.25rem;
		background: var(--color-surface-raised);
	}

	.text-slot p {
		margin: 0;
	}

	.summary-list dd :global(p) {
		margin: 0;
	}
</style>
