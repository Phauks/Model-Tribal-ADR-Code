<script lang="ts">
	// The fields of a room of its own in the workspace (src/routes/workspace/rooms/room-form.ts).
	import { eventTimeZones } from '#lib/event-calendar.ts';
	import {
		longestRoomHours,
		recordingWatcherLabels,
		roomRecordingWatchers,
		roomStyleLabels,
		roomStyles,
		roomVisibilities,
		roomVisibilityLabels
	} from '#lib/video-rooms.ts';
	import type { RoomFormValues } from './room-form.ts';

	let { values, invalid, problem }: { values: RoomFormValues; invalid?: string; problem?: string } = $props();

	const bad = (name: string) => (invalid === name ? 'true' : undefined);
</script>

{#snippet error(name: string)}
	{#if invalid === name && problem}<p class="field-error" id="{name}-error">{problem}</p>{/if}
{/snippet}

<div class="field">
	<label for="title">Name</label>
	{@render error('title')}
	<input type="text" id="title" name="title" maxlength="200" required value={values.title} aria-invalid={bad('title')} />
</div>

<fieldset class="group">
	<legend>Who may join</legend>
	{@render error('visibility')}
	{#each roomVisibilities as visibility (visibility)}
		<div class="choice">
			<input type="radio" id="visibility-{visibility}" name="visibility" value={visibility} checked={values.visibility === visibility} />
			<label for="visibility-{visibility}">{roomVisibilityLabels[visibility]}</label>
		</div>
	{/each}
	<p class="hint">Either way, you can send invite links, including to people without an account.</p>
</fieldset>

<fieldset class="group">
	<legend>How the room works</legend>
	{@render error('style')}
	{#each roomStyles as style (style)}
		<div class="choice">
			<input type="radio" id="style-{style}" name="style" value={style} checked={values.style === style} />
			<label for="style-{style}">{roomStyleLabels[style]}</label>
		</div>
	{/each}
</fieldset>

<fieldset class="group">
	<legend>Who may watch recordings</legend>
	<p class="hint">Hosts start and stop recording in the call. Everyone is told before they join that the room may be recorded.</p>
	{@render error('watchers')}
	{#each roomRecordingWatchers as watchers (watchers)}
		<div class="choice">
			<input type="radio" id="watchers-{watchers}" name="watchers" value={watchers} checked={values.watchers === watchers} />
			<label for="watchers-{watchers}">{recordingWatcherLabels[watchers]}</label>
		</div>
	{/each}
</fieldset>

<fieldset class="group">
	<legend>When</legend>
	<div class="field">
		<label for="time-zone">Time zone</label>
		{@render error('timeZone')}
		<select id="time-zone" name="time-zone" aria-invalid={bad('timeZone')}>
			{#each eventTimeZones as entry (entry.zone)}
				<option value={entry.zone} selected={values.timeZone === entry.zone}>{entry.label}</option>
			{/each}
		</select>
	</div>
	{@render error('startDate')}
	<div class="pair">
		<div class="field">
			<label for="start-date">Starts on</label>
			<input type="date" id="start-date" name="start-date" required value={values.startDate} aria-invalid={bad('startDate')} />
		</div>
		<div class="field">
			<label for="start-time">at</label>
			<input type="time" id="start-time" name="start-time" required value={values.startTime} aria-invalid={bad('startDate')} />
		</div>
	</div>
	<div class="field">
		<label for="hours">Stays open for this many hours</label>
		<p class="hint" id="hours-hint">Guests may come in 30 minutes before it starts. Nobody can join once it closes.</p>
		{@render error('hours')}
		<input type="number" id="hours" name="hours" min="1" max={longestRoomHours} step="1" required value={values.hours} class="short" aria-describedby="hours-hint" aria-invalid={bad('hours')} />
	</div>
</fieldset>

<style>
	.group {
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		padding: var(--space-3) var(--space-4);
		margin: 0 0 var(--space-5);
		max-width: var(--layout-measure);
	}

	.pair {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
	}

	.pair .field {
		margin-bottom: var(--space-3);
	}

	.choice {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}

	.choice input {
		margin-top: 0.3em;
	}

	input[type='date'],
	input[type='time'],
	input[type='number'] {
		display: block;
		box-sizing: border-box;
		font: inherit;
		min-height: var(--layout-target-minimum);
		padding: var(--space-2);
		border: 2px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink);
	}

	input[aria-invalid='true'] {
		border-color: var(--color-danger);
	}
</style>
