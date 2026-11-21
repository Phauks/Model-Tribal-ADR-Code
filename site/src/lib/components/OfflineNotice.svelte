<script lang="ts">
	// "You are offline. Showing content as of [version, date]." (site/DESIGN.md, section 10)
	import { onMount } from 'svelte';

	let { contentVersion }: { contentVersion: string } = $props();
	let offline = $state(false);

	onMount(() => {
		const update = () => (offline = !navigator.onLine);
		update();
		window.addEventListener('online', update);
		window.addEventListener('offline', update);
		return () => {
			window.removeEventListener('online', update);
			window.removeEventListener('offline', update);
		};
	});
</script>

{#if offline}
	<div class="page-width">
		<div class="notice" role="note">
			<p>
				You are offline. Showing the copy saved on this device, content version {contentVersion}.
			</p>
		</div>
	</div>
{/if}
