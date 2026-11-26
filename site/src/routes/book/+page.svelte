<script lang="ts">
	// Order a printed copy (docs/book-orders.md). The page is built ahead of time; prices and orders go to the
	// Worker (/book/quote, /book/order), which answers only once ordering is
	// open. Until then the reader sees an estimate from Lulu's calculator.
	import {
		bindingChoices,
		bookSizes,
		defaultPrintChoice,
		estimatedPrintCost,
		finishChoices,
		foilColors,
		formatDollars,
		fulfillmentFee,
		inkChoices,
		linenColors,
		lowestUnitedStatesShipping,
		paperChoices,
		shippingChoices,
		soldInBookstores,
		type PrintChoice,
		type ShippingLevel
	} from '#lib/book-order.ts';
	import type { GiftChoice } from '#lib/checkout-gift.ts';
	import CheckoutGift from '#lib/components/CheckoutGift.svelte';
	import Dropdown from '#lib/components/Dropdown.svelte';

	/** Until the first edition exists, estimates use this page count. */
	const estimatePages = 300;

	let choice = $state<PrintChoice>({ ...defaultPrintChoice });
	const sizeChoices = bookSizes.map((size) => ({ value: size.identifier, label: `${size.name} (${size.width} × ${size.height} in)` }));
	const linenChoices = linenColors.map((color) => ({ value: color, label: color }));
	const foilChoices = foilColors.map((color) => ({ value: color, label: color }));
	let shippingLevel = $state<ShippingLevel>('MAIL');
	let address = $state({ name: '', street1: '', street2: '', city: '', stateCode: '', postcode: '', countryCode: 'US', phone: '' });
	let email = $state('');

	interface Speed {
		level: ShippingLevel;
		priceCents: number;
		parts: { label: string; cents: number }[];
	}
	let quote = $state<{ pages: number; mode: string; speeds: Speed[]; giftReceiver: string | null } | undefined>();
	const chosenSpeed = $derived(quote?.speeds.find((speed) => speed.level === shippingLevel));
	// An optional gift to the project, added only if the reader picks one (docs/book-orders.md, "Adding a gift").
	let gift = $state<GiftChoice>({ kind: 'none' });
	let giftCents = $state<number | null>(0);
	let problem = $state('');
	let closedReason = $state('');
	let busy = $state(false);

	const estimate = $derived(estimatedPrintCost(choice, estimatePages));
	const bookstore = $derived(soldInBookstores(choice));

	// Prices are for one book and one postal code; changing either asks again.
	// Choosing another speed, or filling in the street, keeps them.
	$effect(() => {
		JSON.stringify([choice, address.countryCode, address.stateCode, address.postcode]);
		quote = undefined;
	});

	function payload() {
		return JSON.stringify({ choice, shippingLevel, address, email, gift });
	}

	async function getPrice() {
		busy = true;
		problem = '';
		try {
			const response = await fetch('/book/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload() });
			const answer = await response.json();
			if (response.status === 503) closedReason = answer.reason;
			else if (!answer.available) problem = answer.reason;
			else {
				quote = answer;
				if (!answer.speeds.some((speed: Speed) => speed.level === shippingLevel)) shippingLevel = answer.speeds[0].level;
			}
		} catch {
			problem = 'The price could not be fetched. Check your connection and try again.';
		} finally {
			busy = false;
		}
	}

	async function order(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		problem = '';
		try {
			const response = await fetch('/book/order', { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload() });
			const answer = await response.json();
			if (answer.placed) window.location.assign(answer.payAt);
			else if (response.status === 503) closedReason = answer.reason;
			else problem = answer.reason;
		} catch {
			problem = 'The order could not be sent. Check your connection and try again.';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Order a printed copy · Tribal Law Project</title>
</svelte:head>

<div class="reading">
	<h1>Order a printed copy</h1>
	<p class="lead">
		Everything in the book is free on this website. If you want it on paper, Lulu prints a copy when you
		order it and mails it to you. You pay what Lulu charges for printing, shipping and tax, plus the card
		fee.
	</p>

	{#if closedReason}
		<div class="notice" role="status"><p>{closedReason} The prices below are estimates.</p></div>
	{/if}

	<form onsubmit={order}>
		<fieldset>
			<legend>Size</legend>
			<Dropdown label="Book size" choices={sizeChoices} bind:value={choice.size} />
		</fieldset>

		<fieldset>
			<legend>Binding</legend>
			{#each bindingChoices as option (option.value)}
				<label class="choice">
					<input type="radio" name="binding" value={option.value} bind:group={choice.binding} />
					<span>{option.label}{#if option.hint}<span class="muted">{` · ${option.hint}`}</span>{/if}</span>
				</label>
			{/each}
			{#if choice.binding === 'linenWrap'}
				<Dropdown label="Linen color" choices={linenChoices} bind:value={() => choice.linenColor ?? linenColors[0], (color) => (choice.linenColor = color)} />
				<Dropdown label="Foil on the spine" choices={foilChoices} bind:value={() => choice.foilColor ?? foilColors[0], (color) => (choice.foilColor = color)} />
			{/if}
		</fieldset>

		<fieldset>
			<legend>Paper and ink</legend>
			{#each inkChoices as option (option.value)}
				<label class="choice">
					<input type="radio" name="ink" value={option.value} bind:group={choice.ink} />
					<span>{option.label}{#if option.hint}<span class="muted">{` · ${option.hint}`}</span>{/if}</span>
				</label>
			{/each}
			{#each paperChoices as option (option.value)}
				<label class="choice">
					<input type="radio" name="paper" value={option.value} bind:group={choice.paper} />
					<span>{option.label} paper</span>
				</label>
			{/each}
			{#each finishChoices as option (option.value)}
				<label class="choice">
					<input type="radio" name="finish" value={option.value} bind:group={choice.finish} />
					<span>{option.label}</span>
				</label>
			{/each}
		</fieldset>

		<div class="panel">
			<p>
				<strong>Estimate:</strong> about {formatDollars(estimate)} to print a {estimatePages}-page copy, plus shipping
				from {formatDollars(lowestUnitedStatesShipping)} in the United States and Lulu’s {formatDollars(fulfillmentFee)}
				order fee.
			</p>
			<p class="muted">
				{bookstore ? 'Bookstores can order this kind of copy too.' : 'Only sold here: bookstores cannot order this kind of copy.'}
				Estimate from Lulu’s pricing calculator, November 2026; the order uses Lulu’s price for your address.
			</p>
		</div>

		<fieldset>
			<legend>Price and shipping</legend>
			<p class="muted">Lulu prices each copy for where it goes. The postal code is enough to see every shipping speed.</p>
			<div class="field"><label for="ship-country">Country (two letters)</label><input id="ship-country" class="short" type="text" autocomplete="country" maxlength="2" bind:value={address.countryCode} /></div>
			<div class="field"><label for="ship-state">State or province</label><input id="ship-state" class="short" type="text" autocomplete="address-level1" bind:value={address.stateCode} /></div>
			<div class="field"><label for="ship-postcode">Postal code</label><input id="ship-postcode" class="short" type="text" autocomplete="postal-code" bind:value={address.postcode} /></div>
			<p><button class="button button-quiet" type="button" onclick={getPrice} disabled={busy}>See prices and shipping speeds</button></p>

			{#if quote}
				<fieldset class="speeds">
					<legend>Shipping speed</legend>
					{#each quote.speeds as speed (speed.level)}
						{@const option = shippingChoices.find((item) => item.value === speed.level)}
						<label class="choice speed">
							<input type="radio" name="shipping" value={speed.level} bind:group={shippingLevel} />
							<span>{option?.label ?? speed.level}{#if option?.hint}<span class="muted">{` · ${option.hint}`}</span>{/if}</span>
							<span class="amount">{formatDollars(speed.priceCents / 100)}</span>
						</label>
					{/each}
				</fieldset>
				{#if chosenSpeed}
					<table class="parts">
						<caption>One {quote.pages}-page copy, {shippingChoices.find((item) => item.value === chosenSpeed.level)?.label.toLowerCase()}</caption>
						<tbody>
							{#each chosenSpeed.parts as part (part.label)}
								<tr><th scope="row">{part.label}</th><td>{formatDollars(part.cents / 100)}</td></tr>
							{/each}
							<tr class="total"><th scope="row">Price of the copy</th><td>{formatDollars(chosenSpeed.priceCents / 100)}</td></tr>
						</tbody>
					</table>
				{/if}
				{#if quote.mode === 'test'}<p class="muted">Test mode: no card is charged and nothing is printed.</p>{/if}
			{/if}
		</fieldset>

		<fieldset>
			<legend>Where it goes</legend>
			<div class="field"><label for="ship-name">Name</label><input id="ship-name" type="text" autocomplete="name" bind:value={address.name} /></div>
			<div class="field"><label for="ship-street1">Street address</label><input id="ship-street1" type="text" autocomplete="address-line1" bind:value={address.street1} /></div>
			<div class="field"><label for="ship-street2">Apartment, suite or building (optional)</label><input id="ship-street2" type="text" autocomplete="address-line2" bind:value={address.street2} /></div>
			<div class="field"><label for="ship-city">City</label><input id="ship-city" type="text" autocomplete="address-level2" bind:value={address.city} /></div>
			<div class="field"><label for="ship-phone">Telephone, for the carrier</label><input id="ship-phone" type="text" autocomplete="tel" inputmode="tel" bind:value={address.phone} /></div>
			<div class="field"><label for="ship-email">Email, for the receipt and tracking</label><input id="ship-email" type="email" autocomplete="email" bind:value={email} /></div>
			<p class="muted">
				Your address goes to Lulu to print and mail the copy. This site deletes it 90 days after the copy ships. Lulu
				prices the copy again for the full address when you order; it is almost always the same.
			</p>
		</fieldset>

		{#if quote?.giftReceiver && chosenSpeed}
			<CheckoutGift
				priceCents={chosenSpeed.priceCents}
				priceLabel="Printed copy, shipping and tax"
				receiver={quote.giftReceiver}
				bind:choice={gift}
				bind:cents={giftCents}
			/>
		{/if}

		{#if problem}<div class="notice notice-problem" role="alert"><p>{problem}</p></div>{/if}

		<p>
			<button class="button" type="submit" disabled={busy || !!closedReason || !chosenSpeed || giftCents === null}
				>Order and pay{chosenSpeed ? ` ${formatDollars((chosenSpeed.priceCents + (giftCents ?? 0)) / 100)}` : ''}</button
			>
		</p>
		<p class="muted">Payment is taken by Stripe on its own page; this site never sees your card.</p>
	</form>
</div>

<style>
	.choice {
		display: flex;
		gap: var(--space-2, 0.5rem);
		align-items: baseline;
		padding-block: var(--space-1, 0.25rem);
	}
	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	form > p {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3, 0.75rem);
	}
	.speeds {
		border: 0;
		padding: 0;
		margin: var(--space-3, 0.75rem) 0;
	}
	.speed {
		min-height: 44px;
		border-bottom: 1px solid var(--color-line);
	}
	.speed .amount {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
		font-weight: var(--font-weight-semibold);
	}
	.parts {
		width: 100%;
		border-collapse: collapse;
		margin: var(--space-3, 0.75rem) 0;
	}
	.parts caption {
		text-align: left;
		font-weight: var(--font-weight-semibold);
		margin-bottom: var(--space-1, 0.25rem);
	}
	.parts th,
	.parts td {
		padding: var(--space-1, 0.25rem) 0;
		border-bottom: 1px solid var(--color-line);
		font-weight: var(--font-weight-regular);
		text-align: left;
	}
	.parts td {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.parts .total th,
	.parts .total td {
		font-weight: var(--font-weight-bold);
		border-bottom: 0;
	}
</style>
