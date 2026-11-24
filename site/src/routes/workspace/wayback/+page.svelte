<script lang="ts">
	// Links the Wayback Worker could not save (site/WAYBACK.md, "Links that fail").
	import { enhance } from '$app/forms';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const markLabels = {
		'saved-by-hand': 'Saved by hand',
		'failed-by-hand': 'Failed by hand too',
		'file-sent': 'File sent'
	} as const;

	let shown = $state<'open' | 'marked'>('open');
	const open = $derived(data.rows.filter((row) => !row.mark));
	const marked = $derived(data.rows.filter((row) => row.mark));
	const visible = $derived(shown === 'open' ? open : marked);

	function when(stamp: string | null): string {
		return stamp ? new Date(stamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Los_Angeles' }) + ' Pacific' : '';
	}
</script>

<svelte:head>
	<title>Wayback captures · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<h1>Wayback captures</h1>
<p class="muted">
	Links the Wayback Worker could not save. Open a link to see whether it still works, try saving it from your own browser, then mark what happened. If you can get the file itself, send it from here and it goes through the
	usual upload checks. Overall progress is on the <a href="https://model-tribal-adr-code-wayback.trevordgoldsmith.workers.dev/">Worker’s progress page</a>.
</p>

{#if !data.connected}
	<p>The Wayback Worker hasn’t run yet, so there is nothing to show. Its setup is in site/WAYBACK.md.</p>
{:else}
	<div class="tabs" role="radiogroup" aria-label="Show">
		<button type="button" role="radio" aria-checked={shown === 'open'} onclick={() => (shown = 'open')}>Needs a look ({open.length})</button>
		<button type="button" role="radio" aria-checked={shown === 'marked'} onclick={() => (shown = 'marked')}>Marked ({marked.length})</button>
	</div>

	{#if visible.length === 0}
		<p class="muted">{shown === 'open' ? 'No failed links need a look.' : 'Nothing is marked yet.'}</p>
	{:else}
		<ul class="rows">
			{#each visible as row (row.key)}
				<li>
					<p class="key"><code>{row.key}</code></p>
					<p class="link"><a href={row.link} target="_blank" rel="noopener noreferrer">{row.link} <ExternalLink size={14} aria-hidden="true" /></a></p>
					{#if row.problem}
						<p class="small muted">
							{row.problem} · {row.gaveUp ? `gave up after ${data.mostTries} tries` : `try ${row.tries} of ${data.mostTries}`}{#if row.failedAt}
								· {when(row.failedAt)}{/if}
						</p>
					{/if}
					{#if form?.key === row.key && form?.problem}
						<p class="small problem" role="alert">{form.problem}</p>
					{/if}

					{#if row.mark}
						<p class="small">
							<strong>{markLabels[row.mark.kind]}</strong> by {row.mark.by}, {when(row.mark.at)}{#if row.mark.capture}
								· <a href={row.mark.capture.link} target="_blank" rel="noopener noreferrer">capture of {row.mark.capture.captured}</a>{/if}
						</p>
						<form method="POST" action="?/clear" use:enhance>
							<input type="hidden" name="key" value={row.key} />
							<button type="submit" class="button button-quiet">Clear the mark</button>
						</form>
					{:else}
						<div class="actions">
							<a class="button button-quiet" href={row.saveLink} target="_blank" rel="noopener noreferrer">Save it yourself <ExternalLink size={14} aria-hidden="true" /></a>
							<form method="POST" action="?/mark" use:enhance>
								<input type="hidden" name="key" value={row.key} />
								<input type="hidden" name="kind" value="failed-by-hand" />
								<button type="submit" class="button button-quiet">It failed for me too</button>
							</form>
							<a class="button button-quiet" href={row.uploadLink}>Send a file</a>
							<form method="POST" action="?/mark" use:enhance>
								<input type="hidden" name="key" value={row.key} />
								<input type="hidden" name="kind" value="file-sent" />
								<button type="submit" class="button button-quiet">I sent a file</button>
							</form>
						</div>
						<form class="saved" method="POST" action="?/mark" use:enhance>
							<input type="hidden" name="key" value={row.key} />
							<input type="hidden" name="kind" value="saved-by-hand" />
							<label for="capture-{row.key}" class="small">If your save worked, paste its Wayback link</label>
							<div class="saved-row">
								<input id="capture-{row.key}" name="capture" type="url" placeholder="https://web.archive.org/web/…" required />
								<button type="submit" class="button">Saved</button>
							</div>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
{/if}

<style>
	.tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 16px 0;
	}
	.tabs button {
		min-height: 44px;
		padding: 0 14px;
		border: 1px solid var(--color-line);
		border-radius: 999px;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.tabs button[aria-checked='true'] {
		font-weight: 600;
		outline: 2px solid currentColor;
		outline-offset: -2px;
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.rows li {
		border-top: 1px solid var(--color-line);
		padding: 16px 0;
	}
	.rows p {
		margin: 0 0 6px;
	}
	.link a {
		overflow-wrap: anywhere;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 10px 0;
	}
	.actions form {
		margin: 0;
	}
	.saved label {
		display: block;
		margin-bottom: 4px;
	}
	.saved-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.saved-row input {
		flex: 1 1 16rem;
		min-height: 44px;
		min-width: 0;
	}
	.problem {
		color: var(--color-danger);
	}
</style>
