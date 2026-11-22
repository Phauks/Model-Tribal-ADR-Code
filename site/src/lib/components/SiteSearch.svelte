<!--
	@component
	The site search in the masthead (site/DESIGN.md, section 6, "Search").
	It starts as a light "Search" control and opens into a search box when
	pressed (Trevor asked for this on Nov. 22, 2026). The control is a link to
	/search, so without scripts it opens the search page, which has its own
	box. With scripts, pressing it shows the box here and moves focus into
	it; Escape, or leaving an empty box, closes it again and returns focus to
	the control. The box submits to /search?q=…, where the matches are listed
	from the index built with the site (src/lib/site-search.ts).
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { page } from '$app/state';
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';

	let { identifier = 'site-search' }: { identifier?: string } = $props();

	let query = $state('');
	let expanded = $state(false);
	let input: HTMLInputElement | undefined = $state();
	let toggle: HTMLAnchorElement | undefined = $state();
	let form: HTMLFormElement | undefined = $state();

	// Prerendered pages cannot read the address's query while they are built,
	// so the box is filled in the browser only.
	$effect(() => {
		query = page.url.pathname === '/search' ? (page.url.searchParams.get('q') ?? '') : '';
	});

	// A new page closes the box.
	$effect(() => {
		void page.url.pathname;
		expanded = false;
	});

	async function open(event: MouseEvent) {
		event.preventDefault();
		expanded = true;
		await tick();
		input?.focus();
	}

	async function close() {
		expanded = false;
		await tick();
		toggle?.focus();
	}

	function closeOnEscape(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
		}
	}

	// Leaving an empty box closes it, so it does not stay open by accident.
	function closeWhenLeft(event: FocusEvent) {
		const next = event.relatedTarget as Node | null;
		if (query.trim() === '' && !(next && form?.contains(next))) expanded = false;
	}
</script>

{#if expanded}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<form
		bind:this={form}
		class="site-search"
		role="search"
		action="/search"
		method="get"
		data-sveltekit-keepfocus
		onkeydown={closeOnEscape}
		onfocusout={closeWhenLeft}
	>
		<label class="visually-hidden" for={identifier}>Search nations, glossary and pages</label>
		<input
			bind:this={input}
			id={identifier}
			type="search"
			name="q"
			autocomplete="off"
			enterkeyhint="search"
			placeholder="Search the site"
			bind:value={query}
		/>
		<button class="submit" type="submit">
			<Search size={20} strokeWidth={1.75} />
			<span>Search</span>
		</button>
		<button class="close" type="button" aria-label="Close search" title="Close search" onclick={close}>
			<X size={20} strokeWidth={1.75} />
		</button>
	</form>
{:else}
	<a
		bind:this={toggle}
		class="search-toggle"
		href="/search"
		aria-expanded={false}
		onclick={open}
	>
		<Search size={20} strokeWidth={1.75} />
		<span>Search</span>
	</a>
{/if}

<style>
	/* Light: no border, only a faint fill, so it reads as quieter than the buttons beside it. */
	.search-toggle {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		border-radius: var(--radius-control);
		background: color-mix(in srgb, var(--color-band-text) 12%, transparent);
		color: var(--color-band-text);
		font-weight: var(--font-weight-semibold);
		text-decoration: none;
		white-space: nowrap;
	}

	.search-toggle:visited {
		color: var(--color-band-text);
	}

	.search-toggle:hover {
		background: color-mix(in srgb, var(--color-band-text) 22%, transparent);
	}

	.site-search {
		display: flex;
		align-items: stretch;
		gap: 0;
		width: min(28rem, 100%);
		margin: 0;
	}

	.site-search input {
		flex: 1 1 auto;
		min-width: 0;
		min-height: var(--layout-target-minimum);
		margin: 0;
		border: 2px solid var(--color-band-text);
		border-right: 0;
		border-radius: var(--radius-control) 0 0 var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink);
	}

	.site-search input::placeholder {
		color: var(--color-ink-muted);
		opacity: 1;
	}

	/* The close button already clears and folds the box; one X is enough. */
	.site-search input::-webkit-search-cancel-button {
		appearance: none;
	}

	.site-search button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		font: inherit;
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
	}

	.submit {
		padding: 0 var(--space-3);
		border: 2px solid var(--color-band-text);
		border-left: 1px solid var(--color-control-border);
		border-radius: 0 var(--radius-control) var(--radius-control) 0;
		background: var(--color-band-text);
		color: var(--color-band);
	}

	.close {
		min-width: var(--layout-target-minimum);
		margin-left: var(--space-2);
		padding: 0;
		border: 1px solid var(--color-band-text);
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--color-band-text);
	}
</style>
