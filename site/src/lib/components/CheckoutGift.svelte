<script lang="ts">
	// The optional gift added to a purchase (src/lib/checkout-gift.ts;
	// docs/book-orders.md, "Adding a gift"): No thanks is chosen until the
	// buyer picks something else. It shows the price, the gift and the total,
	// so nothing on Stripe's page is a surprise. Paid event tickets reuse it.
	import { centsFromText, giftCents, giftPresets, roundUpCents, type GiftChoice } from '#lib/checkout-gift.ts';
	import { formatDollars } from '#lib/book-order.ts';

	interface Props {
		/** The purchase's own price, in cents. */
		priceCents: number;
		/** What the purchase line says, such as "Printed copy, shipping and tax". */
		priceLabel: string;
		/** Who receives the gift. */
		receiver: string;
		choice: GiftChoice;
		/** The gift in cents, or null while the "other" amount cannot be read. */
		cents?: number | null;
	}

	let { priceCents, priceLabel, receiver, choice = $bindable(), cents = $bindable(0) }: Props = $props();

	let picked = $state<string>('none');
	let otherText = $state('');

	const roundUp = $derived(roundUpCents(priceCents));
	const money = (amount: number) => formatDollars(amount / 100);

	$effect(() => {
		if (picked === 'none') choice = { kind: 'none' };
		else if (picked === 'round-up') choice = { kind: 'round-up' };
		else if (picked === 'other') choice = { kind: 'other', cents: centsFromText(otherText) };
		else choice = { kind: 'preset', dollars: Number(picked) as (typeof giftPresets)[number] };
	});

	const result = $derived(giftCents(choice, priceCents));
	$effect(() => {
		cents = 'cents' in result ? result.cents : null;
	});
	const shownGift = $derived('cents' in result ? result.cents : 0);
</script>

<section class="panel checkout-gift" aria-labelledby="checkout-gift-heading">
	<h2 id="checkout-gift-heading">Add a gift to the project? <span class="muted">(optional)</span></h2>
	<p class="small">
		Everything in the book stays free on this website. A gift on top of your order helps send printed copies to Tribal
		Nations’ courts and keeps the site running.
	</p>
	<fieldset class="choices">
		<legend class="visually-hidden">Gift amount</legend>
		<label class="chip">
			<input type="radio" name="checkout-gift" value="none" bind:group={picked} />
			No thanks
		</label>
		{#if roundUp > 0}
			<label class="chip">
				<input type="radio" name="checkout-gift" value="round-up" bind:group={picked} />
				Round up to {money(priceCents + roundUp)} <span class="muted">(+{money(roundUp)})</span>
			</label>
		{/if}
		{#each giftPresets as preset (preset)}
			<label class="chip">
				<input type="radio" name="checkout-gift" value={String(preset)} bind:group={picked} />
				${preset}
			</label>
		{/each}
		<label class="chip">
			<input type="radio" name="checkout-gift" value="other" bind:group={picked} />
			Other
		</label>
	</fieldset>
	{#if picked === 'other'}
		<div class="field other">
			<label for="checkout-gift-other">Gift amount in US dollars</label>
			<input id="checkout-gift-other" type="text" inputmode="decimal" autocomplete="off" bind:value={otherText} />
			{#if otherText && 'problem' in result}<p class="field-error" role="alert">{result.problem}</p>{/if}
		</div>
	{/if}
	<p class="small muted">
		The gift is separate from the book’s price: Lulu doesn’t receive it, and it shows as its own line on your receipt.
		It goes to {receiver}.
	</p>
	<table class="totals">
		<caption class="visually-hidden">Your total</caption>
		<tbody>
			<tr><th scope="row">{priceLabel}</th><td>{money(priceCents)}</td></tr>
			<tr><th scope="row">Gift to the project</th><td>{money(shownGift)}</td></tr>
			<tr class="total"><th scope="row">Total</th><td>{money(priceCents + shownGift)}</td></tr>
		</tbody>
	</table>
</section>

<style>
	h2 .muted {
		font-weight: var(--font-weight-regular);
	}

	.choices {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: var(--space-3) 0;
		padding: 0;
		border: 0;
	}

	.chip {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 44px;
		padding: var(--space-1) var(--space-3);
		border: 1px solid var(--color-control-border);
		border-radius: 999px;
		cursor: pointer;
	}

	.chip:has(input:checked) {
		border-color: var(--color-action);
		box-shadow: 0 0 0 1px var(--color-action);
	}

	.chip input {
		width: 1.1rem;
		height: 1.1rem;
		margin: 0;
		accent-color: var(--color-action);
	}

	.other input {
		max-width: 10rem;
	}

	.totals {
		width: 100%;
		border-collapse: collapse;
		margin-top: var(--space-3);
	}

	.totals th,
	.totals td {
		padding: var(--space-1) 0;
		border-bottom: 1px solid var(--color-line);
		font-weight: var(--font-weight-regular);
		text-align: left;
	}

	.totals td {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.totals .total th,
	.totals .total td {
		font-weight: var(--font-weight-bold);
		border-bottom: 0;
	}
</style>
