<script lang="ts">
	// Automatic, Light or Dark (site/DESIGN.md, section 8). The choice is kept
	// on this device only. The inline script in app.html applies it before
	// the first paint.
	import { onMount } from 'svelte';

	type ThemeChoice = 'automatic' | 'light' | 'dark';

	let choice: ThemeChoice = $state('automatic');
	let ready = $state(false);

	onMount(() => {
		const current = document.documentElement.dataset.theme;
		choice = current === 'light' || current === 'dark' ? current : 'automatic';
		ready = true;
	});

	function apply(next: ThemeChoice) {
		const root = document.documentElement;
		if (next === 'automatic') {
			delete root.dataset.theme;
		} else {
			root.dataset.theme = next;
		}
		try {
			if (next === 'automatic') {
				localStorage.removeItem('theme');
			} else {
				localStorage.setItem('theme', next);
			}
		} catch {
			// Storage can be blocked; the choice then lasts for this page only.
		}
	}
</script>

{#if ready}
	<div class="theme-setting">
		<label for="theme-setting">Theme</label>
		<select id="theme-setting" bind:value={choice} onchange={() => apply(choice)}>
			<option value="automatic">Automatic</option>
			<option value="light">Light</option>
			<option value="dark">Dark</option>
		</select>
	</div>
{/if}

<style>
	.theme-setting {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--font-size-small);
	}
</style>
