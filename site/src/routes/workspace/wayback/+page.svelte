<script lang="ts">
	// Links the Wayback Worker could not save (site/WAYBACK.md, "Links that fail").
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
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

	const status = $derived(data.status);

	// The Worker runs every minute, so the page asks again every minute.
	$effect(() => {
		const timer = setInterval(() => void invalidateAll(), 60_000);
		return () => clearInterval(timer);
	});
	const number = (value: number) => value.toLocaleString('en-US');

	function minutesAgo(stamp: string | null): string {
		if (!stamp) return '';
		const minutes = Math.max(0, Math.round((Date.now() - Date.parse(stamp)) / 60_000));
		return minutes === 0 ? 'asked this minute' : `asked ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
	}

	function when(stamp: string | null): string {
		return stamp ? new Date(stamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Los_Angeles' }) + ' Pacific' : '';
	}
</script>

<svelte:head>
	<title>Wayback captures · Workspace · Tribal Law Project</title>
</svelte:head>

<h1>Wayback captures</h1>
<p class="muted">
	Links the Wayback Worker could not save. Open a link to see whether it still works, try saving it from your own browser, then mark what happened. If you can get the file itself, send it from here and it goes through the
	usual upload checks. Overall progress is on the <a href={data.progressPage}>Worker’s progress page</a>.
</p>

<section class="now" aria-labelledby="right-now">
	<h2 id="right-now">Right now</h2>
	{#if !status}
		<p class="small problem">The Worker’s progress can’t be read: {data.statusProblem}</p>
	{:else}
		<p><span class="state" class:state-problem={status.state === 'not-running' || status.state === 'keys-refused'}>{status.stateWords}</span></p>
		{#if status.paused}
			<p class="small problem">Paused until {when(status.paused.until)}: {status.paused.reason}.</p>
		{/if}
		{#if status.nextRetryAt}
			<p class="small">Nothing new to save. The next failed link is tried again {when(status.nextRetryAt)}.</p>
		{/if}
		{#if status.savingNow?.length}
			<p class="small">Waiting on the Archive for {status.savingNow.length} save{status.savingNow.length === 1 ? '' : 's'}:</p>
			<ul class="saving">
				{#each status.savingNow as item (item.key)}
					<li class="small">
						<a href={item.link} target="_blank" rel="noopener noreferrer">{item.link} <ExternalLink size={14} aria-hidden="true" /></a>
						<span class="muted">· {minutesAgo(item.askedAt)}</span>
					</li>
				{/each}
			</ul>
		{:else if status.savingNow}
			<p class="small muted">No saves waiting on the Archive.</p>
		{/if}
		<dl class="usage">
			{#if status.requests}
				<div><dt>Save requests, last minute</dt><dd>{status.requests.lastMinute} of {status.requests.ourLimitEachMinute}</dd></div>
				<div><dt>Last hour</dt><dd>{number(status.requests.lastHour)} of {number(status.requests.ourLimitEachMinute * 60)}</dd></div>
				<div><dt>Last 24 hours</dt><dd>{number(status.requests.last24Hours)} of {number(status.requests.archiveLimitEachDay)}</dd></div>
			{/if}
			{#if status.capturedLastHour !== undefined}
				<div><dt>Captured, last hour</dt><dd>{number(status.capturedLastHour)}</dd></div>
			{/if}
			<div><dt>Captured, last 24 hours</dt><dd>{number(status.capturedLast24Hours)}</dd></div>
			<div><dt>Left</dt><dd>{number(status.left)}</dd></div>
		</dl>
	{/if}
</section>

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
	.now {
		margin: 16px 0 24px;
	}
	.now h2 {
		margin: 0 0 8px;
	}
	.now p {
		margin: 0 0 8px;
	}
	.state {
		display: inline-block;
		padding: 2px 10px;
		border: 1px solid var(--color-line);
		border-radius: 999px;
		font-weight: 600;
	}
	.state-problem {
		color: var(--color-danger);
		border-color: currentColor;
	}
	.saving {
		margin: 0 0 8px;
		padding-left: 1.25rem;
	}
	.saving a {
		overflow-wrap: anywhere;
	}
	.usage {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		gap: 8px;
		margin: 12px 0 0;
	}
	.usage div {
		border: 1px solid var(--color-line);
		border-radius: 8px;
		padding: 8px 12px;
	}
	.usage dt {
		font-size: 0.875rem;
		opacity: 0.8;
	}
	.usage dd {
		margin: 2px 0 0;
		font-size: 1.25rem;
		font-variant-numeric: tabular-nums;
	}
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
