<script lang="ts">
	// The Store (docs/store.md): the standard book formats, bought in one step
	// from a dialog, and a special order for every other print choice (/book).
	// Merchandise shows only once an item can be bought.
	import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import ReceiptText from '@lucide/svelte/icons/receipt-text';
	import { formatDollars, shippingChoices, type ShippingLevel } from '#lib/book-order.ts';
	import type { GiftChoice } from '#lib/checkout-gift.ts';
	import CheckoutGift from '#lib/components/CheckoutGift.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import { formatEstimate, merchandiseOnSale, standardFormats, type StandardFormat } from '#lib/store.ts';

	const merchandise = merchandiseOnSale();

	let buyDialog: Modal<string> | undefined = $state();
	let format = $state<StandardFormat>(standardFormats[0]);
	let ship = $state({ countryCode: 'US', stateCode: '', postcode: '' });

	interface Speed {
		level: ShippingLevel;
		priceCents: number;
	}
	let quote = $state<{ speeds: Speed[]; giftReceiver: string | null; mode: string } | undefined>();
	let shippingLevel = $state<ShippingLevel>('MAIL');
	const chosenSpeed = $derived(quote?.speeds.find((speed) => speed.level === shippingLevel));
	let gift = $state<GiftChoice>({ kind: 'none' });
	let giftCents = $state<number | null>(0);
	let problem = $state('');
	let busy = $state(false);

	function buy(chosen: StandardFormat) {
		format = chosen;
		quote = undefined;
		problem = '';
		buyDialog?.open();
	}

	async function getPrices(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		problem = '';
		try {
			const response = await fetch('/book/quote', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ choice: format.choice, shippingLevel, address: ship })
			});
			const answer = await response.json();
			if (!response.ok || !answer.available) problem = answer.reason;
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

	async function pay() {
		busy = true;
		problem = '';
		try {
			// Stripe's page asks for the name and street address (docs/store.md, "Buying in one step").
			const response = await fetch('/store/checkout', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ format: format.identifier, shippingLevel, address: ship, gift })
			});
			const answer = await response.json();
			if (answer.placed) window.location.assign(answer.payAt);
			else problem = answer.reason;
		} catch {
			problem = 'The order could not be sent. Check your connection and try again.';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Store · Tribal Law Project</title>
	<meta name="description" content="Printed copies of the Model Tribal ADR Code." />
</svelte:head>

<div class="store">
	<div class="title-row">
		<h1>Store</h1>
		<a class="icon-button" href="/account/orders" aria-label="Your orders" title="Your orders"><ReceiptText size={24} aria-hidden="true" /></a>
	</div>

	<section aria-labelledby="books">
		<h2 id="books">Books</h2>
		<ul class="items">
			{#each standardFormats as item (item.identifier)}
				<li class="item">
					<div class="cover" class:hardcover={item.choice.binding === 'caseWrap'} class:large={item.identifier === 'large-paperback'} aria-hidden="true">
						<span>Model Tribal ADR Code</span>
					</div>
					<div class="about">
						<h3>{item.label}</h3>
						<p class="muted">{item.detail}</p>
						<p class="price">{formatDollars(formatEstimate(item))} <span class="muted">+ shipping</span></p>
					</div>
					<button class="icon-button buy" type="button" aria-haspopup="dialog" aria-label={`Buy the ${item.label.toLowerCase()}`} title="Buy" onclick={() => buy(item)}>
						<ShoppingCart size={24} aria-hidden="true" />
					</button>
				</li>
			{/each}
			<li class="item special">
				<div class="cover special-cover" aria-hidden="true"><SlidersHorizontal size={32} /></div>
				<div class="about">
					<h3><a href="/book">Special order</a></h3>
					<p class="muted">Other sizes, linen, coil, paper and ink</p>
				</div>
			</li>
		</ul>
	</section>

	{#if merchandise.length > 0}
		<section aria-labelledby="merchandise">
			<h2 id="merchandise">Merchandise</h2>
			<ul class="items">
				{#each merchandise as item (item.identifier)}
					<li class="item">
						<div class="art-reserved art" role="img" aria-label="Space reserved for art">Art reserved</div>
						<div class="about">
							<h3>{item.label}</h3>
							<p class="price">{formatDollars((item.priceCents ?? 0) / 100)}</p>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<Modal bind:this={buyDialog} title={format.label} fitContent>
	<form class="ship" onsubmit={getPrices}>
		<div class="field"><label for="store-country">Country</label><input id="store-country" class="short" type="text" autocomplete="country" maxlength="2" bind:value={ship.countryCode} /></div>
		<div class="field"><label for="store-state">State</label><input id="store-state" class="short" type="text" autocomplete="address-level1" bind:value={ship.stateCode} /></div>
		<div class="field"><label for="store-postcode">Postal code</label><input id="store-postcode" class="short" type="text" autocomplete="postal-code" bind:value={ship.postcode} /></div>
		<button class="button button-quiet" type="submit" disabled={busy}>Prices</button>
	</form>

	{#if quote}
		<fieldset class="speeds">
			<legend>Shipping</legend>
			{#each quote.speeds as speed (speed.level)}
				{@const option = shippingChoices.find((item) => item.value === speed.level)}
				<label class="speed">
					<input type="radio" name="store-shipping" value={speed.level} bind:group={shippingLevel} />
					<span>{option?.label ?? speed.level}{#if option?.hint}<span class="muted">{` · ${option.hint}`}</span>{/if}</span>
					<span class="amount">{formatDollars(speed.priceCents / 100)}</span>
				</label>
			{/each}
		</fieldset>
		{#if quote.giftReceiver && chosenSpeed}
			<CheckoutGift priceCents={chosenSpeed.priceCents} priceLabel="Book, shipping and tax" receiver={quote.giftReceiver} bind:choice={gift} bind:cents={giftCents} />
		{/if}
		{#if quote.mode === 'test'}<p class="muted">Test mode: no card is charged and nothing is printed.</p>{/if}
	{/if}

	{#if problem}<div class="notice notice-problem" role="alert"><p>{problem}</p></div>{/if}

	{#snippet actions()}
		<button class="button" type="button" disabled={busy || !chosenSpeed || giftCents === null} onclick={pay}
			>Pay{chosenSpeed ? ` ${formatDollars((chosenSpeed.priceCents + (giftCents ?? 0)) / 100)}` : ''}</button
		>
	{/snippet}
</Modal>

<style>
	.title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		max-width: 60rem;
	}
	.store section {
		max-width: 60rem;
		margin-block: var(--space-5);
	}
	.items {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 11.5rem), 1fr));
		gap: var(--space-4);
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.item {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface);
	}
	.item h3 {
		margin: 0;
		font-size: var(--font-size-heading-3);
	}
	.about p {
		margin: var(--space-1) 0 0;
	}
	.price {
		/* Leaves room for the cart button in the card's corner. */
		padding-right: var(--layout-target-minimum);
		font-weight: var(--font-weight-semibold);
		font-variant-numeric: tabular-nums;
	}
	.price .muted {
		font-weight: var(--font-weight-regular);
	}
	.cover {
		align-self: center;
		display: flex;
		align-items: flex-end;
		width: 6rem;
		height: 9rem;
		padding: var(--space-2);
		border-radius: 2px;
		background: var(--color-band);
		color: var(--color-band-text);
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-small);
		line-height: 1.2;
		box-shadow: 0 1px 3px color-mix(in srgb, var(--color-ink) 25%, transparent);
	}
	/* The spine of a hardcover: a darker strip of the cover's own color, in both themes. */
	.cover.hardcover {
		position: relative;
		padding-left: calc(var(--space-2) + 6px);
	}
	.cover.hardcover::before {
		content: '';
		position: absolute;
		inset: 0 auto 0 0;
		width: 6px;
		background: var(--color-band);
		filter: brightness(0.6);
	}
	.cover.large {
		width: 7.2rem;
		height: 9.3rem;
	}
	.special-cover {
		align-items: center;
		justify-content: center;
		background: transparent;
		color: var(--color-ink-muted);
		border: 2px dashed var(--color-control-border);
		box-shadow: none;
	}
	.special h3 a::after {
		/* The whole card follows the link. */
		content: '';
		position: absolute;
		inset: 0;
	}
	.art {
		min-height: 9rem;
		padding: var(--space-3);
	}
	.buy {
		position: absolute;
		right: var(--space-2);
		bottom: var(--space-2);
		color: var(--color-action);
	}
	.ship {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--space-3);
	}
	.ship .field {
		margin: 0;
	}
	.speeds {
		border: 0;
		padding: 0;
		margin: var(--space-4) 0 0;
	}
	.speed {
		display: flex;
		gap: var(--space-2);
		align-items: baseline;
		min-height: 44px;
		padding-block: var(--space-1);
		border-bottom: 1px solid var(--color-line);
	}
	.speed .amount {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
		font-weight: var(--font-weight-semibold);
	}
	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
