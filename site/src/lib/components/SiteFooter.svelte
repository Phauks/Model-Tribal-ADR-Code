<script lang="ts">
	import { repositoryLink } from '#lib';
	import type { TrackVersions } from '#lib/server/versions.ts';

	let { versions }: { versions: TrackVersions } = $props();
</script>

<footer class="site-footer no-print">
	<div class="page-width">
		<ul class="footer-links">
			<li><a href="/requests">Request a correction or removal</a></li>
			<li><a href="{repositoryLink}/blob/main/docs/charter.md">Charter</a></li>
			<li><a href="/changelog">Changelog</a></li>
			<li><a href="{repositoryLink}/blob/main/LICENSE.md">Licenses by material</a></li>
			<li><a href="{repositoryLink}">Source files</a></li>
			<li><a href="/workspace" data-sveltekit-reload>Co-author sign-in</a></li>
		</ul>
		<p class="small muted">
			Content {versions.content} · Website {versions.site} · Print edition {versions.print}
		</p>
		<p class="small muted">
			Model text for Native nations to adapt through their own processes. It is not law in force
			and does not speak for any nation.
		</p>
		<p class="small muted">
			The site’s colors are a design choice and carry no tribal symbolism. Set in Atkinson
			Hyperlegible Next and Noto Sans, under the SIL Open Font License.
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
		align-items: center;
		min-height: var(--layout-target-minimum);
	}
</style>
