<script lang="ts">
	// A round mark with someone's initials, so a list of mail is quick to scan.
	// It is decoration: the name is always written next to it.
	let { name }: { name: string } = $props();

	const initials = $derived.by(() => {
		const words = name
			.replace(/<[^>]*>/g, '')
			.replace(/@.*$/, '')
			.split(/[\s._-]+/)
			.filter((word) => /\p{L}/u.test(word));
		const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words.slice(0, 1);
		return letters.map((word) => [...word][0]?.toUpperCase() ?? '').join('') || '?';
	});
	// Three tones that read well with the page color as the letter color, in light and dark themes.
	const tone = $derived([...name].reduce((sum, character) => sum + (character.codePointAt(0) ?? 0), 0) % 3);
</script>

<span class="avatar tone-{tone}" aria-hidden="true">{initials}</span>

<style>
	.avatar {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 50%;
		background: var(--color-link);
		color: var(--color-paper);
		font-size: 0.85rem;
		font-weight: var(--font-weight-bold);
		letter-spacing: 0.02em;
	}
	.tone-1 {
		background: var(--color-action);
	}
	.tone-2 {
		background: var(--color-ink-muted);
	}
	@media (forced-colors: active) {
		.avatar {
			border: 1px solid CanvasText;
		}
	}
</style>
