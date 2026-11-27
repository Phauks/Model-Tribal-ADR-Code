<script lang="ts">
	import type { Snippet } from 'svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import { costItemQuestions, costItemUnits, costItems } from '#lib/sponsorship.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import { levelNames, levels, monthsInAYear } from '#lib/sponsorship-levels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const sponsorColumns: TableColumn[] = [
		{ key: 'sponsor', header: 'Sponsor', isRowHeader: true, sortable: true, searchable: true },
		{ key: 'public', header: 'In public', sortable: true, custom: true },
		{ key: 'managers', header: 'Managers', sortable: true },
		{ key: 'test', header: 'Test gifts', type: 'number', sortable: true },
		{ key: 'live', header: 'Live gifts', type: 'number', sortable: true },
		{ key: 'page', header: 'Their page', keepOutOfDownload: true }
	];
	const gifts = (side: { count: number; total: string }, customer: unknown) => `${side.count} (${side.total})${customer ? '' : ' · no Stripe customer'}`;
	const sponsorRows: TableRow[] = $derived(
		data.sponsors.map((sponsor) => ({
			key: sponsor.identifier,
			cells: {
				sponsor: { text: sponsor.name, href: `/workspace/sponsors/${sponsor.identifier}` },
				public: { text: sponsor.shown && sponsor.listing !== 'anonymous' ? 'Shown' : sponsor.reason },
				managers: { text: String(sponsor.managers) },
				test: { text: gifts(sponsor.test, sponsor.stripeTest), sortValue: sponsor.test.count },
				live: { text: gifts(sponsor.live, sponsor.stripeLive), sortValue: sponsor.live.count },
				page: { text: 'See as they do', href: `/account/sponsorship?sponsor=${sponsor.identifier}` }
			}
		}))
	);
	const sponsors = $derived(new Map(data.sponsors.map((sponsor) => [sponsor.identifier, sponsor])));
</script>

<svelte:head>
	<title>Sponsors · Workspace · Tribal Law Project</title>
</svelte:head>

<h1>Sponsors</h1>
<p>
	Every sponsorship, whether gifts work, and why a sponsor shows in public or not. Open a sponsor’s own page to see it
	exactly as its managers do; it only reads there. Amounts show here and to the sponsor’s own managers, never in public.
</p>

<section class="panel" aria-labelledby="gifts-heading">
	<h2 id="gifts-heading">Can sponsors give?</h2>
	{#if data.open}
		<p><strong>Yes, in {data.mode} mode.</strong>{data.mode === 'test' ? ' Only Stripe’s test cards work; no real money moves.' : ''}</p>
	{:else}
		<p><strong>No.</strong> Sponsors read: “{data.reason}”</p>
	{/if}
	<div class="table-scroll">
		<table>
			<thead>
				<tr><th scope="col">Setting</th><th scope="col">State</th><th scope="col">Detail</th></tr>
			</thead>
			<tbody>
				{#each data.checks as check (check.name)}
					<tr>
						<td><code>{check.name}</code></td>
						<td>{check.ok ? 'Right' : 'Needs a change'}</td>
						<td>{check.detail}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="small">
		Settings are set in the Cloudflare dashboard, as secrets, never in the repository. Stripe’s webhook endpoint for gifts
		is <code>{data.webhookAddress}</code>, with the events <code>checkout.session.completed</code>,
		<code>checkout.session.async_payment_succeeded</code> and <code>invoice.paid</code>. Stripe’s billing page needs its
		settings saved once in Stripe’s dashboard for each mode.
	</p>
	<p class="small muted">The public pages count {data.publicMode} gifts.</p>
</section>

<section class="panel" aria-labelledby="costs-heading">
	<h2 id="costs-heading">Costs on the Sponsorship page</h2>
	<p>
		The <a href="/sponsor">Sponsorship page</a> shows a cost, and how much of it gifts have paid, only once it is set here. Leave
		a box blank until the price is known.
	</p>
	{#if form && 'problem' in form}
		<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
	{:else if form && 'done' in form}
		<div class="notice" role="status"><p>{form.done}</p></div>
	{/if}
	<form method="post" action="?/costs">
		{#each costItems as item (item)}
			<div class="field">
				<label for="cost-{item}">{costItemQuestions[item]}</label>
				<p class="hint">US dollars a {costItemUnits[item]}.</p>
				<input id="cost-{item}" name={item} type="text" inputmode="decimal" value={data.costs[item]} class="amount" />
			</div>
		{/each}
		<button class="button" type="submit">Save costs</button>
	</form>
</section>

<section class="panel" aria-labelledby="levels-heading">
	<h2 id="levels-heading">Sponsorship levels</h2>
	<p>
		What each level on the <a href="/sponsor/levels">Sponsorship levels page</a> costs a month. A year costs {monthsInAYear}
		months. Each level must cost more than the one before it.
	</p>
	{#if form && 'levelProblem' in form}
		<div class="notice notice-problem" role="alert"><p>{form.levelProblem}</p></div>
	{:else if form && 'levelsDone' in form}
		<div class="notice" role="status"><p>{form.levelsDone}</p></div>
	{/if}
	<form method="post" action="?/levels">
		{#each levels as level (level)}
			<div class="field">
				<label for="level-{level}">{levelNames[level]}</label>
				<p class="hint">US dollars a month.</p>
				<input id="level-{level}" name="level-{level}" type="text" inputmode="decimal" required value={data.levelAmounts[level]} class="amount" />
			</div>
		{/each}
		<button class="button" type="submit">Save levels</button>
	</form>
</section>

{#if data.sponsors.length === 0}
	<h2>Every sponsor</h2>
	<p>No one has started a sponsorship yet. To see the page a new sponsor sees, open <a href="/account/sponsorship">your own Sponsorship page</a>.</p>
{:else}
	<DataTable identifier="sponsors" label="Table: every sponsor" columns={sponsorColumns} rows={sponsorRows} rowName={['sponsor', 'sponsors']}>
		{#snippet heading(count: Snippet)}<h2>Every sponsor {@render count()}</h2>{/snippet}
		{#snippet cell(row)}
			{@const sponsor = sponsors.get(row.key)}
			{#if sponsor?.shown && sponsor.listing !== 'anonymous'}<a href="/sponsors/{sponsor.slug}">Shown</a>{:else if sponsor}{sponsor.reason}{/if}
		{/snippet}
	</DataTable>
{/if}

<style>
	.amount {
		max-width: 12rem;
	}
</style>
