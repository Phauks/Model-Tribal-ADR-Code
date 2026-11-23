<script lang="ts" module>
	/** A file already sent, shown in the table with its status from the server (Intake). */
	export interface EarlierFile {
		reference: string;
		name: string;
		sizeBytes: number | null;
		statusText: string;
		problem: boolean;
		done: boolean;
		filedAs: string | null;
		/** Where it stands with the virus check; null when it never reached it. */
		scan?: 'checking' | 'clean' | 'flagged' | null;
	}
</script>

<script lang="ts">
	// The table of files being sent (docs/uploads.md, "The upload table"),
	// shared by Send files and Intake. Files are added by dropping them (or
	// whole folders) anywhere on the page, or with the Files and Folder
	// buttons. Each is sent in pieces of 10 MB, three files at a time; a
	// stopped file picks up where it left off. There is no limit on how many
	// files go in one batch (decision record 0038, "Limits").
	import { onMount, type Snippet } from 'svelte';
	import AudioLines from '@lucide/svelte/icons/audio-lines';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Clock from '@lucide/svelte/icons/clock';
	import FileText from '@lucide/svelte/icons/file-text';
	import Film from '@lucide/svelte/icons/film';
	import FolderUp from '@lucide/svelte/icons/folder-up';
	import Image from '@lucide/svelte/icons/image';
	import Link from '@lucide/svelte/icons/link';
	import Pause from '@lucide/svelte/icons/pause';
	import Play from '@lucide/svelte/icons/play';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Search from '@lucide/svelte/icons/search';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import ShieldEllipsis from '@lucide/svelte/icons/shield-ellipsis';
	import ShieldX from '@lucide/svelte/icons/shield-x';
	import Trash from '@lucide/svelte/icons/trash';
	import Upload from '@lucide/svelte/icons/upload';
	import X from '@lucide/svelte/icons/x';
	import { readableSize } from '#lib/uploads.ts';
	import { youtubeVideoIdentifier } from '#lib/video-links.ts';

	type RowState = 'ready' | 'sending' | 'paused' | 'sent' | 'problem';

	interface Row {
		key: number;
		file: File | null;
		link: string | null;
		name: string;
		size: number;
		state: RowState;
		/** 0 to 1. */
		progress: number;
		message: string;
		/** A refused file cannot be sent again; a stopped one can. */
		retryable: boolean;
		chosen: boolean;
		reference: string | null;
	}

	interface Props {
		/** Fields sent with each file, such as the answers or { pulled: true, note }. */
		extra: () => Record<string, unknown>;
		/** Checked before a batch starts; false stops it (the page shows why). */
		ready?: () => boolean;
		/** Called once every file in the table is sent. */
		finished?: (count: number) => void;
		/** A refusal of the answers, from the server. */
		refused?: (errors: Record<string, string>) => void;
		youtube?: boolean;
		folders?: boolean;
		earlier?: EarlierFile[];
		/** Show the "Filed as" column. */
		filedColumn?: boolean;
		/** Reads the earlier files again. Given, the table refreshes itself while a sent file waits for its virus check. */
		refresh?: () => Promise<unknown>;
		sendLabel?: (count: number) => string;
		/** Shown beside the table, such as the questions on Send files. */
		aside?: Snippet<[{ sending: boolean }]>;
	}

	let {
		extra,
		ready = () => true,
		finished,
		refused,
		youtube = false,
		folders = true,
		earlier = [],
		filedColumn = false,
		refresh,
		sendLabel = (count) => `Send ${count}`,
		aside
	}: Props = $props();

	/**
	 * Files sent at once. A small file spends most of its time waiting on the
	 * server, so more at once is faster, until the connection is full. The
	 * batch starts at six and adds one more each time the last round was
	 * faster, up to ten; a refusal for going too fast, or a request that hears
	 * nothing back, takes two away.
	 */
	const firstAtOnce = 6;
	const mostAtOnce = 10;
	const fewestAtOnce = 2;
	let strained = false;
	/** A request that hears nothing back in this time is given up, so a stuck file frees its place. */
	const requestTimeout = 60_000;
	const pieceTimeout = 180_000;
	let rows = $state<Row[]>([]);
	let nextKey = 0;
	let tab = $state<'all' | 'ready' | 'sending' | 'sent' | 'problem'>('all');
	let finding = $state(false);
	let findText = $state('');
	let linkOpen = $state(false);
	let linkText = $state('');
	let linkProblem = $state('');
	let dragDepth = $state(0);
	let dragCount = $state(0);
	let running = $state(false);
	let problem = $state('');
	let fileInput: HTMLInputElement | undefined = $state();
	let folderInput: HTMLInputElement | undefined = $state();
	let groupIdentifier = '';
	let sentBytes = $state(0);
	let startedAt = 0;
	let bytesAtStart = 0;

	const counts = $derived({
		all: rows.length + earlierHere().length,
		ready: rows.filter((row) => row.state === 'ready' || row.state === 'paused').length,
		sending: rows.filter((row) => row.state === 'sending').length,
		sent: rows.filter((row) => row.state === 'sent').length + earlierHere().filter((file) => !file.problem).length,
		problem: rows.filter((row) => row.state === 'problem').length + earlierHere().filter((file) => file.problem).length
	});
	const shown = $derived(
		rows.filter((row) => {
			if (findText && !row.name.toLocaleLowerCase('en-US').includes(findText.toLocaleLowerCase('en-US'))) return false;
			if (tab === 'ready') return row.state === 'ready' || row.state === 'paused';
			if (tab === 'sending') return row.state === 'sending';
			if (tab === 'sent') return row.state === 'sent';
			if (tab === 'problem') return row.state === 'problem';
			return true;
		})
	);
	// A file sent from this page is shown once, as its row here, even after the list from the server is read again.
	const sentHere = $derived(new Set(rows.map((row) => row.reference).filter((reference) => reference !== null)));
	const shownEarlier = $derived(
		earlier.filter((file) => {
			if (sentHere.has(file.reference)) return false;
			if (findText && !file.name.toLocaleLowerCase('en-US').includes(findText.toLocaleLowerCase('en-US'))) return false;
			if (tab === 'problem') return file.problem;
			return tab === 'all' || (tab === 'sent' && !file.problem);
		})
	);
	// What the server says about a file sent from this page, once it has read the list again.
	const earlierByReference = $derived(new Map(earlier.map((file) => [file.reference, file])));
	/** Files still waiting for the virus check, or sent but not yet in the server's list. */
	const stillChecking = $derived(
		earlier.some((file) => file.scan === 'checking') ||
			rows.some((row) => row.state === 'sent' && !row.link && row.reference !== null && !earlierByReference.has(row.reference))
	);
	$effect(() => {
		if (!refresh || !stillChecking) return;
		const timer = setInterval(() => void refresh(), 4000);
		return () => clearInterval(timer);
	});
	function earlierHere(): EarlierFile[] {
		const references = new Set(rows.map((row) => row.reference));
		return earlier.filter((file) => !references.has(file.reference));
	}
	const chosen = $derived(rows.filter((row) => row.chosen));
	const waiting = $derived(rows.filter((row) => row.state === 'ready'));
	const retryable = $derived(rows.filter((row) => row.state === 'problem' && row.retryable));
	const totalBytes = $derived(rows.reduce((sum, row) => sum + row.size, 0));
	const doneCount = $derived(rows.filter((row) => row.state === 'sent').length);
	const allShownChosen = $derived(shown.length > 0 && shown.every((row) => row.chosen || row.state === 'sending'));

	function minutesLeft(): string {
		const elapsed = (Date.now() - startedAt) / 1000;
		const moved = sentBytes - bytesAtStart;
		if (!running || elapsed < 5 || moved <= 0) return '';
		const seconds = ((totalBytes - sentBytes) / moved) * elapsed;
		if (seconds < 60) return 'less than a minute left';
		const minutes = Math.round(seconds / 60);
		return `about ${minutes} minute${minutes === 1 ? '' : 's'} left`;
	}

	function add(files: Iterable<File>) {
		const added: Row[] = [];
		for (const file of files) {
			// Folders bring their hidden files with them (.DS_Store, desktop.ini); leave those out.
			if (file.name.startsWith('.') || file.name === 'desktop.ini' || file.name === 'Thumbs.db') continue;
			added.push({
				key: nextKey++,
				file,
				link: null,
				name: file.webkitRelativePath || file.name,
				size: file.size,
				state: 'ready',
				progress: 0,
				message: '',
				retryable: true,
				chosen: false,
				reference: null
			});
		}
		rows = [...rows, ...added];
		problem = '';
		if (fileInput) fileInput.value = '';
		if (folderInput) folderInput.value = '';
	}

	function addLink() {
		if (!youtubeVideoIdentifier(linkText)) {
			linkProblem = 'That is not a link to a YouTube video.';
			return;
		}
		rows = [
			...rows,
			{
				key: nextKey++,
				file: null,
				link: linkText.trim(),
				name: linkText.trim(),
				size: 0,
				state: 'ready',
				progress: 0,
				message: '',
				retryable: true,
				chosen: false,
				reference: null
			}
		];
		linkText = '';
		linkProblem = '';
		linkOpen = false;
	}

	/** Every file in what was dropped, going into folders (File and Directory Entries API). */
	async function droppedFiles(transfer: DataTransfer): Promise<File[]> {
		const entries = [...transfer.items]
			.map((item) => (item.kind === 'file' ? item.webkitGetAsEntry?.() : null))
			.filter((entry): entry is FileSystemEntry => !!entry);
		if (entries.length === 0) return [...transfer.files];
		const files: File[] = [];
		async function walk(entry: FileSystemEntry, path: string): Promise<void> {
			if (entry.isFile) {
				const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
				files.push(path ? new File([file], file.name, { type: file.type, lastModified: file.lastModified }) : file);
				if (path) Object.defineProperty(files.at(-1)!, 'webkitRelativePath', { value: `${path}/${file.name}` });
				return;
			}
			const reader = (entry as FileSystemDirectoryEntry).createReader();
			for (;;) {
				const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
				if (batch.length === 0) break;
				for (const child of batch) await walk(child, path ? `${path}/${entry.name}` : entry.name);
			}
		}
		for (const entry of entries) await walk(entry, '');
		return files;
	}

	onMount(() => {
		const hasFiles = (event: DragEvent) => [...(event.dataTransfer?.types ?? [])].includes('Files');
		const enter = (event: DragEvent) => {
			if (!hasFiles(event)) return;
			event.preventDefault();
			dragDepth += 1;
			dragCount = event.dataTransfer?.items.length ?? 0;
		};
		const over = (event: DragEvent) => {
			if (hasFiles(event)) event.preventDefault();
		};
		const leave = (event: DragEvent) => {
			if (hasFiles(event)) dragDepth = Math.max(0, dragDepth - 1);
		};
		const drop = async (event: DragEvent) => {
			if (!hasFiles(event) || !event.dataTransfer) return;
			event.preventDefault();
			dragDepth = 0;
			add(await droppedFiles(event.dataTransfer));
		};
		window.addEventListener('dragenter', enter);
		window.addEventListener('dragover', over);
		window.addEventListener('dragleave', leave);
		window.addEventListener('drop', drop);
		const warn = (event: BeforeUnloadEvent) => {
			if (running) event.preventDefault();
		};
		window.addEventListener('beforeunload', warn);
		return () => {
			window.removeEventListener('dragenter', enter);
			window.removeEventListener('dragover', over);
			window.removeEventListener('dragleave', leave);
			window.removeEventListener('drop', drop);
			window.removeEventListener('beforeunload', warn);
		};
	});

	function iconFor(row: Row) {
		if (row.link) return Link;
		const type = row.file?.type ?? '';
		if (type.startsWith('image/')) return Image;
		if (type.startsWith('audio/')) return AudioLines;
		if (type.startsWith('video/')) return Film;
		return FileText;
	}

	const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

	async function post(address: string, body: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
		for (let attempt = 1; ; attempt++) {
			const response = await fetch(address, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(requestTimeout)
			});
			// The per-minute guard against runaway scripts: wait and carry on.
			if (response.status === 429 && attempt < 20) {
				strained = true;
				await pause(5000);
				continue;
			}
			const data = (await response.json().catch(() => ({ message: response.statusText }))) as Record<string, unknown>;
			return { ok: response.ok, status: response.status, data };
		}
	}

	/** Sends one piece, trying again twice if the connection drops or nothing comes back. */
	async function sendPiece(reference: string, number: number, piece: Blob): Promise<Response> {
		for (let attempt = 1; ; attempt++) {
			try {
				return await fetch(`/uploads/pieces/${reference}/${number}`, {
					method: 'PUT',
					body: piece,
					signal: AbortSignal.timeout(pieceTimeout)
				});
			} catch (problem) {
				if (attempt >= 3) throw problem;
				await pause(2000 * attempt);
			}
		}
	}

	function stop(row: Row, message: string, canRetry = true) {
		row.state = 'problem';
		row.message = message;
		row.retryable = canRetry;
	}

	/** Returns false when the answers were refused, which stops the whole batch. */
	async function sendLink(row: Row): Promise<boolean> {
		row.state = 'sending';
		const added = await post('/uploads/links', { link: row.link, groupIdentifier, ...extra() });
		if (added.data.errors) {
			row.state = 'ready';
			refused?.(added.data.errors as Record<string, string>);
			return false;
		}
		if (added.ok) {
			row.state = 'sent';
			row.progress = 1;
		} else stop(row, String(added.data.message ?? 'It could not be added.'), false);
		return true;
	}

	async function sendFile(row: Row): Promise<boolean> {
		const file = row.file!;
		row.state = 'sending';
		const started = await post('/uploads/pieces', {
			fileName: file.name,
			sizeBytes: file.size,
			groupIdentifier,
			...extra()
		});
		if (!started.ok) {
			if (started.data.errors) {
				row.state = 'ready';
				refused?.(started.data.errors as Record<string, string>);
				return false;
			}
			stop(row, String(started.data.message ?? 'It could not be sent.'), started.status !== 413 && started.status !== 403);
			return true;
		}
		const reference = String(started.data.reference);
		row.reference = reference;
		const size = Number(started.data.pieceBytes);
		const count = Number(started.data.pieceCount);
		const received = new Set(started.data.received as number[]);
		row.progress = received.size / count;
		for (let number = 1; number <= count; number++) {
			if (received.has(number)) continue;
			// The pause button can change the state while a piece is on its way.
			if ((row.state as RowState) === 'paused') return true;
			const piece = file.slice((number - 1) * size, Math.min(number * size, file.size));
			let response: Response;
			try {
				response = await sendPiece(reference, number, piece);
			} catch {
				stop(row, 'The connection dropped.');
				return true;
			}
			if (response.status === 422) {
				const outcome = (await response.json()) as { reason: string };
				stop(row, outcome.reason, false);
				return true;
			}
			if (!response.ok) {
				const outcome = (await response.json().catch(() => ({}))) as { message?: string };
				stop(row, outcome.message ?? 'It stopped.');
				return true;
			}
			received.add(number);
			row.progress = received.size / count;
			sentBytes += piece.size;
		}
		const done = await post(`/uploads/pieces/${reference}/finish`, {});
		if (!done.ok) {
			stop(row, String(done.data.message ?? 'It could not be finished.'));
			return true;
		}
		row.state = 'sent';
		row.progress = 1;
		return true;
	}

	async function sendAll() {
		problem = '';
		if (running) return;
		if (waiting.length === 0) {
			problem = 'Add a file first.';
			return;
		}
		if (!ready()) return;
		groupIdentifier ||= crypto.randomUUID();
		running = true;
		startedAt = Date.now();
		bytesAtStart = sentBytes;
		let stopped = false;
		const next = () => (stopped ? undefined : rows.find((row) => row.state === 'ready'));
		let atOnce = firstAtOnce;
		let active = 0;
		let roundStart = Date.now();
		let roundBytes = sentBytes;
		let roundFiles = 0;
		let lastRate = 0;
		strained = false;
		let allDone: () => void = () => {};
		const done = new Promise<void>((resolve) => (allDone = resolve));

		/** After each file: a full round at this many files sets the next round's number. */
		function adjust() {
			if (strained) {
				strained = false;
				atOnce = Math.max(fewestAtOnce, atOnce - 2);
				roundFiles = 0;
				roundStart = Date.now();
				roundBytes = sentBytes;
				return;
			}
			roundFiles += 1;
			if (roundFiles < atOnce) return;
			const seconds = Math.max((Date.now() - roundStart) / 1000, 0.001);
			// Files and bytes both count, so a round of small files and a round of large ones are each judged fairly.
			const rate = roundFiles / seconds + (sentBytes - roundBytes) / (1024 * 1024) / seconds;
			if (rate >= lastRate && atOnce < mostAtOnce) atOnce += 1;
			lastRate = rate;
			roundFiles = 0;
			roundStart = Date.now();
			roundBytes = sentBytes;
			while (active < atOnce && next()) start();
		}

		async function worker() {
			for (let row = next(); row; row = active > atOnce ? undefined : next()) {
				try {
					const carryOn = row.link ? await sendLink(row) : await sendFile(row);
					if (!carryOn) stopped = true;
				} catch {
					strained = true;
					stop(row, 'Something went wrong. Check your connection.');
				}
				adjust();
			}
		}
		function start() {
			active += 1;
			void worker().finally(() => {
				active -= 1;
				if (active === 0) allDone();
			});
		}
		try {
			for (let count = 0; count < atOnce && next(); count++) start();
			if (active === 0) allDone();
			await done;
		} finally {
			running = false;
		}
		if (!stopped && rows.length > 0 && rows.every((row) => row.state === 'sent')) finished?.(rows.length);
		else if (counts.problem > 0) tab = 'problem';
	}

	function retryProblems() {
		for (const row of retryable) {
			row.state = 'ready';
			row.message = '';
		}
		void sendAll();
	}

	function removeChosen() {
		rows = rows.filter((row) => !row.chosen || row.state === 'sending');
	}

	function chooseShown(value: boolean) {
		for (const row of shown) if (row.state !== 'sending') row.chosen = value;
	}

	const tabs = [
		{ value: 'all', label: 'All' },
		{ value: 'ready', label: 'Ready' },
		{ value: 'sending', label: 'Sending' },
		{ value: 'sent', label: 'Sent' },
		{ value: 'problem', label: 'Problems' }
	] as const;
