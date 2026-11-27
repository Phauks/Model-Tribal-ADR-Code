<script lang="ts">
	// The Sponsorship levels page, built to match the mockup Trevor approved on
	// Nov. 23, 2026 (project files, design/sponsorship-levels/, screens 4 to 7):
	// one table of what everyone gets and what each level adds, a Monthly or
	// Yearly choice, and a note on taxes (docs/sponsorship.md, "Levels").
	// The choice works without scripts: the radio buttons show one set of
	// amounts and hearts through CSS.
	import BookOpenText from '@lucide/svelte/icons/book-open-text';
	import Calendar from '@lucide/svelte/icons/calendar';
	import Check from '@lucide/svelte/icons/check';
	import HandHeart from '@lucide/svelte/icons/hand-heart';
	import Heart from '@lucide/svelte/icons/heart';
	import Landmark from '@lucide/svelte/icons/landmark';
	import Library from '@lucide/svelte/icons/library';
	import Minus from '@lucide/svelte/icons/minus';
	import ReceiptText from '@lucide/svelte/icons/receipt-text';
	import Repeat from '@lucide/svelte/icons/repeat';
	import Sprout from '@lucide/svelte/icons/sprout';
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import { dollars } from '#lib/sponsorship.ts';
	import { columns, freeBenefits, includes, levelNames, levels, sponsorBenefits, yearlyCents, type Benefit, type Level } from '#lib/sponsorship-levels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const icons = { free: BookOpenText, friend: Sprout, supporter: HandHeart, patron: Library, benefactor: Landmark };
	const groups: [string, Benefit[]][] = [
		['Free for everyone', freeBenefits],
		['For sponsors', sponsorBenefits]
	];

	// The Account page's gift form, filled in with this level's amount.
	const giveAddress = (frequency: 'monthly' | 'yearly', cents: number) =>
		`/account/sponsorship?frequency=${frequency}&amount=${cents / 100}`;
	const amountFor = (level: Level) => data.amounts[level];
</script>

<svelte:head>
	<title>Sponsorship levels · Tribal Law Project</title>
	<meta name="description" content="What everyone gets free, and what each sponsorship level adds." />
</svelte:head>

