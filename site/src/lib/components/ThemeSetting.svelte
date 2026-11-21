<script lang="ts">
	// Theme button (site/DESIGN.md, section 8). It shows a sun while the light
	// theme is in use and a moon while the dark theme is in use; pressing it
	// switches to the other theme. Until the reader presses it, the device's
	// setting decides. The choice is kept on this device only. The inline
	// script in app.html applies a stored choice before the first paint, and
	// the icons are swapped by CSS, so the right icon shows before this script
	// runs.
	import { onMount } from 'svelte';
	import Moon from '@lucide/svelte/icons/moon';
	import Sun from '@lucide/svelte/icons/sun';

	type Theme = 'light' | 'dark';

	let current = $state<Theme>('light');

	function themeInUse(): Theme {
		const chosen = document.documentElement.dataset.theme;
		if (chosen === 'light' || chosen === 'dark') return chosen;
		return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	}

	onMount(() => {
		current = themeInUse();
		// Follow the device while the reader has not chosen a theme.
		const deviceSetting = window.matchMedia('(prefers-color-scheme: dark)');
		const follow = () => {
			current = themeInUse();
		};
		deviceSetting.addEventListener('change', follow);
		return () => deviceSetting.removeEventListener('change', follow);
	});

	function switchTheme() {
		const next: Theme = themeInUse() === 'dark' ? 'light' : 'dark';
		document.documentElement.dataset.theme = next;
		current = next;
		try {
			localStorage.setItem('theme', next);
		} catch {
			// Storage can be blocked; the choice then lasts for this page only.
		}
	}

	const label = $derived(current === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
</script>

<button class="theme-button" type="button" aria-label={label} title={label} onclick={switchTheme}>
	<span class="sun"><Sun size={24} /></span>
	<span class="moon"><Moon size={24} /></span>
</button>

<style>
	.theme-button {
		display: inline-grid;
		place-items: center;
		min-width: var(--layout-target-minimum);
		min-height: var(--layout-target-minimum);
		padding: 0;
		border: 1px solid var(--color-band-text);
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--color-band-text);
		cursor: pointer;
	}

	.sun {
		display: inline-flex;
	}

	/* Which icon shows is decided by the theme in use, so it is right before
	   the page's script runs. */
	.moon {
		display: none;
	}

	@media (prefers-color-scheme: dark) {
		:global(:root:not([data-theme='light'])) .sun {
			display: none;
		}

		:global(:root:not([data-theme='light'])) .moon {
			display: inline-flex;
		}
	}

	:global(:root[data-theme='dark']) .sun {
		display: none;
	}

	:global(:root[data-theme='dark']) .moon {
		display: inline-flex;
	}
</style>