</script>

<div class="sender" class:with-aside={!!aside}>
	<div class="main">
		<div class="strip">
			<Upload size={20} aria-hidden="true" />
			<span class="strip-text"><strong>Drop files{folders ? ' or folders' : ''} anywhere on this page</strong></span>
			<label class="button button-quiet pick">
				<Upload size={18} aria-hidden="true" /> Files
				<input bind:this={fileInput} class="visually-hidden" type="file" multiple onchange={(event) => add(event.currentTarget.files ?? [])} />
			</label>
			{#if folders}
				<label class="button button-quiet pick">
					<FolderUp size={18} aria-hidden="true" /> Folder
					<input
						bind:this={folderInput}
						class="visually-hidden"
						type="file"
						webkitdirectory
						onchange={(event) => add(event.currentTarget.files ?? [])}
					/>
				</label>
			{/if}
			{#if youtube}
				<button class="button button-quiet" type="button" aria-expanded={linkOpen} onclick={() => (linkOpen = !linkOpen)}>
					<Link size={18} aria-hidden="true" /> YouTube
				</button>
			{/if}
		</div>
		{#if linkOpen}
			<div class="field">
				<label for="youtube-link">YouTube video</label>
				{#if linkProblem}<p class="field-error">{linkProblem}</p>{/if}
				<div class="inline">
					<input
						id="youtube-link"
						type="text"
						inputmode="url"
						placeholder="https://www.youtube.com/watch?v=…"
						bind:value={linkText}
						onkeydown={(event) => {
							if (event.key === 'Enter') {
								event.preventDefault();
								addLink();
							}
						}}
					/>
					<button class="button button-quiet" type="button" onclick={addLink}>Add</button>
				</div>
			</div>
		{/if}

		{#if counts.all > 0}
			<div class="toolbar">
				<nav class="tabs" aria-label="Show">
					{#each tabs as choice (choice.value)}
						<button
							type="button"
							class:on={tab === choice.value}
							aria-pressed={tab === choice.value}
							onclick={() => (tab = choice.value)}
						>
							{choice.label} <span class="count">{counts[choice.value]}</span>
						</button>
					{/each}
				</nav>
				<span class="grow"></span>
				{#if chosen.length > 0}
					<span class="small muted">{chosen.length} chosen</span>
					<button class="icon-button" type="button" aria-label="Remove the chosen files" title="Remove the chosen files" onclick={removeChosen}>
						<Trash size={20} />
					</button>
				{/if}
				{#if finding}
					<input class="find" type="search" aria-label="Find a file" placeholder="Find a file" bind:value={findText} />
				{/if}
				<button
					class="icon-button"
					type="button"
					aria-label="Find a file"
					title="Find a file"
					aria-pressed={finding}
					onclick={() => {
						finding = !finding;
						if (!finding) findText = '';
					}}
				>
					<Search size={20} />
				</button>
			</div>

			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th class="choose">
								<input
									type="checkbox"
									aria-label="Choose every file shown"
									checked={allShownChosen}
									onchange={(event) => chooseShown(event.currentTarget.checked)}
								/>
							</th>
							<th>Name</th>
							<th class="number">Size</th>
							<th>Status</th>
							<th>Virus check</th>
							{#if filedColumn}<th>Filed as</th>{/if}
							<th><span class="visually-hidden">Actions</span></th>
						</tr>
					</thead>
					<tbody>
						{#each shown as row (row.key)}
							{@const Icon = iconFor(row)}
							<tr class:chosen={row.chosen} class:problem={row.state === 'problem'}>
								<td class="choose">
									<input type="checkbox" aria-label="Choose {row.name}" bind:checked={row.chosen} disabled={row.state === 'sending'} />
								</td>
								<td class="name"><span><Icon size={18} aria-hidden="true" /> <span class="text">{row.name}</span></span></td>
								<td class="number">{row.link ? 'Video' : readableSize(row.size)}</td>
								<td class="status" aria-live="polite">
									{#if row.state === 'sending'}
										<span class="small">Sending, {Math.floor(row.progress * 100)}%</span>
										<span class="bar" aria-hidden="true"><span style:width="{Math.floor(row.progress * 100)}%"></span></span>
									{:else if row.state === 'paused'}
										<span class="small">Paused at {Math.floor(row.progress * 100)}%</span>
									{:else if row.state === 'sent'}
										{@const after = row.reference ? earlierByReference.get(row.reference) : undefined}
										{#if after}
											<span class="state" class:done={after.done} class:bad={after.problem} class:muted={!after.done && !after.problem}>
												{#if after.done}<CircleCheck size={16} aria-hidden="true" />{:else if after.problem}<CircleAlert
														size={16}
														aria-hidden="true"
													/>{:else}<Clock size={16} aria-hidden="true" />{/if}
												{after.statusText}
											</span>
										{:else}
											<span class="state done"><CircleCheck size={16} aria-hidden="true" /> Sent</span>
										{/if}
									{:else if row.state === 'problem'}
										<span class="state bad"><CircleAlert size={16} aria-hidden="true" /> {row.message}</span>
									{:else}
										<span class="state muted">Ready</span>
									{/if}
								</td>
								<td class="scan">
									{#if row.state === 'sent' && !row.link}{@render scanBadge(
											row.reference && earlierByReference.has(row.reference) ? earlierByReference.get(row.reference)?.scan : 'checking'
										)}{/if}
								</td>
								{#if filedColumn}<td class="small filed">{row.reference ? (earlierByReference.get(row.reference)?.filedAs ?? '') : ''}</td>{/if}
								<td class="actions">
									{#if row.state === 'sending' && row.file}
										<button class="icon-button" type="button" aria-label="Pause {row.name}" title="Pause" onclick={() => (row.state = 'paused')}>
											<Pause size={18} />
										</button>
									{:else if row.state === 'paused'}
										<button
											class="icon-button"
											type="button"
											aria-label="Carry on with {row.name}"
											title="Carry on"
											onclick={() => {
												row.state = 'ready';
												void sendAll();
											}}
										>
											<Play size={18} />
										</button>
									{:else if row.state === 'problem' && row.retryable}
										<button
											class="icon-button"
											type="button"
											aria-label="Try {row.name} again"
											title="Try again"
											onclick={() => {
												row.state = 'ready';
												row.message = '';
												void sendAll();
											}}
										>
											<RefreshCw size={18} />
										</button>
									{:else if row.state !== 'sent' && row.state !== 'sending'}
										<button
											class="icon-button"
											type="button"
											aria-label="Remove {row.name}"
											title="Remove"
											onclick={() => (rows = rows.filter((other) => other !== row))}
										>
											<X size={18} />
										</button>
									{/if}
								</td>
							</tr>
						{/each}
						{#each shownEarlier as file (file.reference)}
							<tr class:problem={file.problem}>
								<td class="choose"></td>
								<td class="name"><span><FileText size={18} aria-hidden="true" /> <span class="text">{file.name}</span></span></td>
								<td class="number">{readableSize(file.sizeBytes)}</td>
								<td class="status">
									<span class="state" class:done={file.done} class:bad={file.problem} class:muted={!file.done && !file.problem}>
										{#if file.done}<CircleCheck size={16} aria-hidden="true" />{:else if file.problem}<CircleAlert
												size={16}
												aria-hidden="true"
											/>{:else}<Clock size={16} aria-hidden="true" />{/if}
										{file.statusText}
									</span>
								</td>
								<td class="scan">{@render scanBadge(file.scan)}</td>
								{#if filedColumn}<td class="small filed">{file.filedAs ?? ''}</td>{/if}
								<td class="actions"></td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		{#if problem}
			<div class="notice notice-problem" role="alert"><p>{problem}</p></div>
		{/if}

		{#if rows.length > 0}
			<div class="foot">
				<span>
					<strong>{doneCount} of {rows.length} sent</strong>
					<span class="small muted">
						· {readableSize(sentBytes) || '0 KB'} of {readableSize(totalBytes) || '0 KB'}{#if minutesLeft()}
							· {minutesLeft()}{/if}
					</span>
				</span>
				<span class="bar wide" aria-hidden="true"><span style:width="{totalBytes ? Math.floor((sentBytes / totalBytes) * 100) : 0}%"></span></span>
				<span class="grow"></span>
				{#if retryable.length > 0 && !running}
					<button class="button button-quiet" type="button" onclick={retryProblems}><RefreshCw size={18} aria-hidden="true" /> Retry problems</button>
				{/if}
				{#if !aside}
					<button class="button" type="button" disabled={running || waiting.length === 0} onclick={sendAll}>
						<Upload size={18} aria-hidden="true" />
						{running ? 'Sending…' : waiting.length > 0 ? sendLabel(waiting.length) : 'Send'}
					</button>
				{/if}
			</div>
		{/if}
	</div>

	{#if aside}
		<aside class="panel">
			{@render aside({ sending: running })}
			<button class="button send-beside" type="button" disabled={running || waiting.length === 0} onclick={sendAll}>
				<Upload size={18} aria-hidden="true" />
				{running ? 'Sending…' : waiting.length > 0 ? sendLabel(waiting.length) : 'Send'}
			</button>
		</aside>
	{/if}
</div>

{#snippet scanBadge(scan: EarlierFile['scan'])}
	{#if scan === 'clean'}
		<span class="badge clean"><ShieldCheck size={14} aria-hidden="true" /> Clean</span>
	{:else if scan === 'flagged'}
		<span class="badge flagged"><ShieldX size={14} aria-hidden="true" /> Flagged</span>
	{:else if scan === 'checking'}
		<span class="badge checking"><ShieldEllipsis size={14} aria-hidden="true" /> Checking</span>
	{/if}
{/snippet}

{#if dragDepth > 0}
	<div class="drop-over" aria-hidden="true">
		<div class="drop-card">
			<Upload size={44} />
			<p>{dragCount > 1 ? `Drop to add ${dragCount} items` : 'Drop to add'}</p>
		</div>
	</div>
{/if}

<style>
	.sender {
		min-width: 0;
	}
	.strip .button,
	.foot .button,
	.send-beside {
		gap: var(--space-2);
	}
	.sender.with-aside {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 22rem;
		gap: var(--space-5);
		align-items: start;
	}
	@media (max-width: 60rem) {
		.sender.with-aside {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.main {
		min-width: 0;
	}
	.strip {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
		border: 2px dashed var(--color-control-border);
		border-radius: var(--radius-panel);
		padding: var(--space-3) var(--space-4);
		background: var(--color-surface);
		margin-bottom: var(--space-4);
	}
	.strip-text {
		flex: 1;
		min-width: 12rem;
	}
	.pick {
		cursor: pointer;
	}
	.pick:focus-within {
		outline: 3px solid var(--color-focus-ring);
		outline-offset: 2px;
	}
	.inline {
		display: flex;
		gap: var(--space-2);
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}
	.grow {
		flex: 1;
	}
	.tabs {
		display: flex;
		flex-wrap: wrap;
		border-bottom: 1px solid var(--color-line);
	}
	.tabs button {
		font: inherit;
		font-weight: var(--font-weight-semibold);
		color: var(--color-ink-muted);
		background: transparent;
		border: 0;
		border-bottom: 3px solid transparent;
		padding: var(--space-2) var(--space-3);
		cursor: pointer;
		min-height: 44px;
	}
	.tabs button.on {
		color: var(--color-ink);
		border-bottom-color: var(--color-action);
	}
	.tabs .count {
		font-weight: normal;
	}
	.find {
		width: 14rem;
	}
	.table-wrap {
		overflow-x: auto;
	}
	td {
		vertical-align: middle;
	}
	.choose {
		width: 2.5rem;
	}
	.choose input {
		width: 20px;
		height: 20px;
	}
	th {
		white-space: nowrap;
	}
	.name {
		min-width: 14rem;
	}
	.name > span {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		min-width: 0;
	}
	.name :global(svg) {
		color: var(--color-link);
		flex: none;
	}
	.name .text {
		overflow-wrap: anywhere;
	}
	.number {
		text-align: right;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.status {
		min-width: 11rem;
	}
	.state {
		display: inline-flex;
		gap: 6px;
		align-items: center;
		font-weight: var(--font-weight-semibold);
	}
	.state.done {
		color: var(--color-link);
	}
	.state.bad {
		color: var(--color-danger);
	}
	.state.muted {
		color: var(--color-ink-muted);
	}
	.filed {
		overflow-wrap: anywhere;
	}
	.scan {
		white-space: nowrap;
	}
	.badge {
		display: inline-flex;
		gap: 4px;
		align-items: center;
		border-radius: 999px;
		padding: 1px var(--space-2);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		border: 1px solid currentColor;
	}
	.badge.clean {
		color: var(--color-link);
	}
	.badge.flagged {
		color: var(--color-danger);
	}
	.badge.checking {
		color: var(--color-ink-muted);
	}
	tr.chosen {
		background: color-mix(in srgb, var(--color-link) 10%, transparent);
	}
	tr.problem {
		background: color-mix(in srgb, var(--color-danger) 7%, transparent);
	}
	.actions {
		text-align: right;
		white-space: nowrap;
	}
	.bar {
		display: block;
		height: 6px;
		width: 10rem;
		max-width: 100%;
		border-radius: 3px;
		background: var(--color-line);
		margin-top: 4px;
	}
	.bar.wide {
		width: 14rem;
		margin: 0;
	}
	.bar > span {
		display: block;
		height: 100%;
		border-radius: 3px;
		background: var(--color-link);
	}
	.foot {
		position: sticky;
		bottom: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
		background: var(--color-surface-raised, var(--color-paper));
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		padding: var(--space-3) var(--space-4);
		margin-top: var(--space-4);
		z-index: 2;
	}
	.panel {
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		padding: var(--space-4);
		background: var(--color-surface-raised, var(--color-paper));
	}
	.send-beside {
		width: 100%;
		justify-content: center;
		margin-top: var(--space-3);
	}
	.drop-over {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: grid;
		place-items: center;
		background: color-mix(in srgb, var(--color-link) 22%, transparent);
		outline: 4px dashed var(--color-link);
		outline-offset: -14px;
		pointer-events: none;
	}
	.drop-card {
		background: var(--color-paper);
		color: var(--color-ink);
		border-radius: var(--radius-panel);
		padding: var(--space-5) var(--space-6, 2.5rem);
		text-align: center;
	}
	.drop-card :global(svg) {
		color: var(--color-link);
	}
	.drop-card p {
		font-size: 1.375rem;
		font-weight: var(--font-weight-bold, 700);
		margin: var(--space-2) 0 0;
	}
	@media (max-width: 40rem) {
		thead {
			display: none;
		}
		tr {
			display: grid;
			grid-template-columns: auto minmax(0, 1fr) auto;
			gap: 0 var(--space-2);
			border-bottom: 1px solid var(--color-line);
			padding: var(--space-2) 0;
		}
		td {
			border: 0;
			padding: 2px 0;
		}
		td.choose {
			grid-row: span 4;
		}
		td.name {
			grid-column: 2;
		}
		td.actions {
			grid-column: 3;
			grid-row: 1 / span 4;
		}
		td.number,
		td.status,
		td.scan,
		td.filed {
			grid-column: 2;
			text-align: left;
		}
		.bar.wide {
			flex: 1;
		}
	}
</style>
