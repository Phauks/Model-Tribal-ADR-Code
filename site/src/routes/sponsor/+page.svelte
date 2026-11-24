<script lang="ts">
	// The Sponsorship page, built to match mockup A, which Trevor approved on
	// Nov. 23, 2026 (project files, design/sponsorship-bolder/), with his two
	// changes: no amounts for a state's nations, and no cost fixed in the code
	// (docs/sponsorship.md, "The Sponsorship page").
	//
	// The band holds the page's own text, edited on the website like the
	// essays (content/about/sponsor.md), how many nations' copies gifts have
	// paid for, and the gift form, which hands its choices to the Account
	// page's gift form. Below: the counts behind the work, what else a gift
	// can fund, and the sponsors who chose to be listed. A cost shows only
	// once the lead author sets it in the workspace; amounts given by a
	// sponsor are never shown.
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Building2 from '@lucide/svelte/icons/building-2';
	import Heart from '@lucide/svelte/icons/heart';
	import Library from '@lucide/svelte/icons/library';
	import Repeat from '@lucide/svelte/icons/repeat';
	import Server from '@lucide/svelte/icons/server';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import EssayArticle from '#lib/components/essays/EssayArticle.svelte';
	import { dollars, earmarkLabels, earmarks, initials, largestGift, type Earmark } from '#lib/sponsorship.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const { sponsors, giftsOpen, receiver, counts, goals, monthly, ...article } = $derived(data);

	const cardText = {
		site: { title: 'The site for a year', text: 'Hosting and the web address.', icon: Server },
		hardcovers: { title: 'Hardcovers for every nation', text: 'library copies in place of paperbacks.', icon: Library },
		'needed-most': { title: 'Wherever it is needed most', text: 'Research copies, printing and the site.', icon: BookOpen }
	} as const;

	const earmarkChoices = earmarks.map((earmark) => ({ value: earmark, label: earmarkLabels[earmark] }));

	const number = (value: number) => value.toLocaleString('en-US');
	const percent = (share: number) => Math.round(share * 100);
	// A large figure reads best in whole dollars.
	const wholeDollars = (cents: number) => dollars(Math.round(cents / 100) * 100);

	// What each sponsor's gift funds, as the mockup's sponsor cards say it.
	const fundsLabels: Record<Earmark, string> = {
		'needed-most': 'Wherever it is needed most',
		'books-for-nations': 'Copies for every nation',
		'large-format': 'The large-format edition',
		hosting: 'The site'
	};

	// Amounts that buy whole copies, once the cost of a copy is set; none is chosen ahead of time.
	const copyAmounts = $derived(
		goals.copies
			? [1, 10, 100]
					.map((copies) => ({ copies, cents: copies * (goals.copies?.costCents ?? 0) }))
					.filter((choice) => choice.cents <= largestGift * 100)
			: []
	);
</script>

