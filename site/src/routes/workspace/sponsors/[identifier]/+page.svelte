<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import { readableDate } from '#lib/readable-date.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const day = (time: string) => readableDate(time.slice(0, 10));

	const giftColumns: TableColumn[] = [
		{ key: 'received', header: 'Received', type: 'date', sortable: true },
		{ key: 'mode', header: 'Mode', sortable: true, filterable: true },
		{ key: 'kind', header: 'Kind', sortable: true, filterable: true },
		{ key: 'amount', header: 'Amount', type: 'number', sortable: true },
		{ key: 'toward', header: 'Toward', sortable: true },
		{ key: 'stripe', header: 'Stripe', custom: true }
	];
	const giftRows: TableRow[] = $derived(
		data.gifts.map((gift) => ({
			key: gift.stripeObject,
			cells: {
				received: { text: day(gift.receivedAt), sortValue: gift.receivedAt },
				mode: { text: gift.mode },
				kind: { text: gift.kind },
				amount: { text: gift.amount, sortValue: Number(gift.amount.replace(/[^0-9.]/g, '')) },
				toward: { text: gift.earmark },
				stripe: { text: gift.stripeObject }
			}
		}))
	);
</script>

<svelte:head>
	<title>{data.sponsor.name} · Sponsors · Workspace · Tribal Law Project</title>
</svelte:head>

<Breadcrumbs
	trail={[
		{ label: 'Workspace', href: '/workspace' },
		{ label: 'Sponsors', href: '/workspace/sponsors' }
	]}
	current={data.sponsor.name}
/>
<h1>{data.sponsor.name}</h1>
<p>
	<a class="button" href="/account/sponsorship?sponsor={data.sponsor.identifier}">See their Sponsorship page as they do</a>
	{#if data.status.shown && data.sponsor.slug}
		<a class="button button-quiet" href="/sponsors/{data.sponsor.slug}">Their public page</a>
	{/if}
</p>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

<section class="panel" aria-labelledby="public-heading">
	<h2 id="public-heading">In public</h2>
	<p><strong>{data.status.shown ? 'Shown.' : 'Not shown.'}</strong> {data.status.reason} The public pages count {data.publicMode} gifts.</p>
	{#if data.sponsor.hiddenByProject}
		<p>Taken off by the project: {data.sponsor.hiddenNote}</p>
		<form method="post" action="?/show"><button class="button button-quiet" type="submit">Put back on the public pages</button></form>
	{:else}
		<form method="post" action="?/hide">
			<div class="field">
				<label for="hide-note">Take off the public pages</label>
				<p class="hint">Say why. The note goes in the sponsor’s history, which their managers see.</p>
				<input id="hide-note" name="note" type="text" maxlength="500" />
			</div>
			<button class="button button-quiet" type="submit">Take off</button>
		</form>
	{/if}
</section>

<section class="panel" aria-labelledby="details-heading">
	<h2 id="details-heading">Details</h2>
	<dl class="facts">
		<dt>Listing</dt><dd>{data.sponsor.listing}</dd>
		<dt>Gift goes to</dt><dd>{data.sponsor.earmark}</dd>
		<dt>Link</dt><dd>{data.sponsor.link ?? 'None'}</dd>
		<dt>One line</dt><dd>{data.sponsor.oneLine ?? 'None'}</dd>
		<dt>Logo</dt><dd>{data.sponsor.hasLogo ? 'Yes' : 'None'}</dd>
		<dt>Page address</dt><dd>/sponsors/{data.sponsor.slug}</dd>
		<dt>Stripe customer, test</dt><dd><code>{data.sponsor.stripeCustomerTest ?? 'None yet'}</code></dd>
		<dt>Stripe customer, live</dt><dd><code>{data.sponsor.stripeCustomerLive ?? 'None yet'}</code></dd>
		<dt>Started</dt><dd>{day(data.sponsor.createdAt)}</dd>
		<dt>Last changed</dt><dd>{day(data.sponsor.updatedAt)}</dd>
	</dl>
	<form method="post" action="?/check">
		<button class="button button-quiet" type="submit" disabled={!data.giftsOpen}>Ask Stripe about this sponsor</button>
		{#if !data.giftsOpen}<span class="small muted">Gifts are off, so the site does not call Stripe.</span>{/if}
	</form>
	{#if form && 'stripe' in form && form.stripe}
		<ul class="small">
			{#each form.stripe as line, index (index)}<li>{line}</li>{/each}
		</ul>
	{/if}
</section>

<section class="panel" aria-labelledby="managers-heading">
	<h2 id="managers-heading">Managers</h2>
	{#if data.managers.length === 0}
		<p>No one manages this sponsorship: everyone who did has deleted their account.</p>
	{:else}
		<ul>
			{#each data.managers as manager (manager.account)}<li>{manager.email}, since {day(manager.addedAt)}</li>{/each}
		</ul>
	{/if}
	{#if data.invitations.length > 0}
		<p>Open invitations:</p>
		<ul>
			{#each data.invitations as invitation (invitation.identifier)}<li>{invitation.label}, until {day(invitation.expiresAt)}</li>{/each}
		</ul>
	{/if}
</section>

<section aria-labelledby="gifts-heading">
	<h2 id="gifts-heading">Gifts</h2>
	{#if data.gifts.length === 0}
		<p>None yet. A gift shows here when Stripe’s webhook reports it.</p>
	{:else}
		<DataTable
			identifier="gifts"
			label="Table: gifts"
			columns={giftColumns}
			rows={giftRows}
			defaultSort={{ key: 'received', direction: 'descending' }}
			rowName={['gift', 'gifts']}
			filters
		>
			{#snippet cell(row)}<code>{row.key}</code>{/snippet}
		</DataTable>
	{/if}
</section>

<section aria-labelledby="history-heading">
	<h2 id="history-heading">History</h2>
	<ul class="small">
		{#each data.history as entry, index (index)}
			<li>{entry.createdAt.slice(0, 16).replace('T', ' ')} UTC: {entry.action}{entry.note ? ` (${entry.note})` : ''}, by {entry.actor}</li>
		{/each}
	</ul>
</section>

<style>
	.facts {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--space-1) var(--space-4);
		margin: 0 0 var(--space-4);
		overflow-wrap: anywhere;
	}

	.facts dt {
		font-weight: var(--font-weight-semibold);
	}

	.facts dd {
		margin: 0;
	}
</style>
