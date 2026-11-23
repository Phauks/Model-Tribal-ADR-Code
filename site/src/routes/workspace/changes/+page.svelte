<script lang="ts">
	import { dateTime } from '#lib/change-dates.ts';
	import { hideReasons, isHideReason } from '#lib/page-history.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	function parts(hidden: (typeof data.hidden)[number]): string {
		return [hidden.hideText && 'text', hidden.hideSummary && 'summary', hidden.hidePerson && 'name'].filter(Boolean).join(', ');
	}
</script>

<svelte:head>
	<title>Hidden changes · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<h1>Hidden changes</h1>
<p>
	Changes in Recent changes with a part hidden, the way a wiki hides a revision: the text of a version, its summary, or
	who made it. A hidden change stays in the list with a line through what is hidden. To hide part of another change,
	open it from <a href="/changes">Recent changes</a> and choose “Hide part of this change”. Each hiding is recorded in the
	<a href="/workspace/activity">activity log</a>.
</p>
<p class="small muted">
	An essay publication held back from the essay’s page in the workspace is hidden from Recent changes too, and is not
	listed here.
</p>

{#if data.hidden.length === 0}
	<p>Nothing is hidden.</p>
{:else}
	<div class="table-scroll">
		<table>
			<thead>
				<tr><th scope="col">Change</th><th scope="col">Hidden</th><th scope="col">Reason readers see</th><th scope="col">By</th><th scope="col">When</th></tr>
			</thead>
			<tbody>
				{#each data.hidden as hidden (hidden.id)}
					<tr>
						<td><a href="/workspace/changes/{hidden.id}">{hidden.id}</a></td>
						<td>{parts(hidden)}</td>
						<td>{isHideReason(hidden.reason) ? hideReasons[hidden.reason] : hidden.reason}</td>
						<td>{hidden.hiddenBy ?? ''}</td>
						<td>{dateTime(hidden.hiddenAt)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
