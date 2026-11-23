<script lang="ts">
	import { page } from '$app/state';
	import SponsorCard from '#lib/components/SponsorCard.svelte';
	import { readableDate } from '#lib/readable-date.ts';
	import { earmarkLabels, earmarks, giftFrequencies, giftFrequencyLabels, listingLabels, listings } from '#lib/sponsorship.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const thanked = $derived(page.url.searchParams.get('gift') === 'thanks');
	const day = (time: string | null) => (time ? readableDate(time.slice(0, 10)) : '');
	const month = (time: string | null) => (time ? readableDate(time.slice(0, 7)) : '');
</script>

<svelte:head>
	<title>Sponsorship · Model Tribal ADR Code</title>
</svelte:head>

{#if data.viewingAs && data.sponsor}
	<div class="notice" role="note">
		<p>
			<strong>You are seeing {data.sponsor.name}’s Sponsorship page as its managers see it.</strong> Nothing can be
			changed from here, because only the people who manage a sponsorship can change it.
			<a href="/workspace/sponsors/{data.sponsor.identifier}">Open the diagnostics for this sponsor</a>.
		</p>
	</div>
{/if}

<h1>Sponsorship</h1>
<p class="lead">
	Your organization’s gift and how the project thanks you in public. Anyone you add below can change these too.
</p>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status">
		<p>{form.done}</p>
		{#if 'invitationLink' in form && form.invitationLink}
			<label class="hint" for="invitation-link">Invitation link</label>
			<input id="invitation-link" type="text" readonly value={form.invitationLink} onfocus={(event) => event.currentTarget.select()} />
		{/if}
	</div>
{:else if thanked}
	<div class="notice" role="status">
		<p>Thank you. Stripe is confirming your gift, and it shows here within a few minutes. Stripe emails your receipt.</p>
	</div>
{/if}

{#if data.others.length > 0}
	<p class="small">
		You also manage:
		{#each data.others as other, index (other.identifier)}{index > 0 ? ', ' : ''}<a
				href="/account/sponsorship?sponsor={other.identifier}">{other.name}</a
			>{/each}.
	</p>
{/if}

{#if !data.sponsor}
	{#if !data.gifts.open}
		<div class="notice" role="note"><p>{data.gifts.reason}</p></div>
	{/if}
	<section class="panel">
		<h2>Become a sponsor</h2>
		<p>
			Sponsors are organizations, and people, who give to keep the project free for everyone. Start here, choose how
			you would like to be listed, then give once or every month on Stripe’s own page. The amount you give is never
			shown in public.
		</p>
		<form method="post" action="?/start">
			<div class="field">
				<label for="start-name">Name of the organization</label>
				<p class="hint">Or your own name, if you give as a person. You can change it later.</p>
				<input id="start-name" name="name" type="text" maxlength="120" required autocomplete="organization" />
			</div>
			<button class="button" type="submit">Start a sponsorship</button>
		</form>
	</section>
	{#if data.mayDiagnose}
		<p class="small muted">As the lead author, you can see every sponsor’s page from <a href="/workspace/sponsors">Sponsors</a>.</p>
	{/if}
{:else}
	{@const sponsor = data.sponsor}
	<fieldset class="whole" disabled={data.viewingAs}>
		<section class="panel" aria-labelledby="gift-heading">
			<h2 id="gift-heading">Your gift</h2>
			{#if !data.gifts.open}
				<div class="notice" role="note"><p>{data.gifts.reason}</p></div>
			{:else}
				{#if data.gifts.mode === 'test'}
					<p class="small"><strong>Test mode.</strong> Use Stripe’s test card 4242 4242 4242 4242. No real money moves.</p>
				{/if}
				{#if data.stripeProblem}
					<div class="notice notice-problem" role="alert"><p>{data.stripeProblem}</p></div>
				{/if}
				{#each data.monthly as gift (gift.identifier)}
					<dl class="facts">
						<dt>Amount</dt>
						<dd>{gift.amount} a {gift.interval}{gift.status !== 'active' ? ` (${gift.status.replaceAll('_', ' ')})` : ''}</dd>
						{#if gift.nextPayment}
							<dt>{gift.cancelAtPeriodEnd ? 'Ends' : 'Next payment'}</dt>
							<dd>{day(gift.nextPayment)}</dd>
						{/if}
						{#if gift.cardEnding}
							<dt>Paid with</dt>
							<dd>Card ending {gift.cardEnding}</dd>
						{/if}
					</dl>
				{/each}
				{#if data.totals.count > 0}
					<p>Sponsor since {month(data.totals.firstAt)}. Total given: {data.totals.total}.</p>
				{/if}
				{#if data.hasStripeCustomer}
					<form method="post" action="?/billing">
						<input type="hidden" name="sponsor" value={sponsor.identifier} />
						<p>
							<button class="button button-quiet" type="submit">Change amount, card or billing address, or get receipts</button>
						</p>
						<p class="small muted">These open on Stripe’s own page. This website never sees your card number.</p>
					</form>
				{/if}
				<form method="post" action="?/give" class="give">
					<input type="hidden" name="sponsor" value={sponsor.identifier} />
					<h3>{data.monthly.length > 0 ? 'Give a further gift' : 'Give'}</h3>
					<div class="field">
						<label for="gift-amount">Amount in US dollars</label>
						<p class="hint">From ${data.gifts.smallest} to ${data.gifts.largest.toLocaleString('en-US')}.</p>
						<input id="gift-amount" name="amount" type="text" inputmode="decimal" required class="amount" />
					</div>
					<fieldset class="choices">
						<legend>How often</legend>
						{#each giftFrequencies as frequency (frequency)}
							<div class="choice">
								<input type="radio" id="frequency-{frequency}" name="frequency" value={frequency} checked={frequency === 'monthly'} />
								<label for="frequency-{frequency}">{giftFrequencyLabels[frequency]}</label>
							</div>
						{/each}
					</fieldset>
					<p class="small">Your gift goes to {data.gifts.receiver}. You pay on Stripe’s own page.</p>
					<button class="button" type="submit">Continue to payment</button>
				</form>
			{/if}
		</section>

		<form method="post" action="?/save" enctype="multipart/form-data">
			<input type="hidden" name="sponsor" value={sponsor.identifier} />
			<section class="panel" aria-labelledby="earmark-heading">
				<h2 id="earmark-heading">Where your gift goes</h2>
				<fieldset class="choices">
					<legend class="visually-hidden">Where your gift goes</legend>
					{#each earmarks as earmark (earmark)}
						<div class="choice">
							<input type="radio" id="earmark-{earmark}" name="earmark" value={earmark} checked={sponsor.earmark === earmark} />
							<label for="earmark-{earmark}">{earmarkLabels[earmark]}</label>
						</div>
					{/each}
				</fieldset>
			</section>

			<section class="panel" aria-labelledby="listing-heading">
				<h2 id="listing-heading">How we list you</h2>
				<fieldset class="choices">
					<legend class="visually-hidden">How we list you</legend>
					{#each listings as listing (listing)}
						<div class="choice">
							<input type="radio" id="listing-{listing}" name="listing" value={listing} checked={sponsor.listing === listing} />
							<label for="listing-{listing}">{listingLabels[listing]}</label>
						</div>
					{/each}
				</fieldset>
				<div class="field">
					<label for="sponsor-name">Name shown</label>
					<input id="sponsor-name" name="name" type="text" maxlength="120" required value={sponsor.name} />
				</div>
				<div class="field">
					<label for="sponsor-link">Link (optional)</label>
					<p class="hint">Your website, starting with https://.</p>
					<input id="sponsor-link" name="link" type="text" inputmode="url" maxlength="300" value={sponsor.link ?? ''} />
				</div>
				<div class="field">
					<label for="sponsor-logo">Logo (optional)</label>
					<p class="hint">A PNG, JPEG or WebP image up to 512 KB. A square logo looks best.</p>
					<input id="sponsor-logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" />
					{#if sponsor.logoChecking}
						<p class="small">Your logo is being checked for viruses. It shows here and in public once the check passes, usually within a few minutes.</p>
					{/if}
					{#if sponsor.hasLogo}
						<div class="choice">
							<input type="checkbox" id="remove-logo" name="removeLogo" value="yes" />
							<label for="remove-logo">Remove the current logo</label>
						</div>
					{/if}
				</div>
				<div class="field">
					<label for="sponsor-line">One line about you (optional)</label>
					<input id="sponsor-line" name="oneLine" type="text" maxlength="160" value={sponsor.oneLine ?? ''} />
				</div>
				<button class="button" type="submit">Save</button>
			</section>
		</form>

		<section class="panel" aria-labelledby="managers-heading">
			<h2 id="managers-heading">People who manage this sponsorship</h2>
			<p class="small muted">Everyone here can change everything on this page, give, and change billing.</p>
			<ul class="people">
				{#each data.managers as manager (manager.account)}
					<li>
						<span>{manager.email}{manager.you ? ' · you' : ''}</span>
						{#if data.managers.length > 1}
							<form method="post" action="?/remove">
								<input type="hidden" name="sponsor" value={sponsor.identifier} />
								<input type="hidden" name="account" value={manager.account} />
								<button class="button button-quiet" type="submit">{manager.you ? 'Leave' : 'Remove'}</button>
							</form>
						{/if}
					</li>
				{/each}
				{#each data.invitations as invitation (invitation.identifier)}
					<li>
						<span>{invitation.label} · invited, link works until {day(invitation.expiresAt)}</span>
						<form method="post" action="?/withdraw">
							<input type="hidden" name="sponsor" value={sponsor.identifier} />
							<input type="hidden" name="invitation" value={invitation.identifier} />
							<button class="button button-quiet" type="submit">Withdraw</button>
						</form>
					</li>
				{/each}
			</ul>
			<form method="post" action="?/invite">
				<input type="hidden" name="sponsor" value={sponsor.identifier} />
				<div class="field">
					<label for="invite-label">Add someone</label>
					<p class="hint">
						Write their name or email address, so you can tell invitations apart. You get a link to send them yourself;
						it works once, for {data.invitationDays} days, and they sign in or make an account to accept it.
					</p>
					<input id="invite-label" name="label" type="text" maxlength="200" />
				</div>
				<button class="button button-quiet" type="submit">Make an invitation link</button>
			</form>
		</section>
	</fieldset>

	<section class="panel panel-filled" aria-labelledby="preview-heading">
		<h2 id="preview-heading">How you will appear on the Sponsorship page</h2>
		{#if data.sponsor.listing === 'hidden'}
			<p>You chose not to be listed, so you do not appear in public.</p>
		{:else}
			<SponsorCard
				sponsor={data.preview}
				logoAddress="/account/sponsorship/logo?sponsor={data.sponsor.identifier}"
				linkName={data.status.shown}
			/>
		{/if}
		<p class="small">
			{data.status.reason}
			{#if data.status.shown && data.sponsor.listing !== 'anonymous'}
				Your page: <a href="/sponsors/{data.sponsor.slug}">/sponsors/{data.sponsor.slug}</a>
			{/if}
		</p>
	</section>

	{#if data.history.length > 0}
		<section aria-labelledby="history-heading">
			<h2 id="history-heading">Recent changes</h2>
			<ul class="history small">
				{#each data.history as entry, index (index)}
					<li>{day(entry.createdAt)}: {entry.action}{entry.note && entry.actor !== 'Stripe' ? ` (${entry.note})` : ''}, by {entry.actor}</li>
				{/each}
			</ul>
		</section>
	{/if}
{/if}

<p class="small muted">Sponsors sign in with the same account as everyone else. The amount you give is never shown in public.</p>

<style>
	.whole {
		border: 0;
		margin: 0;
		padding: 0;
		min-width: 0;
	}

	.choices {
		margin: 0 0 var(--space-4);
		padding: 0;
		border: 0;
	}

	.choice {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		margin: var(--space-2) 0;
	}

	.choice input {
		margin-top: 0.3em;
		width: 1.25rem;
		height: 1.25rem;
		flex: none;
		accent-color: var(--color-action);
	}

	.amount {
		max-width: 12rem;
	}

	.facts {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--space-1) var(--space-4);
		margin: 0 0 var(--space-3);
	}

	.facts dt {
		font-weight: var(--font-weight-semibold);
	}

	.facts dd {
		margin: 0;
	}

	.give {
		border-top: 1px solid var(--color-line);
		margin-top: var(--space-4);
		padding-top: var(--space-3);
	}

	.people {
		list-style: none;
		padding: 0;
		margin: 0 0 var(--space-4);
	}

	.people li {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
		align-items: center;
		justify-content: space-between;
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-line);
		overflow-wrap: anywhere;
	}

	.people form {
		margin: 0;
	}

	.history {
		padding-left: var(--space-4);
	}
</style>
