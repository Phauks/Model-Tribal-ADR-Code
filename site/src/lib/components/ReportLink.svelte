<script lang="ts">
	// Opens the request form with the record and field filled in, so a
	// nation's staff can point at the exact fact (site/DESIGN.md, "Nation pages").
	let { record, field, label }: { record: string; field: string; label: string } = $props();
	const target = $derived(
		`/requests?${new URLSearchParams({ record, field }).toString().replaceAll('%2F', '/')}`
	);
</script>

<a class="report-link no-print" href={target}
	>Report a problem<span class="visually-hidden"> with {label.toLocaleLowerCase('en-US')}</span></a
>
