<script lang="ts">
	// A nation's courts and dispute resolution services, one heading per kind
	// of service, so the kind is said once (src/lib/nation-services.ts).
	// Where sources record it, the courts show how appeals move, from the
	// court that hears a case first to the highest court. Each fact's source
	// is listed in the page's Sources section, not beside it.
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import type { ServiceCategory, ServiceEntry } from '#lib/nation-services.ts';

	let { categories }: { categories: ServiceCategory[] } = $props();
</script>

{#snippet service(entry: ServiceEntry)}
	{#if entry.link}<a href={entry.link} target="_blank" rel="noopener noreferrer"
			>{entry.text}<span class="visually-hidden">{" "}(opens in a new tab)</span></a
		>{:else}{entry.text}{/if}{#if entry.detail}{' '}<span
			class="muted small">({entry.detail})</span
		>{/if}
{/snippet}

<dl class="summary-list">
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
								<ul class="first-courts">
									{#each path.first as entry, index (index)}
										<li>{@render service(entry)}</li>
									{/each}
								</ul>
							{/if}
						</li>
						{#each path.then as entry, index (index)}
							<li>
								<span class="step small muted"
									><ArrowDown aria-hidden="true" size="1em" /> Appeals go to</span
								>
								{@render service(entry)}
							</li>
						{/each}
					</ol>
				{/each}
				{#if category.entries.length > 0}
					{#if category.appealPaths.length > 0}
						<p class="small muted other">Other courts</p>
					{/if}
					<ul>
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

	.step {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.first-courts {
		margin: 0;
		padding-left: var(--space-5);
	}

	.other {
		margin: var(--space-3) 0 var(--space-1);
	}

	dd > ul {
		margin: 0;
		padding-left: var(--space-5);
	}
</style>
