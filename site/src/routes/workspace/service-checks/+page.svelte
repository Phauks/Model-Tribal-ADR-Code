<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const stateLabels = {
		working: 'Working',
		warning: 'Needs a look',
		problem: 'Not working',
		off: 'Not set up'
	} as const;

	const groups = $derived([...new Set(data.results.map((result) => result.group))]);
	const counts = $derived({
		problem: data.results.filter((result) => result.state === 'problem').length,
		warning: data.results.filter((result) => result.state === 'warning').length,
		off: data.results.filter((result) => result.state === 'off').length,
		working: data.results.filter((result) => result.state === 'working').length
	});
	const checkedAt = $derived(
		new Date(data.checkedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Los_Angeles' })
	);
</script>

<svelte:head>
	<title>Service checks · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<h1>Service checks</h1>
<p class="lead">
	{counts.working} working, {counts.warning} needing a look, {counts.problem} not working, {counts.off} not set up.
</p>
<p class="small">
	Checked {checkedAt} Pacific time{#if data.buildCommit}, on the deploy built from commit <code>{data.buildCommit.slice(0, 7)}</code>{/if}. Each check reads a setting and, where the service allows, asks it for something harmless: Lulu and Stripe are asked to read their webhooks, and the outreach mailbox is signed in to and left without sending. Nothing is changed, sent or paid, and secrets are never shown.
	<a href="/workspace/service-checks">Check again</a>. Only the lead author sees this page.
</p>

{#if counts.problem > 0}
	<div class="notice notice-problem" role="alert">
		<p>Not working: {data.results.filter((result) => result.state === 'problem').map((result) => result.name).join(', ')}.</p>
	</div>
{/if}

{#each groups as group (group)}
	<section aria-labelledby="group-{group}">
		<h2 id="group-{group}">{group}</h2>
		<ul class="checks">
			{#each data.results.filter((result) => result.group === group) as result (result.key)}
				<li class="check check-{result.state}">
					<p class="heading">
						<strong>{result.name}</strong>
						<span class="state">{stateLabels[result.state]}</span>
						<span class="small muted">{result.milliseconds} ms</span>
					</p>
					<p>{result.summary}</p>
					{#if result.details.length > 0}
						<ul class="small details">
							{#each result.details as detail (detail)}<li>{detail}</li>{/each}
						</ul>
					{/if}
					{#if result.fix && result.state !== 'working'}
						<p class="small"><strong>What to do:</strong> {result.fix}</p>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/each}

<style>
	.checks {
		list-style: none;
		padding: 0;
		max-width: var(--layout-measure);
	}

	.check {
		border: 1px solid var(--color-line);
		border-left-width: 6px;
		border-radius: var(--radius-control);
		padding: var(--space-3) var(--space-4);
		margin-bottom: var(--space-3);
	}

	.check > p {
		margin: 0 0 var(--space-1);
	}

	.heading {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: baseline;
	}

	.state {
		font-weight: var(--font-weight-semibold);
	}

	.check-working {
		border-left-color: var(--color-link);
	}

	.check-warning {
		border-left-color: var(--color-action);
	}

	.check-problem {
		border-left-color: var(--color-danger);
	}

	.check-problem .state {
		color: var(--color-danger);
	}

	.check-off {
		border-left-color: var(--color-line);
	}

	.check-off .state {
		color: var(--color-ink-muted);
	}

	.details {
		margin: var(--space-1) 0;
	}
</style>
