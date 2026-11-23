<script lang="ts">
	// The Sponsorship page (docs/sponsorship.md, "The Sponsorship page"): the
	// text edited on the website like the essays (content/about/sponsor.md),
	// then one goal, a printed copy for every federally recognized nation, with
	// how many copies gifts have paid for; the counts behind the work; what
	// else a gift can fund; and the sponsors who chose to be listed. Trevor
	// chose this layout ("the one goal") on Nov. 23, 2026. Costs show only
	// once the lead author sets them in the workspace, and amounts given by a
	// sponsor are never shown.
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Building2 from '@lucide/svelte/icons/building-2';
	import Heart from '@lucide/svelte/icons/heart';
	import Library from '@lucide/svelte/icons/library';
	import Server from '@lucide/svelte/icons/server';
	import EssayArticle from '#lib/components/essays/EssayArticle.svelte';
	import SponsorCard from '#lib/components/SponsorCard.svelte';
	import { dollars } from '#lib/sponsorship.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const { sponsors, giftsOpen, receiver, counts, goals, ...article } = $derived(data);

	const cardText = {
		hosting: { title: 'The website', text: 'Hosting and the web address.', icon: Server },
		'large-format': { title: 'The large-format edition', text: 'An 8.5 × 11 copy for every nation.', icon: Library },
		'needed-most': { title: 'Wherever it is needed most', text: 'Research, printing and the website.', icon: BookOpen }
	} as const;

	const number = (value: number) => value.toLocaleString('en-US');
	const percent = (share: number) => Math.round(share * 100);
</script>

