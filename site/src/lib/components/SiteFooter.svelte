<script lang="ts">
	import { repositoryLink } from '#lib';
	import GithubMark from './GithubMark.svelte';
	import type { TrackVersions } from '#lib/server/versions.ts';

	let { versions }: { versions: TrackVersions } = $props();
</script>

<footer class="site-footer no-print">
	<div class="page-width">
		<ul class="footer-links">
			<li><a href="/requests">Request a correction or removal</a></li>
			<li><a href="/charter">Charter</a></li>
			<li><a href="/acknowledgments">Acknowledgments</a></li>
			<li><a href="/changelog">Changelog</a></li>
			<li><a href="/downloads">Downloads</a></li>
			<li><a href="/copies">Copies of public documents</a></li>
			<li><a href="/licenses">Licenses by material</a></li>
			<li><a href="{repositoryLink}"><GithubMark /><span>GitHub</span></a></li>
			<li><a href="/join">Help with the project</a></li>
			<li><a href="/workspace" data-sveltekit-reload>Co-author sign-in</a></li>
		</ul>
		<p class="small muted">
			Working draft. Content {versions.content} · Website {versions.site} · Print edition {versions.print}
		</p>
		<p class="small muted">
			Model text for Native nations to adapt through their own processes. Nothing here has been reviewed or adopted by a Native nation yet; it is not law in force and does not speak for any nation.
		</p>
		<p class="small muted">
			The site’s colors are a design choice and carry no tribal symbolism. Set in Atkinson
			Hyperlegible Next and Noto Sans; Noto Serif and OpenDyslexic can be chosen in Settings. All
			fonts are under the SIL Open Font License. Icons from Lucide, under the ISC License; the GitHub mark from GitHub’s Octicons, under the MIT License.
		</p>
	</div>
</footer>

<style>
	.site-footer {
		margin-top: var(--space-8);
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
