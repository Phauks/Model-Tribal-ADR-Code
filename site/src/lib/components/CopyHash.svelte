<script lang="ts">
	// A SHA-256 that copies itself when clicked (src/lib/copy-hash.ts). The markup is shared with
	// hashes built as HTML text, and the site's layout does the copying, so every hash on the site
	// looks and works the same.
	import { copyHashHtml } from '#lib/copy-hash.ts';

	let { sha256, label, iconOnly = false }: { sha256: string; label?: string; iconOnly?: boolean } = $props();
</script>

{@html copyHashHtml(sha256, { label, iconOnly })}
