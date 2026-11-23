<script lang="ts">
	// A count beside a heading or label, such as the number of references, in a
	// small badge rather than a loose number (Trevor, Nov. 23, 2026). Screen
	// readers hear it after a comma, followed by `label` when there is one,
	// such as ", 3 unread".
	let { count, label }: { count: number; label?: string } = $props();
	const shown = $derived(count.toLocaleString('en-US'));
</script>

<span class="count-badge"
	><span class="visually-hidden">, </span>{shown}{#if label}<span class="visually-hidden">{' '}{label}</span>{/if}</span
>
