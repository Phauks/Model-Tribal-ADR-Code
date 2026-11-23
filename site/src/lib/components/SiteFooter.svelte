<script lang="ts">
	import { repositoryLink } from '#lib';
	import GithubMark from './GithubMark.svelte';
	import type { TrackVersions } from '#lib/server/versions.ts';

	let { versions }: { versions: TrackVersions } = $props();
</script>

<!-- Trevor asked on Nov. 22, 2026 for the footer to drop its two notes (model text, and colors, fonts and icons); the font and icon licenses are listed under Licenses by material. -->
<footer class="site-footer no-print">
	<div class="page-width">
		<ul class="footer-links">
			<li><a href="/about">About</a></li>
			<li><a href="/sponsor">Sponsorship</a></li>
			<li><a href="/events">Events</a></li>
			<li><a href="/using-ai">Using AI with Tribal law</a></li>
			<li><a href="/people">People</a></li>
			<li><a href="/about/timeline">Timeline to public review</a></li>
			<li><a href="/requests">Request a correction or removal</a></li>
			<li><a href="/forms">Forms</a></li>
			<li><a href="/charter">Charter</a></li>
			<li><a href="/acknowledgments">Acknowledgments</a></li>
			<li><a href="/changelog">Changelog</a></li>
			<li><a href="/downloads">Data sets</a></li>
			<li><a href="/downloads#checking">Verify a file</a></li>
			<li><a href="/copies">Source documents</a></li>
			<li><a href="/licenses">Licenses by material</a></li>
			<li><a href="{repositoryLink}"><GithubMark /><span>GitHub</span></a></li>
			<li><a href="/join">Help with this work</a></li>
			<li><a href="/workspace" data-sveltekit-reload>Co-author sign-in</a></li>
		</ul>
		<p class="small muted">
			Working draft. Content {versions.content} · Website {versions.site} · Print edition {versions.print}
		</p>
	</div>
</footer>

<style>
	.site-footer {
		margin-top: 0;
		padding: var(--space-5) 0;
		background: var(--color-surface);
		border-top: 1px solid var(--color-line);
	}

	.footer-links {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-5);
		list-style: none;
		padding: 0;
	}

	.footer-links a {
		display: inline-flex;
		gap: var(--space-2);
		align-items: center;
		min-height: var(--layout-target-minimum);
	}
</style>