<svelte:head>
	{#if data.description}<meta name="description" content={data.description} />{/if}
</svelte:head>

<EssayArticle {...article} />

<div class="sponsorship">
	{#if goals.nations > 0}
		<section class="goal" class:with-gift={giftsOpen} aria-labelledby="goal-heading">
			<div class="goal-text">
				<h2 id="goal-heading">A printed copy for every Native nation</h2>
				{#if goals.copies}
					<p class="count">{number(goals.copies.paid)} <span>of {number(goals.nations)} nations</span></p>
					<div
						class="bar"
						role="progressbar"
						aria-label="Copies paid for"
						aria-valuemin="0"
						aria-valuemax={goals.nations}
						aria-valuenow={goals.copies.paid}
					>
						<i style:width="{(goals.copies.paid / goals.nations) * 100}%"></i>
					</div>
					<p class="note">{dollars(goals.copies.costCents)} prints and mails one copy.</p>
				{:else}
					<p class="count">{number(goals.nations)} <span>federally recognized nations</span></p>
				{/if}
			</div>
			{#if giftsOpen}
				<div class="give">
					<a class="button give-button" href="/account/sponsorship"><Heart aria-hidden="true" />Sponsor</a>
					<p>Gifts go to {receiver}.</p>
				</div>
			{/if}
		</section>
	{/if}

	{#if counts.nationPages > 0}
		<dl class="stats">
			<div><dt>Native nations with their own page</dt><dd>{number(counts.nationPages)}</dd></div>
			<div><dt>Sources recorded</dt><dd>{number(counts.sources)}</dd></div>
			<div><dt>To read, download or print</dt><dd>$0</dd></div>
		</dl>
	{/if}

	<section aria-labelledby="fund-heading">
		<h2 id="fund-heading">More you can fund</h2>
		<div class="cards">
			{#each goals.cards as card (card.earmark)}
				{@const about = cardText[card.earmark]}
				<article class="card">
					<about.icon class="card-icon" aria-hidden="true" />
					{#if card.costCents}
						<p class="cost">{dollars(card.costCents)} <span>a {card.unit}</span></p>
					{/if}
					<h3>{about.title}</h3>
					<p class="muted">{about.text}</p>
					{#if card.share !== null}
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
						{#if card.earmark === 'hosting' && card.share >= 1}<p class="small muted">Paid for this year</p>{/if}
					{/if}
				</article>
			{/each}
		</div>
	</section>

	{#if sponsors.length > 0 || giftsOpen}
		<section aria-labelledby="sponsors-heading">
			<h2 id="sponsors-heading">Thank you to our sponsors</h2>
			<div class="grid">
				{#each sponsors as sponsor, index (sponsor.slug ?? `anonymous-${index}`)}
					<SponsorCard {sponsor} />
				{/each}
				{#if giftsOpen}
					<a class="empty" href="/account/sponsorship"><Building2 aria-hidden="true" />Your organization</a>
				{/if}
			</div>
		</section>
	{/if}
</div>

<style>
	.sponsorship {
		display: grid;
		gap: var(--space-7);
		margin-top: var(--space-6);
		max-width: 72rem;
	}

	h2 {
		margin-top: 0;
	}

	.goal {
		display: grid;
		gap: var(--space-6);
		padding: var(--space-6);
		border-radius: var(--radius-panel);
		background: var(--color-band);
		color: var(--color-band-text);
	}

	.goal.with-gift {
		grid-template-columns: minmax(0, 1fr) minmax(16rem, 22rem);
		align-items: center;
	}

	.goal h2 {
		color: inherit;
		font-size: clamp(1.75rem, 4vw, 2.75rem);
		line-height: 1.1;
	}

	.count {
		margin: var(--space-5) 0 var(--space-3);
		font-size: clamp(2.75rem, 7vw, 4rem);
		font-weight: var(--font-weight-bold);
		line-height: 1;
	}

	.count span {
		font-size: 1.25rem;
		font-weight: var(--font-weight-semibold);
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
		min-width: 0.875rem;
		border-radius: 0.5rem;
		background: var(--color-link);
	}

	.goal .bar {
		max-width: 40rem;
		background: color-mix(in srgb, var(--color-band-text) 22%, transparent);
	}

	.goal .bar i {
		background: var(--color-band-text);
	}

	.note {
		margin: var(--space-2) 0 0;
	}

	.give {
		display: grid;
		gap: var(--space-3);
		padding: var(--space-5);
		border-radius: var(--radius-panel);
		background: var(--color-paper);
		color: var(--color-ink);
	}

	.give p {
		margin: 0;
		font-size: var(--font-size-small);
	}

	.give-button {
		justify-content: center;
		gap: var(--space-2);
		font-size: 1.25rem;
		padding-block: var(--space-3);
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
		margin: 0;
		border-block: 1px solid var(--color-line);
	}

	.stats div {
		display: flex;
		flex-direction: column-reverse;
		padding: var(--space-4) var(--space-5);
	}

	.stats div + div {
		border-inline-start: 1px solid var(--color-line);
	}

	.stats dd {
		margin: 0;
		font-size: 2.5rem;
		font-weight: var(--font-weight-bold);
		line-height: 1.1;
		color: var(--color-link);
	}

	.stats dt {
		color: var(--color-ink-muted);
	}

	.cards,
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
		gap: var(--space-4);
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-5);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
	}

	.card h3,
	.card p {
		margin: 0;
	}

	.card :global(.card-icon) {
		color: var(--color-link);
	}

	.cost {
		font-size: 1.75rem;
		font-weight: var(--font-weight-bold);
		line-height: 1.1;
		color: var(--color-action);
	}

	.cost span {
		font-size: 1rem;
		font-weight: var(--font-weight-semibold);
	}

	.card .bar {
		margin-top: auto;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: 7rem;
		border: 1px dashed var(--color-control-border);
		border-radius: var(--radius-panel);
		color: var(--color-ink-muted);
		text-decoration: none;
	}

	@media (max-width: 48rem) {
		.goal.with-gift {
			grid-template-columns: 1fr;
		}

		.goal {
			padding: var(--space-5);
		}

		.stats div + div {
			border-inline-start: 0;
			border-block-start: 1px solid var(--color-line);
		}
	}
</style>
