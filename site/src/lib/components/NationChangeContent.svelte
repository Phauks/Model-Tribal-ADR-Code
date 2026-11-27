<script lang="ts">
	/**
	 * What one version of a nation's change says, for the team's history and the
	 * project's review. Pictures come from a private address given by the page.
	 * Given the version before, it shows what changed: words taken out struck
	 * through beside the new words (design/nation-editors, screens 3 and 5).
	 */
	import {
		contactChanges,
		contactKindLabels,
		hideableSectionLabels,
		statementSectionLabels,
		type ChangeContent,
		type ChangeContents,
		type ChangeKind,
		type StatementSection
	} from '#lib/nation-page-changes.ts';

	let {
		kind,
		content,
		pictureBase,
		before
	}: { kind: ChangeKind; content: ChangeContent; pictureBase: string; before?: ChangeContent } = $props();

	const sections = $derived(
		[
			...new Set([
				...Object.keys((before as ChangeContents['statements'] | undefined)?.statements ?? {}),
				...Object.keys((content as ChangeContents['statements']).statements ?? {})
			])
		] as StatementSection[]
	);
</script>

{#snippet compared(old: string | undefined, now: string | undefined)}
	{#if old && old !== now}<del class="change-text">{old}</del>{' '}{/if}{#if now && old !== now}<ins class="change-text">{now}</ins>{:else if now}<span class="change-text">{now}</span>{/if}
{/snippet}

{#if before && (kind === 'about' || kind === 'courts')}
	<p>{@render compared((before as ChangeContents['about']).text, (content as ChangeContents['about']).text)}{#if !(content as ChangeContents['about']).text} (removed){/if}</p>
{:else if before && kind === 'statements'}
	{#each sections as section (section)}
		{@const old = (before as ChangeContents['statements']).statements[section]}
		{@const now = (content as ChangeContents['statements']).statements[section]}
		{#if old !== now}
			<p><strong>{statementSectionLabels[section].replace(/ \(.*\)$/, '')}:</strong> {@render compared(old, now)}{#if !now} (removed){/if}</p>
		{/if}
	{/each}
{:else if before && kind === 'contacts'}
	{#each contactChanges((before as ChangeContents['contacts']).contacts, (content as ChangeContents['contacts']).contacts) as change, index (index)}
		<p class="contact-change">{change.label}: {@render compared(change.before, change.after)}{#if !change.after} (removed){/if}</p>
	{:else}
		<p>(no change to the contacts)</p>
	{/each}
{:else if kind === 'about' || kind === 'courts'}
	<p class="change-text">{(content as ChangeContents['about']).text || '(empty)'}</p>
{:else if kind === 'statements'}
	{#each Object.entries((content as ChangeContents['statements']).statements) as [section, text] (section)}
		<p><strong>{statementSectionLabels[section as StatementSection]}:</strong> <span class="change-text">{text}</span></p>
	{:else}
		<p>(no statements)</p>
	{/each}
{:else if kind === 'contacts'}
	<ul>
		{#each (content as ChangeContents['contacts']).contacts as contact, index (index)}
			<li>{contact.office}: {contactKindLabels[contact.kind]} {contact.value}</li>
		{:else}
			<li>(no contacts)</li>
		{/each}
	</ul>
{:else if kind === 'pictures'}
	<ul class="change-pictures">
		{#each (content as ChangeContents['pictures']).pictures as picture (picture.identifier)}
			<li>
				<img src="{pictureBase}/{picture.identifier}" alt={picture.alt} />
				{#if picture.caption || picture.credit}
					<span class="small">{[picture.caption, picture.credit ? `Credit: ${picture.credit}` : null].filter(Boolean).join(' ')}</span>
				{/if}
			</li>
		{:else}
			<li>(no pictures)</li>
		{/each}
	</ul>
{:else if kind === 'hidden'}
	<p>
		{(content as ChangeContents['hidden']).sections.map((section) => hideableSectionLabels[section]).join(', ') || 'Nothing hidden'}
	</p>
{/if}

<style>
	.change-text {
		white-space: pre-wrap;
	}

	del {
		padding: 0 0.15em;
		background: var(--color-removed-background);
		color: var(--color-ink);
	}

	/* Added words are underlined as well as shaded, as removed words are struck through, so the change reads without telling the two shades apart (WCAG 1.4.1). */
	ins {
		padding: 0 0.15em;
		background: var(--color-added-background);
		color: var(--color-ink);
		text-decoration: underline;
		text-decoration-thickness: 1px;
	}

	.contact-change {
		margin: 0 0 var(--space-1);
	}

	.change-pictures {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		padding: 0;
		list-style: none;
	}

	.change-pictures li {
		display: grid;
		gap: var(--space-1);
		max-width: 10rem;
	}

	.change-pictures img {
		width: 8rem;
		height: auto;
	}
</style>
