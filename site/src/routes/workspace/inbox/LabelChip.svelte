<script lang="ts">
	// A label's name with a small mark in its color. The name always shows, so
	// the color is never the only way to tell labels apart.
	import type { LabelColor } from '#lib/mail.ts';

	let { label }: { label: { name: string; color: LabelColor } } = $props();
</script>

<span class="chip"><span class="swatch swatch-{label.color}" aria-hidden="true"></span>{label.name}</span>

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}
	.swatch {
		display: inline-block;
		width: 0.75em;
		height: 0.75em;
		border-radius: 50%;
		border: 1px solid var(--color-control-border);
	}
	/* Label colors come from the site's tokens, never raw colors (src/lib/mail.ts, labelColors). */
	.swatch-teal {
		background: var(--color-link);
	}
	.swatch-orange {
		background: var(--color-action);
	}
	.swatch-gray {
		background: var(--color-ink-muted);
	}
	.swatch-gold {
		background: var(--color-map-class-1);
	}
	.swatch-green {
		background: var(--color-map-class-3);
	}
	.swatch-purple {
		background: var(--color-band);
	}
</style>
