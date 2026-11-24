<script lang="ts">
	// Checks a file a reader downloaded against the SHA-256 this site published for it
	// (site/DESIGN.md, section 10, "Checking a file"; src/lib/checksums.ts). The file is read in the
	// browser and never sent anywhere. Used on the Downloads page and beside the model court forms. With an
	// expected hash it compares the file with that hash; otherwise it looks the file up in the list of
	// every file the site publishes.
	import CopyHash from '#lib/components/CopyHash.svelte';
	import { allChecksums, fileName, pathsWithHash } from '#lib/checksums.ts';
	import { formatBytes } from '#lib/offline-collections.ts';
	import { hashFile, isSha256 } from '#lib/sha256.ts';

	let {
		expected = '',
		name = '',
		identifier = 'verify'
	}: {
		/** The SHA-256 the file should have, if the reader came here from one file's link. */
		expected?: string;
		/** That file's name, to say what is being checked. */
		name?: string;
		/** Keeps the labels' ids apart when a page has more than one. */
		identifier?: string;
	} = $props();

	interface Checked {
		key: number;
		file: string;
		bytes: number;
		done: number;
		sha256?: string;
		/** Paths on this site with the same hash. */
		matches?: string[];
		problem?: string;
	}

	// Seeded from the link the reader followed; the reader may then paste another hash.
	// svelte-ignore state_referenced_locally
	let compareWith = $state(expected);
	let results = $state<Checked[]>([]);
	let listMissing = $state(false);
	let dragging = $state(false);
	let input: HTMLInputElement | undefined = $state();
	let counter = 0;

	const wanted = $derived(compareWith.trim().toLowerCase());
	const wantedIsValid = $derived(isSha256(wanted));
	const numbers = new Intl.NumberFormat('en-US');

	async function check(files: FileList | File[]): Promise<void> {
		const chosen = Array.from(files);
		if (chosen.length === 0) return;
		const entries = chosen.map((file) => ({ key: (counter += 1), file: file.name, bytes: file.size, done: 0 }) as Checked);
		results = [...entries, ...results];
		const manifest = allChecksums();
		for (const [index, file] of chosen.entries()) {
			// The proxy Svelte made of the entry, so the page shows its progress.
			const entry = results.find((item) => item.key === entries[index].key);
			if (!entry) continue;
			try {
				entry.sha256 = await hashFile(file, (done) => (entry.done = done));
				const list = await manifest;
				listMissing = !list;
				entry.matches = list ? pathsWithHash(list, entry.sha256) : undefined;
			} catch {
				entry.problem = 'This file could not be read. Try choosing it again.';
			}
		}
	}

	function chosen(event: Event): void {
		const target = event.currentTarget as HTMLInputElement;
		if (target.files) void check(target.files);
		target.value = '';
	}

	function dropped(event: DragEvent): void {
		event.preventDefault();
		dragging = false;
		if (event.dataTransfer?.files) void check(event.dataTransfer.files);
	}
</script>

<div class="verifier">
	<p class="field">
		<label for="{identifier}-expected">SHA-256 to compare with <span class="muted">(optional)</span></label>
		<input
			id="{identifier}-expected"
			class="hash-input"
			type="text"
			inputmode="text"
			autocomplete="off"
			spellcheck="false"
			placeholder="64 letters and digits"
			bind:value={compareWith}
			aria-describedby="{identifier}-expected-hint"
		/>
		<span id="{identifier}-expected-hint" class="hint">
			{#if name && wanted === expected.toLowerCase() && wantedIsValid}
				The SHA-256 this site published for {name}.
			{:else if wanted && !wantedIsValid}
				A SHA-256 is 64 letters and digits. Without one, each file is looked up in the list of every file this site publishes.
			{:else}
				Leave it empty to look each file up in the list of every file this site publishes.
			{/if}
		</span>
	</p>

	<div
		class="drop"
		class:dragging
		role="group"
		aria-label="Files to check"
		ondragover={(event) => {
			event.preventDefault();
			dragging = true;
		}}
		ondragleave={() => (dragging = false)}
		ondrop={dropped}
	>
		<p>
			<button class="button" type="button" onclick={() => input?.click()}>Choose files to check</button>
			<span class="muted">or drop them here.</span>
		</p>
		<p class="hint">Your files stay on this device. They are read in your browser and nothing is uploaded.</p>
		<input bind:this={input} class="visually-hidden" type="file" multiple tabindex="-1" aria-hidden="true" onchange={chosen} />
	</div>

	{#if results.length > 0}
		<ul class="results" aria-live="polite">
			{#each results as result (result.key)}
				{@const compared = wantedIsValid && result.sha256 ? result.sha256 === wanted : undefined}
				<li
					class:good={compared === true || (compared === undefined && (result.matches?.length ?? 0) > 0)}
					class:bad={compared === false || (compared === undefined && result.matches?.length === 0)}
				>
					<p class="file"><strong>{result.file}</strong> <span class="muted">{formatBytes(result.bytes)}</span></p>
					{#if result.problem}
						<p class="field-error">{result.problem}</p>
					{:else if !result.sha256}
						<label class="working">
							Reading: {numbers.format(Math.round((result.done / Math.max(result.bytes, 1)) * 100))}%
							<progress max={result.bytes || 1} value={result.done}></progress>
						</label>
					{:else}
						<p class="hash">SHA-256 <CopyHash sha256={result.sha256} label={result.file} /></p>
						{#if compared === true}
							<p class="verdict">It matches. This is the file that was published, unchanged.</p>
						{:else if compared === false}
							<p class="verdict">
								It does not match. The file may be incomplete, changed since it was published, or a different file or version.
								{#if result.matches && result.matches.length > 0}It is, though, this site’s {fileName(result.matches[0])}.{/if}
							</p>
						{:else if result.matches && result.matches.length > 0}
							<p class="verdict">
								It matches this site’s
								{#each result.matches as match, index (match)}{#if index > 0}, {/if}<a href={match}>{fileName(match)}</a>{/each}, unchanged.
							</p>
						{:else if result.matches}
							<p class="verdict">
								This site does not publish a file with this SHA-256 today. It may be an older version, a document a nation asked
								us to remove, a ZIP of documents (check the files inside it instead), or a file that was changed.
							</p>
						{:else if listMissing}
							<p class="verdict">The list of this site’s files could not be read. Connect to the internet and try again, or paste the SHA-256 to compare with above.</p>
						{/if}
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.verifier {
		margin: var(--space-3) 0 var(--space-5);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.hash-input {
		font-family: ui-monospace, monospace;
		max-width: 100%;
	}

	.drop {
		padding: var(--space-4);
		margin: var(--space-3) 0;
		border: 2px dashed var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface);
	}

	.drop.dragging {
		border-color: var(--color-action);
	}

	.drop > p {
		margin: 0 0 var(--space-2);
	}

	.drop > p:last-of-type {
		margin-bottom: 0;
	}

	.results {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-3);
	}

	.results > li {
		padding: var(--space-3);
		border: 1px solid var(--color-line);
		border-left-width: 4px;
		border-radius: var(--radius-panel);
	}

	.results > li.good {
		border-left-color: var(--color-action);
	}

	.results > li.bad {
		border-left-color: var(--color-danger);
	}

	.results p {
		margin: 0 0 var(--space-1);
	}

	.working progress {
		display: block;
		width: 100%;
		max-width: 20rem;
		accent-color: var(--color-action);
	}
</style>
