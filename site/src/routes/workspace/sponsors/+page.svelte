<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Sponsors · Workspace · Model Tribal ADR Code</title>
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

<h2>Every sponsor</h2>
{#if data.sponsors.length === 0}
	<p>No one has started a sponsorship yet. To see the page a new sponsor sees, open <a href="/account/sponsorship">your own Sponsorship page</a>.</p>
{:else}
	<div class="table-scroll">
		<table>
			<thead>
				<tr>
					<th scope="col">Sponsor</th>
					<th scope="col">In public</th>
					<th scope="col">Managers</th>
					<th scope="col">Test gifts</th>
					<th scope="col">Live gifts</th>
					<th scope="col">Their page</th>
				</tr>
			</thead>
			<tbody>
				{#each data.sponsors as sponsor (sponsor.identifier)}
					<tr>
						<td><a href="/workspace/sponsors/{sponsor.identifier}">{sponsor.name}</a></td>
						<td>
							{#if sponsor.shown && sponsor.listing !== 'anonymous'}<a href="/sponsors/{sponsor.slug}">Shown</a>{:else}{sponsor.reason}{/if}
						</td>
						<td>{sponsor.managers}</td>
						<td>{sponsor.test.count} ({sponsor.test.total}){sponsor.stripeTest ? '' : ' · no Stripe customer'}</td>
						<td>{sponsor.live.count} ({sponsor.live.total}){sponsor.stripeLive ? '' : ' · no Stripe customer'}</td>
						<td><a href="/account/sponsorship?sponsor={sponsor.identifier}">See as they do</a></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
