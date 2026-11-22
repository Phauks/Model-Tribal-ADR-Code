<script lang="ts">
	// A nation's contacts, grouped by office (site/DESIGN.md, "Contact card").
	// The office is named once; each contact is a labeled row with a Lucide icon
	// beside its label. Sources are listed in the page's Sources section.
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Globe from '@lucide/svelte/icons/globe';
	import Landmark from '@lucide/svelte/icons/landmark';
	import Mail from '@lucide/svelte/icons/mail';
	import Mailbox from '@lucide/svelte/icons/mailbox';
	import MapIcon from '@lucide/svelte/icons/map';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Phone from '@lucide/svelte/icons/phone';
	import Printer from '@lucide/svelte/icons/printer';
	import type { ContactKind, ContactOffice } from '#lib/contact-card.ts';

	let { offices, headingLevel = 3 }: { offices: ContactOffice[]; headingLevel?: 3 | 4 } = $props();

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
</script>

<div class="contact-offices">
	{#each offices as office (office.name)}
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
						<dd>
							{#if row.link}<a
									href={row.link}
									target={row.external ? '_blank' : undefined}
									rel={row.external ? 'noopener noreferrer' : undefined}
									>{#each row.lines as line, lineIndex (lineIndex)}{#if lineIndex > 0}<br />{/if}{line}{/each}{#if row.external}<ExternalLink
											class="contact-external"
											size={16}
											strokeWidth={iconStroke}
										/><span class="visually-hidden"> (opens in a new tab)</span>{/if}</a
								>{:else}<span
									>{#each row.lines as line, lineIndex (lineIndex)}{#if lineIndex > 0}<br />{/if}{line}{/each}</span
								>{/if}
							{#if row.mapLink}
								<a class="contact-map" href={row.mapLink} target="_blank" rel="noopener noreferrer">
									<MapIcon size={18} strokeWidth={iconStroke} />
									<span>Open in Google Maps<span class="visually-hidden"> (opens in a new tab)</span></span>
								</a>
							{/if}
							{#if row.note}<span class="contact-note">{row.note}</span>{/if}
						</dd>
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

	dd :global(.contact-external) {
		display: inline;
		margin-left: 0.25em;
		vertical-align: -0.1em;
	}

	.contact-map {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		font-size: var(--font-size-small);
	}

	.contact-map :global(svg) {
		flex: none;
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

		.contact-map {
			display: none;
		}
	}
</style>
