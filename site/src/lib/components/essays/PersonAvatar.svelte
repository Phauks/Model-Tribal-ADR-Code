<!--
	A person's initials in a small circle, as in the approved editor mockups
	(essay-editor-mockups/4-commenting and v2-1): in the bar for who else is
	here, and on comment cards. The color comes from the name, so the same
	person keeps the same color.
-->
<script lang="ts">
	let { name, size = 'normal' }: { name: string; size?: 'normal' | 'small' } = $props();

	const tones = ['document', 'treaty', 'case', 'opinion', 'federal'] as const;

	const letters = $derived(
		name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? '')
			.join('')
	);
	const tone = $derived(tones[[...name].reduce((sum, character) => sum + character.charCodeAt(0), 0) % tones.length]);
</script>

<span class="avatar tone-{tone}" class:small={size === 'small'} aria-hidden="true">{letters}</span>

<style>
	.avatar {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 50%;
		border: 2px solid var(--color-paper);
		color: var(--color-paper);
		font-size: 0.7rem;
		font-weight: var(--font-weight-semibold);
		line-height: 1;
		letter-spacing: 0.02em;
	}

	.avatar.small {
		width: 1.4rem;
		height: 1.4rem;
		font-size: 0.6rem;
	}

	.tone-document {
		background: var(--color-timeline-document);
	}

	.tone-treaty {
		background: var(--color-timeline-treaty);
	}

	.tone-case {
		background: var(--color-timeline-case);
	}

	.tone-opinion {
		background: var(--color-timeline-opinion);
	}

	.tone-federal {
		background: var(--color-timeline-federal);
	}
</style>
