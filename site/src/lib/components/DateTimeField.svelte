<script lang="ts">
	// A date and a time together, for Remind me, Send later and similar (DESIGN.md, section 6, "Date fields"): the shared date field beside the shared time field, with one line under them that reads both back ("Monday, Nov. 30, 2026, at 8:00 AM"). The form sends "2026-11-30T08:00" under `name`, the value a browser's own date-and-time box sends, so server code does not change. Picking a date when no time is set fills in `defaultTime`. Without scripts the field is the browser's own date-and-time box.
	import { onMount } from 'svelte';
	import DateField from './DateField.svelte';
	import TimeField from './TimeField.svelte';
	import { spokenTime } from '#lib/date-entry.ts';

	let {
		id,
		name,
		value = $bindable(''),
		min,
		required = false,
		describedby,
		defaultTime = '09:00',
		hint
	}: {
		/** The id the label points at; it goes on the date box. The time box takes `<id>-time`. */
		id: string;
		name?: string;
		/** "2026-11-30T08:00", or empty. */
		value?: string;
		/** The earliest day a reader may pick, as an ISO day. */
		min?: string;
		required?: boolean;
		describedby?: string;
		/** The time a newly picked date gets when none is set. */
		defaultTime?: string;
		hint?: string;
	} = $props();

	let ready = $state(false);
	let day = $state(value.slice(0, 10));
	let time = $state(value.slice(11, 16));
	let lastValue = value;

	// When the page sets the value (a quick choice such as "Tomorrow 8 AM"), both boxes follow.
	$effect(() => {
		if (value !== lastValue) {
			lastValue = value;
			day = value.slice(0, 10);
			time = value.slice(11, 16);
		}
	});

	function combine(): void {
		if (day && !time) time = defaultTime;
		const next = day && time ? `${day}T${time}` : '';
		lastValue = next;
		value = next;
	}

	onMount(() => (ready = true));
</script>

{#if ready}
	<div class="date-time">
		<DateField {id} bind:value={day} {min} {required} {describedby} {hint} timeText={time ? spokenTime(time) : undefined} onchange={combine} />
		<TimeField id="{id}-time" bind:value={time} label="Time" {required} onchange={combine} />
	</div>
	{#if name}<input type="hidden" {name} {value} />{/if}
{:else}
	<input {id} {name} type="datetime-local" {value} min={min ? `${min}T00:00` : undefined} {required} aria-describedby={describedby} />
{/if}

<style>
	.date-time {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: flex-start;
	}

	.date-time :global(.date-field) {
		width: 12rem;
	}

	/* The date's hint sits above both boxes. */
	.date-time :global(.date-example) {
		flex-basis: 100%;
		margin-bottom: 0;
	}

	/* Both boxes line up; the time box needs no read-back line of its own. */
	.date-time :global(.time-field) {
		width: 8.5rem;
	}
</style>
