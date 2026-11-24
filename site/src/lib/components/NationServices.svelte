<script lang="ts">
	// A nation's courts and dispute resolution services, one heading per kind
	// of service, so the kind is said once (src/lib/nation-services.ts).
	// Where sources record it, the courts show how appeals move, from the
	// court that hears a case first to the highest court. Each service ends
	// with the markers of its sources (CitationMarks), and "Appeals go to"
	// with the markers of the sources that set the path of appeal. A group of
	// courts, such as a nation's district courts, lists each of its courts
	// under it, with where each one sits.
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import type { ServiceCategory, ServiceEntry } from '#lib/nation-services.ts';
	import CitationMarks from './CitationMarks.svelte';

	let { categories }: { categories: ServiceCategory[] } = $props();
</script>

{#snippet service(entry: ServiceEntry)}
	{#if entry.link}<a href={entry.link} target="_blank" rel="noopener noreferrer"
			>{entry.text}<span class="visually-hidden">{" "}(opens in a new tab)</span></a
		>{:else}{entry.text}{/if}{#if entry.detail}{' '}<span
			class="muted small">({entry.detail})</span
		>{/if}<CitationMarks marks={entry.citations} />{#if entry.location}{' '}<span class="muted small location"
			>{entry.location}</span
		>{/if}
	{#if entry.members && entry.members.length > 0}
		<ul class="members stacked-list" aria-label={`The ${entry.members.length} courts of ${entry.text}`}>
			{#each entry.members as member, index (index)}
				<li>{@render service(member)}</li>
			{/each}
		</ul>
	{/if}
{/snippet}

<dl class="summary-list services">
	{#each categories as category (category.id)}
		<div>
			<dt>{category.heading}</dt>
			<dd>
				{#each category.appealPaths as path, pathIndex (pathIndex)}
					<ol class="appeal-path" aria-label="How appeals move between courts">
						<li>
							<span class="step small muted">Cases start in</span>
							{#if path.first.length === 1}
								{@render service(path.first[0])}
							{:else}
								<ul class="first-courts stacked-list">
									{#each path.first as entry, index (index)}
										<li>{@render service(entry)}</li>
									{/each}
								</ul>
							{/if}
						</li>
						{#each path.then as step, index (index)}
							<li>
								<span class="step small muted"
									><ArrowDown aria-hidden="true" size="1em" /><span
										>Appeals go to<CitationMarks marks={step.citations} /></span
									></span
								>
								{@render service(step.court)}
							</li>
						{/each}
					</ol>
				{/each}
				{#if category.entries.length > 0}
					{#if category.appealPaths.length > 0}
						<p class="small muted other">Other courts</p>
					{/if}
					<ul class="stacked-list">
						{#each category.entries as entry, index (index)}
							<li>{@render service(entry)}</li>
						{/each}
					</ul>
				{/if}
			</dd>
		</div>
	{/each}
</dl>

<style>
	/*
	 * A service's name is a link, so its line has no plain text around the
	 * markers, and WCAG 2.5.8 (target size) applies to each marker. Each one
	 * gets a 24px box, so markers side by side or on the next line never
	 * crowd one another.
	 */
	.services :global(.note-marker) {
		display: inline-block;
		min-width: 24px;
		min-height: 24px;
		text-align: center;
	}

	.appeal-path {
		list-style: none;
		margin: 0 0 var(--space-3);
		padding: 0;
	}

	.appeal-path > li {
		margin: 0;
		padding: var(--space-1) 0 var(--space-1) var(--space-3);
		border-left: 3px solid var(--color-line);
	}

	.appeal-path > li + li {
		margin-top: var(--space-1);
	}

	/* The space below keeps the source marker in "Appeals go to" clear of the court's link under it, so both stay easy to tap (WCAG 2.2, 2.5.8). */
	.step {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		margin-bottom: var(--space-1);
	}

	.first-courts {
		margin: 0;
	}

	.location::before {
		content: '· ';
	}

	/* A group's courts sit indented under it, without bullets (Trevor, Nov. 23, 2026). */
	.members {
		margin: var(--space-1) 0 0;
		padding-left: var(--space-4);
	}

	/* A long list of courts takes two columns where each can be 16rem wide. */
	.members:has(> li:nth-child(7)) {
		columns: var(--layout-card-min) 2;
		column-gap: var(--space-5);
	}

	.members > li {
		break-inside: avoid;
	}

	.other {
		margin: var(--space-3) 0 var(--space-1);
	}

	dd > ul {
		margin: 0;
		padding-left: var(--space-5);
	}
</style>
