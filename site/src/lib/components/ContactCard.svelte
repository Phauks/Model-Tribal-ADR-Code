<script lang="ts">
	// A nation's contacts (site/DESIGN.md, "Contact card"): the websites in a
	// card of their own, then one card for each office, named once, where each
	// contact is a labeled row with a Lucide icon beside its label. Sources are
	// listed in the page's Sources section.
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Globe from '@lucide/svelte/icons/globe';
	import Landmark from '@lucide/svelte/icons/landmark';
	import Mail from '@lucide/svelte/icons/mail';
	import Mailbox from '@lucide/svelte/icons/mailbox';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Phone from '@lucide/svelte/icons/phone';
	import Printer from '@lucide/svelte/icons/printer';
	import type { ContactCards, ContactKind, ContactRow } from '#lib/contact-card.ts';

	let { cards, headingLevel = 3 }: { cards: ContactCards; headingLevel?: 3 | 4 } = $props();

	const icons: Record<ContactKind, typeof Globe> = {
		website: Globe,
		'physical-address': MapPin,
		'mailing-address': Mailbox,
		phone: Phone,
		fax: Printer,
		email: Mail,
		other: Globe
	};
	const iconSize = 20;
	const iconStroke = 1.75;
	const websitesTitle = $derived(cards.websites.length > 1 ? 'Websites' : 'Website');
</script>

{#snippet value(row: ContactRow)}
	{#if row.link}<a
			href={row.link}
			target={row.external ? '_blank' : undefined}
			rel={row.external ? 'noopener noreferrer' : undefined}
			>{#each row.lines as line, lineIndex (lineIndex)}{#if lineIndex > 0}<br />{/if}{line}{/each}{#if row.external}<ExternalLink
					class="contact-external"
					size={16}
					strokeWidth={iconStroke}
				/>{/if}{#if row.linkHint}<span class="visually-hidden">{` (${row.linkHint})`}</span>{/if}</a
		>{:else}<span
			>{#each row.lines as line, lineIndex (lineIndex)}{#if lineIndex > 0}<br />{/if}{line}{/each}</span
		>{/if}
	{#if row.note}<span class="contact-note">{row.note}</span>{/if}
{/snippet}

<div class="contact-offices">
	{#if cards.websites.length > 0}
		<section class="contact-card" aria-label={websitesTitle}>
			<svelte:element this={`h${headingLevel}`} class="contact-office">
				<Globe size={iconSize} strokeWidth={iconStroke} />
				{websitesTitle}
			</svelte:element>
			<ul class="contact-websites">
				{#each cards.websites as row, index (index)}
					<li>{@render value(row)}</li>
				{/each}
			</ul>
		</section>
	{/if}
	{#each cards.offices as office (office.name)}
		<section class="contact-card" aria-label={office.name}>
			<svelte:element this={`h${headingLevel}`} class="contact-office">
				<Landmark size={iconSize} strokeWidth={iconStroke} />
				{office.name}
			</svelte:element>
			<dl>
				{#each office.rows as row, index (index)}
					{@const Icon = icons[row.kind]}
					<div class="contact-row">
						<dt>
							<Icon size={iconSize} strokeWidth={iconStroke} />
							{row.label}
						</dt>
						<dd>{@render value(row)}</dd>
					</div>
				{/each}
			</dl>
		</section>
	{/each}
</div>

<style>
	.contact-offices {
		display: grid;
		gap: var(--space-4);
		margin: 0 0 var(--space-5);
	}

	.contact-card {
		container-type: inline-size;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		overflow: hidden;
	}

	.contact-office {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
		padding: var(--space-3) var(--space-4);
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-line);
		font-size: var(--font-size-body);
	}

	dl {
		margin: 0;
		padding: 0 var(--space-4);
	}

	.contact-row {
		display: grid;
		grid-template-columns: 10.5rem 1fr;
		gap: var(--space-1) var(--space-4);
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--color-line);
	}

	.contact-row:last-child {
		border-bottom: 0;
	}

	dt {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		font-weight: var(--font-weight-semibold);
	}

	dt :global(svg) {
		flex: none;
		margin-top: 0.15em;
		color: var(--color-ink-muted);
	}

	dd {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-1);
		margin: 0;
		min-width: 0;
		overflow-wrap: break-word;
	}

	.contact-card :global(.contact-external) {
		display: inline;
		margin-left: 0.25em;
		vertical-align: -0.1em;
	}



	.contact-websites {
		display: grid;
		gap: var(--space-3);
		margin: 0;
		padding: var(--space-3) var(--space-4);
		list-style: none;
	}

	.contact-websites li {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-1);
		overflow-wrap: break-word;
	}

	.contact-note {
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	/* In a narrow card the label sits above its value, still beside its icon. */
	@container (max-width: 24rem) {
		.contact-row {
			grid-template-columns: 1fr;
		}

		dd {
			padding-left: calc(20px + var(--space-2));
		}
	}

	@media print {
		.contact-card {
			break-inside: avoid;
		}

	}
</style>
