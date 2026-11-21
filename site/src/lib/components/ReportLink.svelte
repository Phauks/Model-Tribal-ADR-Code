<script lang="ts">
	// One "Report a problem" link at the top of a page, which opens the request
	// form with the record filled in. Trevor asked (2026-11-21) for one link
	// per page rather than one beside every fact (site/DESIGN.md, "Nation pages").
	let { record }: { record: string } = $props();
	const target = $derived(
		`/requests?${new URLSearchParams({ kind: 'correct', record }).toString().replaceAll('%2F', '/')}`
	);
</script>

<p class="report-link no-print">
	Something wrong or missing on this page? <a href={target}>Report a problem</a>
</p>
