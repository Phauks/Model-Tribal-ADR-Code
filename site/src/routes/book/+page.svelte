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

	/** Until the first edition exists, estimates use this page count. */
	const estimatePages = 300;

	let choice = $state<PrintChoice>({ ...defaultPrintChoice });
	let shippingLevel = $state<ShippingLevel>('MAIL');
	let address = $state({ name: '', street1: '', street2: '', city: '', stateCode: '', postcode: '', countryCode: 'US', phone: '' });
	let email = $state('');

	let quote = $state<{ priceCents: number; pages: number; mode: string } | undefined>();
	let problem = $state('');
	let closedReason = $state('');
	let busy = $state(false);

	const estimate = $derived(estimatedPrintCost(choice, estimatePages));
	const bookstore = $derived(soldInBookstores(choice));

	// A price is for one set of choices and one address; any change asks again.
	$effect(() => {
		JSON.stringify([choice, shippingLevel, address]);
		quote = undefined;
	});

	function payload() {
		return JSON.stringify({ choice, shippingLevel, address, email });
	}

	async function getPrice() {
		busy = true;
		problem = '';
		try {
			const response = await fetch('/book/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload() });
			const answer = await response.json();
			if (response.status === 503) closedReason = answer.reason;
			else if (!answer.available) problem = answer.reason;
			else quote = answer;
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
	<title>Order a printed copy · Model Tribal ADR Code</title>
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
			<div class="field">
				<label for="book-size">Book size</label>
				<select id="book-size" bind:value={choice.size}>
					{#each bookSizes as size (size.identifier)}
						<option value={size.identifier}>{size.name} ({size.width} × {size.height} in)</option>
					{/each}
				</select>
			</div>
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
				<div class="field">
					<label for="linen-color">Linen color</label>
					<select id="linen-color" bind:value={choice.linenColor}>
						{#each linenColors as color (color)}<option value={color}>{color}</option>{/each}
					</select>
				</div>
				<div class="field">
					<label for="foil-color">Foil on the spine</label>
					<select id="foil-color" bind:value={choice.foilColor}>
						{#each foilColors as color (color)}<option value={color}>{color}</option>{/each}
					</select>
				</div>
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
			<legend>Where it goes</legend>
			<div class="field"><label for="ship-name">Name</label><input id="ship-name" type="text" autocomplete="name" bind:value={address.name} /></div>
			<div class="field"><label for="ship-street1">Street address</label><input id="ship-street1" type="text" autocomplete="address-line1" bind:value={address.street1} /></div>
			<div class="field"><label for="ship-street2">Apartment, suite or building (optional)</label><input id="ship-street2" type="text" autocomplete="address-line2" bind:value={address.street2} /></div>
			<div class="field"><label for="ship-city">City</label><input id="ship-city" type="text" autocomplete="address-level2" bind:value={address.city} /></div>
			<div class="field"><label for="ship-state">State or province</label><input id="ship-state" class="short" type="text" autocomplete="address-level1" bind:value={address.stateCode} /></div>
			<div class="field"><label for="ship-postcode">Postal code</label><input id="ship-postcode" class="short" type="text" autocomplete="postal-code" bind:value={address.postcode} /></div>
			<div class="field"><label for="ship-country">Country (two letters)</label><input id="ship-country" class="short" type="text" autocomplete="country" maxlength="2" bind:value={address.countryCode} /></div>
			<div class="field"><label for="ship-phone">Telephone, for the carrier</label><input id="ship-phone" type="text" autocomplete="tel" inputmode="tel" bind:value={address.phone} /></div>
			<div class="field"><label for="ship-email">Email, for the receipt and tracking</label><input id="ship-email" type="email" autocomplete="email" bind:value={email} /></div>
			<div class="field">
				<label for="ship-level">Shipping</label>
				<select id="ship-level" bind:value={shippingLevel}>
					{#each shippingChoices as option (option.value)}<option value={option.value}>{option.label}{option.hint ? `: ${option.hint}` : ''}</option>{/each}
				</select>
			</div>
			<p class="muted">
				Your address goes to Lulu to print and mail the copy. This site deletes it 90 days after the copy ships.
			</p>
		</fieldset>

		{#if problem}<div class="notice notice-problem" role="alert"><p>{problem}</p></div>{/if}

		{#if quote}
			<div class="panel" role="status">
				<p><strong>{formatDollars(quote.priceCents / 100)}</strong> for one {quote.pages}-page copy, printed, shipped and taxed.</p>
				{#if quote.mode === 'test'}<p class="muted">Test mode: no card is charged and nothing is printed.</p>{/if}
			</div>
		{/if}

		<p>
			<button class="button button-quiet" type="button" onclick={getPrice} disabled={busy}>Get the price for this address</button>
			<button class="button" type="submit" disabled={busy || !!closedReason || !quote}>Order and pay</button>
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
</style>
