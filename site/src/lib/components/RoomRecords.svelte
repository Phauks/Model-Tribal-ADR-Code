<script lang="ts">
	/**
	 * A room's recordings, with the buttons to hide or show each, and the log
	 * of who was let in and what each was told about recording. For the hosts,
	 * in the workspace. The page's form actions are hideRecording and
	 * showRecording.
	 */
	interface Props {
		recordings: { identifier: string; when: string; length: string; status: string; address: string | null; hidden: boolean }[];
		visitors: { name: string; role: string; how: string; told: string; toldAt: string }[];
		/** The heading level of the two sections. */
		level?: 2 | 3;
	}

	let { recordings, visitors, level = 3 }: Props = $props();
</script>

<svelte:element this={`h${level}`}>Recordings</svelte:element>
{#if recordings.length === 0}
	<p class="muted">No recordings yet. A recording is copied into the project’s private storage within about 15 minutes of ending, then checked for viruses before anyone can watch it.</p>
{:else}
	<div class="table-scroll">
		<table>
			<thead>
				<tr><th scope="col">Started</th><th scope="col">Length</th><th scope="col">Status</th><th scope="col">Shown</th></tr>
			</thead>
			<tbody>
				{#each recordings as recording (recording.identifier)}
					<tr>
						<td>{#if recording.address}<a href={recording.address}>{recording.when || 'Recording'}</a>{:else}{recording.when}{/if}</td>
						<td>{recording.length}</td>
						<td>{recording.status}</td>
						<td>
							<form method="post" action={recording.hidden ? '?/showRecording' : '?/hideRecording'}>
								<input type="hidden" name="recording" value={recording.identifier} />
								<button class="button button-quiet" type="submit">{recording.hidden ? 'Show it' : 'Hide it'}</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
<svelte:element this={`h${level}`}>Who was told about recording</svelte:element>
{#if visitors.length === 0}
	<p class="muted">Nobody has joined the room yet.</p>
{:else}
	<p class="hint">Each person, and what they were told the last time they joined.</p>
	<div class="table-scroll">
		<table>
			<thead>
				<tr><th scope="col">Name</th><th scope="col">Joined as</th><th scope="col">How</th><th scope="col">Told</th><th scope="col">When</th></tr>
			</thead>
			<tbody>
				{#each visitors as visitor, index (index)}
					<tr><td>{visitor.name}</td><td>{visitor.role}</td><td>{visitor.how}</td><td>{visitor.told}</td><td>{visitor.toldAt}</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
