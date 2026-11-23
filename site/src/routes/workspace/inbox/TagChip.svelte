<script lang="ts">
	// A tag's name with a small mark in its color. The name always shows, so
	// the color is never the only way to tell tags apart.
	import type { TagColor } from '#lib/mail.ts';

	let { tag, size = 'normal' }: { tag: { name: string; color: TagColor }; size?: 'normal' | 'small' } = $props();
</script>

<span class="chip chip-{tag.color}" class:chip-small={size === 'small'}><span class="swatch" aria-hidden="true"></span>{tag.name}</span>

<style>
	.chip {
		--tag-color: var(--color-link);
		display: inline-flex;
		align-items: center;
		gap: 0.4em;
		padding: 0.1em 0.6em;
		border-radius: 999px;
		background: color-mix(in srgb, var(--tag-color) 14%, transparent);
		color: var(--color-ink);
		font-size: var(--font-size-small);
		line-height: 1.5;
		white-space: nowrap;
	}
	.chip-small {
		font-size: 0.8rem;
		padding: 0 0.5em;
	}
	.swatch {
		display: inline-block;
		width: 0.6em;
		height: 0.6em;
		border-radius: 50%;
		background: var(--tag-color);
	}
	/* Tag colors come from the site's tokens, never raw colors (src/lib/mail.ts, tagColors). */
	.chip-orange {
		--tag-color: var(--color-action);
	}
	.chip-gray {
		--tag-color: var(--color-ink-muted);
	}
	.chip-gold {
		--tag-color: var(--color-placeholder-rule);
	}
	.chip-green {
		--tag-color: var(--color-map-class-2);
	}
	.chip-purple {
		--tag-color: var(--color-band);
	}
	@media (forced-colors: active) {
		.chip {
			border: 1px solid CanvasText;
		}
	}
</style>