<Breadcrumbs trail={[{ label: 'Sponsorship', href: '/sponsor' }]} current="Sponsorship levels" />
<div class="sponsorship-levels">
	<div class="title-row">
		<h1>Sponsorship levels</h1>
		<fieldset class="segmented">
			<legend class="visually-hidden">How often</legend>
			<input type="radio" id="every-month" name="period" value="monthly" checked />
			<label for="every-month"><Repeat aria-hidden="true" />Monthly</label>
			<input type="radio" id="every-year" name="period" value="yearly" />
			<label for="every-year"><Calendar aria-hidden="true" />Yearly</label>
		</fieldset>
	</div>

	<div class="table-frame">
		<table class="levels" data-fixed-columns>
			<thead>
				<tr>
					<td></td>
					{#each columns as column (column)}
						{@const Icon = icons[column]}
						<th scope="col">
							<span class="level-icon"><Icon aria-hidden="true" /></span>
							{#if column === 'free'}
								<span class="level-name">Free</span>
								<span class="price"><b>$0</b></span>
							{:else}
								<span class="level-name">{levelNames[column]}</span>
								<span class="price monthly"><b>{dollars(amountFor(column))}</b><small>a month</small></span>
								<span class="price yearly"><b>{dollars(yearlyCents(amountFor(column)))}</b><small>a year</small></span>
								<a
									class="heart monthly"
									href={giveAddress('monthly', amountFor(column))}
									aria-label="Sponsor as a {levelNames[column]}, monthly"
									title="Sponsor as a {levelNames[column]}"><Heart aria-hidden="true" /></a
								>
								<a
									class="heart yearly"
									href={giveAddress('yearly', yearlyCents(amountFor(column)))}
									aria-label="Sponsor as a {levelNames[column]}, yearly"
									title="Sponsor as a {levelNames[column]}"><Heart aria-hidden="true" /></a
								>
							{/if}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each groups as [title, benefits] (title)}
					<tr class="group"><th scope="colgroup" colspan={columns.length + 1}>{title}</th></tr>
					{#each benefits as benefit (benefit.text)}
						<tr>
							<th scope="row">{benefit.text}{#if benefit.later}{' '}<span class="later">Later</span>{/if}</th>
							{#each columns as column (column)}
								{#if includes(benefit, column)}
									<td class="yes"><Check aria-hidden="true" /><span class="visually-hidden">Included</span></td>
								{:else}
									<td class="no"><Minus aria-hidden="true" /><span class="visually-hidden">Not included</span></td>
								{/if}
							{/each}
						</tr>
					{/each}
				{/each}
			</tbody>
		</table>
	</div>

	<section class="taxes" aria-labelledby="taxes-heading">
		<h2 id="taxes-heading"><ReceiptText aria-hidden="true" />Taxes</h2>
		<p>
			Gifts are not tax-deductible yet. We are forming a Nevada nonprofit corporation and will apply to the IRS for recognition
			as a 501(c)(3) charity. Once it is recognized, gifts are deductible as the law allows, less the value of any books you
			receive.
		</p>
	</section>
</div>

<style>
	.sponsorship-levels {
		display: grid;
		gap: var(--space-5);
		max-width: 72rem;
		padding-bottom: var(--space-7);
	}

	.title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		justify-content: space-between;
		gap: var(--space-4);
	}

	h1 {
		margin-bottom: 0;
	}

	/* Monthly or Yearly, as the Sponsorship page's gift form chooses how often. */
	.segmented {
		display: grid;
		grid-template-columns: 1fr 1fr;
		min-width: 16rem;
		margin: 0;
		padding: 0;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		overflow: hidden;
	}

	.segmented input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.segmented label {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		padding: var(--space-2) var(--space-4);
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
	}

	.segmented label + input + label {
		border-left: 1px solid var(--color-control-border);
	}

	.segmented input:checked + label {
		background: var(--color-link);
		color: var(--color-paper);
	}

	.segmented input:focus-visible + label {
		outline: 3px solid var(--color-focus);
		outline-offset: -3px;
	}

	.segmented :global(svg) {
		width: 1.125rem;
		height: 1.125rem;
	}

	.sponsorship-levels:has(#every-month:checked) .yearly,
	.sponsorship-levels:has(#every-year:checked) .monthly {
		display: none;
	}

	.table-frame {
		border: 1px solid var(--color-line);
		border-radius: 0.875rem;
		overflow: hidden;
	}

	table {
		width: 100%;
		margin: 0;
		border: 0;
		border-collapse: collapse;
		table-layout: fixed;
	}

	th,
	td {
		border: 0;
		background: transparent;
	}

	thead tr,
	thead th,
	thead td {
		background: var(--color-surface);
	}

	thead td {
		width: 28%;
	}

	thead th {
		padding: var(--space-5) var(--space-3) var(--space-4);
		text-align: center;
		font-weight: inherit;
	}

	thead th > * {
		display: flex;
		justify-content: center;
	}

	.level-icon {
		color: var(--color-link);
	}

	.level-name {
		margin-top: var(--space-1);
		font-size: 1.25rem;
		font-weight: var(--font-weight-bold);
	}

	.price {
		flex-direction: column;
		align-items: center;
		margin-top: var(--space-1);
	}

	.price b {
		font-size: 1.875rem;
		line-height: 1.15;
		color: var(--color-action);
	}

	.price small {
		font-size: var(--font-size-small);
		white-space: nowrap;
		color: var(--color-ink-muted);
	}

	/* The heart that opens the gift form at this level, boxed like the Sponsorship page's. */
	thead th > .heart {
		display: inline-grid;
		place-items: center;
		width: var(--layout-target-minimum);
		height: var(--layout-target-minimum);
		margin: var(--space-3) auto 0;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink);
	}

	.heart :global(svg) {
		width: 1.375rem;
		height: 1.375rem;
	}

	tbody tr {
		border-top: 1px solid var(--color-line);
	}

	tbody th {
		padding: var(--space-3) var(--space-5);
		text-align: left;
		font-weight: var(--font-weight-semibold);
	}

	tbody td {
		padding: var(--space-3);
		text-align: center;
		vertical-align: middle;
	}

	td.yes {
		color: var(--color-link);
	}

	td.no {
		color: var(--color-line);
	}

	td.no :global(svg) {
		width: 1.125rem;
		height: 1.125rem;
	}

	td :global(svg) {
		vertical-align: middle;
	}

	tr.group th {
		padding: var(--space-4) var(--space-5) var(--space-2);
		font-size: 0.8125rem;
		font-weight: 650;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--color-ink-muted);
	}

	.later {
		display: inline-block;
		margin-left: var(--space-1);
		padding: 0 var(--space-2);
		border-radius: 999px;
		background: var(--color-placeholder-background);
		color: var(--color-ink);
		font-size: 0.75rem;
		font-weight: 650;
		letter-spacing: 0.04em;
		vertical-align: 0.1em;
	}

	.taxes {
		max-width: 46rem;
	}

	.taxes h2 {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: var(--space-3) 0 var(--space-2);
		font-size: 1.375rem;
	}

	.taxes h2 :global(svg) {
		color: var(--color-link);
	}

	.taxes p {
		margin: 0;
	}

	/* Phones: each benefit on its own line, its five marks under it. */
	@media (max-width: 40rem) {
		.segmented {
			width: 100%;
			min-width: 0;
		}

		table,
		thead,
		tbody {
			display: block;
		}

		tr {
			display: grid;
			grid-template-columns: repeat(5, minmax(0, 1fr));
		}

		thead td {
			display: none;
		}

		thead th {
			padding: var(--space-4) var(--space-1) var(--space-3);
		}

		.level-name {
			font-size: 0.75rem;
		}

		.price b {
			font-size: 1.0625rem;
		}

		.price small {
			font-size: 0.75rem;
		}

		tbody th {
			grid-column: 1 / -1;
			padding: var(--space-3) var(--space-3) 0;
			font-size: 0.9375rem;
		}

		tbody td {
			padding: var(--space-2) 0 var(--space-3);
		}

		tr.group th {
			padding: var(--space-4) var(--space-3) var(--space-1);
		}
	}
</style>
