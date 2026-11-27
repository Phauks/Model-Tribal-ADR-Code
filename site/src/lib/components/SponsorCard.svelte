<script lang="ts">
	// One sponsor as the public pages show them (docs/sponsorship.md): the
	// logo or initials, the name, the line about them, what their gift helps
	// fund and their link. A sponsor listed as "a sponsor" shows none of
	// their own details. The amount is never shown.
	import { earmarkShortLabels, initials, type Earmark } from '#lib/sponsorship.ts';
	import { readableDate } from '#lib/readable-date.ts';

	interface Props {
		sponsor: {
			slug: string | null;
			name: string | null;
			oneLine: string | null;
			link: string | null;
			hasLogo: boolean;
			earmark: Earmark;
			since: string;
		};
		/** Where the logo is, when it is not the public address (the Account page's preview). */
		logoAddress?: string;
		/** Whether the name links to the sponsor's own page. */
		linkName?: boolean;
	}

	let { sponsor, logoAddress, linkName = true }: Props = $props();
	const logo = $derived(sponsor.hasLogo ? (logoAddress ?? (sponsor.slug ? `/sponsors/${sponsor.slug}/logo` : null)) : null);
	const host = $derived.by(() => {
		if (!sponsor.link) return null;
		try {
			return new URL(sponsor.link).hostname.replace(/^www\./, '');
		} catch {
			// expected: a link that is not an address shows no site name.
			return null;
		}
	});
</script>

<article class="sponsor-card">
	<div class="mark" aria-hidden="true">
		{#if logo}
			<img src={logo} alt="" loading="lazy" />
		{:else}
			<span>{sponsor.name ? initials(sponsor.name) : '?'}</span>
		{/if}
	</div>
	<div class="text">
		<h3>
			{#if sponsor.name && sponsor.slug && linkName}
				<a href="/sponsors/{sponsor.slug}">{sponsor.name}</a>
			{:else}
				{sponsor.name ?? 'A sponsor'}
			{/if}
		</h3>
		{#if sponsor.oneLine}<p>{sponsor.oneLine}</p>{/if}
		{#if !sponsor.name}<p class="muted">Chose not to be named</p>{/if}
		<p class="small">Helping fund: {earmarkShortLabels[sponsor.earmark]}</p>
		<p class="small muted">
			Since {readableDate(sponsor.since.slice(0, 7))}{#if host}{' · '}<a href={sponsor.link} rel="sponsored noopener noreferrer"
					>{host}</a
				>{/if}
		</p>
	</div>
</article>

<style>
	.sponsor-card {
		display: flex;
		gap: var(--space-4);
		align-items: flex-start;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		padding: var(--space-4);
		background: var(--color-surface);
		min-width: 0;
	}

	.mark {
		flex: none;
		width: 3.5rem;
		height: 3.5rem;
		border-radius: var(--radius-panel);
		display: grid;
		place-items: center;
		background: var(--color-paper);
		border: 1px solid var(--color-line);
		overflow: hidden;
		font-weight: var(--font-weight-semibold);
		color: var(--color-ink-muted);
	}

	.mark img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.text {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	h3 {
		margin: 0 0 var(--space-1);
		font-size: var(--font-size-body);
	}

	p {
		margin: 0 0 var(--space-1);
	}
</style>