<svelte:head>
	{#if data.description}<meta name="description" content={data.description} />{/if}
</svelte:head>

<div class="sponsorship">
	<section class="hero" aria-label="The goal">
		<div class="hero-text">
			<EssayArticle {...article} />
			{#if goals.nations > 0}
				<div class="goal">
					{#if goals.copies}
						<p class="count">{number(goals.copies.paid)} <span>of {number(goals.nations)} nations</span></p>
						<div
							class="bar"
							role="progressbar"
							aria-label="Nations whose copy is paid for"
							aria-valuemin="0"
							aria-valuemax={goals.nations}
							aria-valuenow={goals.copies.paid}
						>
							<i style:width="{(goals.copies.paid / goals.nations) * 100}%"></i>
						</div>
						<p class="note">{dollars(goals.copies.costCents)} prints and mails one paperback.</p>
					{:else}
						<p class="count">{number(goals.nations)} <span>nations</span></p>
					{/if}
				</div>
			{/if}
		</div>

		<form class="give" method="get" action="/account/sponsorship">
			<fieldset class="segmented">
				<legend class="visually-hidden">How often</legend>
				<input type="radio" id="give-once" name="frequency" value="one-time" />
				<label for="give-once">Once</label>
				<input type="radio" id="give-monthly" name="frequency" value="monthly" checked />
				<label for="give-monthly"><Repeat aria-hidden="true" />Every month</label>
			</fieldset>
			<Dropdown label="Toward" name="toward" labelInside choices={earmarkChoices} value="needed-most" />
			<fieldset class="amounts">
				<legend class="visually-hidden">Amount</legend>
				{#each copyAmounts as choice (choice.copies)}
					<input type="radio" id="give-{choice.copies}" name="amount" value={choice.cents / 100} />
					<label for="give-{choice.copies}"><b>{dollars(choice.cents)}</b><small>{choice.copies} {choice.copies === 1 ? 'copy' : 'copies'}</small></label>
				{/each}
				<label class="other" class:wide={copyAmounts.length % 2 === 0}>
					<b>Other</b>
					<input name="other" type="text" inputmode="decimal" placeholder="Any amount" aria-label="Other amount, in US dollars" />
				</label>
			</fieldset>
			<button class="button give-button" type="submit" disabled={!giftsOpen}><Heart aria-hidden="true" />Sponsor</button>
			<p class="gift-note">
				{giftsOpen ? `Gifts go to ${receiver}.` : 'Who receives gifts, and the notice Nevada law requires, go here once chosen.'}
			</p>
		</form>
	</section>

	{#if counts.nationPages > 0}
		<dl class="stats">
			<div><dt>Native nations with their own page</dt><dd>{number(counts.nationPages)}</dd></div>
			<div><dt>sources recorded and cited</dt><dd>{number(counts.sources)}</dd></div>
			<div><dt>to read, download or print</dt><dd>$0</dd></div>
			{#if monthly}
				<div>
					<dt>a month from {number(monthly.sponsors)} monthly sponsors</dt>
					<dd>{wholeDollars(monthly.cents)}</dd>
				</div>
			{/if}
		</dl>
	{/if}

	<section aria-labelledby="fund-heading">
		<h2 id="fund-heading">More you can fund</h2>
		<div class="cards">
			{#each goals.cards as card (card.key)}
				{@const about = cardText[card.key]}
				<article class="card">
					<about.icon class="card-icon" aria-hidden="true" />
					{#if card.key === 'needed-most'}
						<p class="cost">Any</p>
					{:else if card.costCents}
						<p class="cost">{card.key === 'hardcovers' ? wholeDollars(card.costCents) : dollars(card.costCents)}</p>
					{/if}
					<h3>{about.title}</h3>
					<p class="muted small">{card.key === 'hardcovers' ? `${number(goals.nations)} ${about.text}` : about.text}</p>
					<div class="row">
						{#if card.share !== null && card.key === 'site' && card.share >= 1}
							<span class="small muted">Paid for</span>
						{:else if card.share !== null}
							<div
								class="bar"
								role="progressbar"
								aria-label="{about.title}: share paid"
								aria-valuemin="0"
								aria-valuemax="100"
								aria-valuenow={percent(card.share)}
							>
								<i style:width="{percent(card.share)}%"></i>
							</div>
						{:else}
							<span></span>
						{/if}
						<a class="heart" href="/account/sponsorship?toward={card.earmark}" aria-label="Sponsor: {about.title}" title="Sponsor this"
							><Heart aria-hidden="true" /></a
						>
					</div>
				</article>
			{/each}
		</div>
	</section>

	<section aria-labelledby="sponsors-heading">
		<h2 id="sponsors-heading">Thank you to our sponsors</h2>
		<div class="wall">
			{#each sponsors as sponsor, index (sponsor.slug ?? `anonymous-${index}`)}
				<article class="sponsor">
					<div class="top">
						<span class="mark" class:anonymous={!sponsor.name} class:second={index % 2 === 1} aria-hidden="true">
							{#if sponsor.hasLogo && sponsor.slug}<img src="/sponsors/{sponsor.slug}/logo" alt="" loading="lazy" />{:else}{sponsor.name
									? initials(sponsor.name)
									: '?'}{/if}
						</span>
						{#if sponsor.name && sponsor.slug}
							<a class="name" href="/sponsors/{sponsor.slug}">{sponsor.name}</a>
						{:else}
							<b>{sponsor.name ?? 'A sponsor'}</b>
						{/if}
					</div>
					<span class="muted">{fundsLabels[sponsor.earmark]}</span>
				</article>
			{/each}
			<a class="sponsor empty" href="/account/sponsorship"><Building2 aria-hidden="true" />Your organization</a>
		</div>
		<p class="small muted">Sponsors have no say in what the code says.</p>
	</section>
</div>

<style>
	.sponsorship {
		display: grid;
		gap: var(--space-7);
		max-width: 72rem;
		margin-top: var(--space-5);
	}

	h2 {
		margin-top: 0;
	}

	/* The band: the page's own text and the goal on the left, the gift form on the right. */
	.hero {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(17rem, 24rem);
		gap: var(--space-7);
		align-items: start;
		padding: var(--space-7) var(--space-7);
		border-radius: 1.125rem;
		background: var(--color-band);
		color: var(--color-band-text);
	}

	.hero-text :global(article.essay) {
		max-width: none;
	}

	.hero-text :global(article.essay h1) {
		margin: 0;
		color: var(--color-band-text);
		font-size: clamp(2rem, 4.2vw, 3rem);
		line-height: 1.1;
	}

	.hero-text :global(.essay-text > p) {
		max-width: 36ch;
		margin-top: var(--space-4);
		text-indent: 0;
		font-size: 1.25rem;
		color: color-mix(in srgb, var(--color-band-text) 82%, var(--color-band));
	}

	.hero-text :global(.essay-text a) {
		color: var(--color-band-text);
	}

	/* Editors open the text here (EssayArticle.svelte); their tools keep the page's own colors. */
	.hero-text :global(:is(.access-bar, .essay-editor)) {
		padding: var(--space-3);
		border-radius: var(--radius-panel);
		background: var(--color-paper);
		color: var(--color-ink);
	}

	.goal {
		margin-top: var(--space-6);
	}

	.count {
		margin: 0;
		font-size: clamp(2.75rem, 7vw, 4rem);
		font-weight: var(--font-weight-bold);
		line-height: 1;
	}

	.count span {
		font-size: 1.5rem;
		font-weight: var(--font-weight-semibold);
		color: color-mix(in srgb, var(--color-band-text) 82%, var(--color-band));
	}

	.bar {
		height: 0.875rem;
		border-radius: 0.5rem;
		background: var(--color-line);
		overflow: hidden;
	}

	.bar i {
		display: block;
		height: 100%;
		border-radius: 0.5rem;
		background: var(--color-link);
	}

	.goal .bar {
		height: 1.125rem;
		margin: var(--space-4) 0 var(--space-2);
		background: color-mix(in srgb, var(--color-band-text) 20%, transparent);
	}

	.goal .bar i {
		background: var(--color-band-progress);
	}

	.note {
		margin: 0;
		font-size: var(--font-size-small);
		color: color-mix(in srgb, var(--color-band-text) 82%, var(--color-band));
	}

	/* The gift form, which hands its choices to the Account page's gift form. */
	.give {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		min-width: 0;
		gap: var(--space-3);
		padding: var(--space-5);
		border: 1px solid var(--color-line);
		border-radius: 0.875rem;
		background: var(--color-surface);
		color: var(--color-ink);
	}

	fieldset {
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}

	.give input[type='radio'] {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.segmented {
		display: grid;
		grid-template-columns: 1fr 1fr;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		overflow: hidden;
	}

	.segmented label {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		padding: var(--space-2);
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
	}

	.segmented label + input + label {
		border-left: 1px solid var(--color-control-border);
	}

	/* The link teal, which stays clear of the panel in dark mode too. */
	.segmented input:checked + label {
		background: var(--color-link);
		color: var(--color-paper);
	}

	.segmented :global(svg) {
		width: 1.125rem;
		height: 1.125rem;
	}

	.amounts {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-2);
	}

	.amounts label {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		line-height: 1.3;
		cursor: pointer;
	}

	.amounts label.wide {
		grid-column: 1 / -1;
	}

	.amounts b {
		font-size: 1.1875rem;
	}

	.amounts small {
		font-size: 0.875rem;
		color: var(--color-ink-muted);
	}

	.amounts input:checked + label {
		outline: 3px solid var(--color-action);
		outline-offset: -2px;
	}

	.amounts input:focus-visible + label,
	.segmented input:focus-visible + label {
		outline: 3px solid var(--color-focus);
		outline-offset: 2px;
	}

	.other input {
		width: 100%;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 0.875rem;
	}

	.give-button {
		justify-content: center;
		gap: var(--space-2);
		min-height: 3.25rem;
		font-size: 1.25rem;
		font-weight: var(--font-weight-bold);
	}

	.give-button:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.gift-note {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-control);
		background: var(--color-placeholder-background);
		font-size: var(--font-size-small);
	}

	.stats {
		display: grid;
		grid-auto-columns: minmax(0, 1fr);
		grid-auto-flow: column;
		margin: 0;
		border-block: 1px solid var(--color-line);
	}

	/* The figure first, then its label, with figures level when a label wraps. */
	.stats div {
		display: grid;
		grid-template-rows: auto 1fr;
		align-content: start;
		padding: var(--space-4) var(--space-5);
	}

	.stats div + div {
		border-inline-start: 1px solid var(--color-line);
	}

	.stats dd {
		grid-row: 1;
		margin: 0;
		font-size: 2.5rem;
		font-weight: var(--font-weight-bold);
		line-height: 1.1;
		color: var(--color-link);
	}

	.stats dt {
		grid-row: 2;
		color: var(--color-ink-muted);
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-4);
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-5);
		border: 1px solid var(--color-line);
		border-radius: 0.875rem;
	}

	.card h3,
	.card p {
		margin: 0;
	}

	.card :global(.card-icon) {
		color: var(--color-link);
	}

	.cost {
		font-size: 1.875rem;
		font-weight: var(--font-weight-bold);
		line-height: 1.1;
		color: var(--color-action);
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		margin-top: auto;
		padding-top: var(--space-2);
	}

	.row .bar {
		flex: 1;
	}

	/* The heart that sponsors one card's purpose, boxed as in the approved mockup. */
	.heart {
		display: inline-grid;
		flex: none;
		place-items: center;
		width: var(--layout-target-minimum);
		height: var(--layout-target-minimum);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		color: var(--color-ink);
	}

	.heart:hover {
		background: var(--color-surface);
	}

	.wall {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--space-4);
		margin-bottom: var(--space-4);
	}

	.sponsor {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-4);
		border: 1px solid var(--color-line);
		border-radius: 0.75rem;
		background: var(--color-surface);
		font-size: var(--font-size-small);
	}

	.top {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.mark {
		display: grid;
		flex: none;
		place-items: center;
		width: 2.875rem;
		height: 2.875rem;
		overflow: hidden;
		border-radius: 0.5rem;
		background: var(--color-band);
		color: var(--color-band-text);
		font-weight: var(--font-weight-bold);
	}

	.mark.second {
		background: var(--color-action);
		color: var(--color-action-text);
	}

	.mark.anonymous {
		background: var(--color-line);
		color: var(--color-ink-muted);
	}

	.mark img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		background: var(--color-surface-raised);
	}

	.name {
		font-weight: var(--font-weight-bold);
		color: var(--color-ink);
		text-decoration: none;
	}

	.name:hover {
		text-decoration: underline;
	}

	.sponsor.empty {
		align-items: center;
		justify-content: center;
		min-height: 6rem;
		border: 1px dashed var(--color-control-border);
		background: transparent;
		color: var(--color-ink-muted);
		text-decoration: none;
	}

	@media (max-width: 60rem) {
		.hero {
			grid-template-columns: 1fr;
			padding: var(--space-5);
			gap: var(--space-5);
		}

		.stats {
			grid-auto-flow: row;
		}

		.cards {
			grid-template-columns: 1fr;
		}

		.stats div + div {
			border-inline-start: 0;
			border-block-start: 1px solid var(--color-line);
		}

		.wall {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
