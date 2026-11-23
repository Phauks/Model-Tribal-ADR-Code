<script lang="ts">
	// The site's one time field (DESIGN.md, section 6, "Date fields"). A reader types the time any common way ("8", "8am", "8:30 pm", "20:30", "noon"); leaving the box writes it back as "8:30 PM". The form sends "20:30" from a hidden field under `name`, the value a browser's own time box sends, so server code does not change. Without scripts the field is the browser's own time box.
	import { onMount } from 'svelte';
	import { readTypedTime, spokenTime } from '#lib/date-entry.ts';

	let {
		id,
		name,
		value = $bindable(''),
		required = false,
		describedby,
		invalid = false,
		label,
		onchange
	}: {
		id: string;
		/** The name the form sends "HH:MM" under. Leave it out when another component sends the value. */
		name?: string;
		/** "HH:MM" on a 24-hour clock, or empty. */
		value?: string;
		required?: boolean;
		describedby?: string;
		invalid?: boolean;
		/** A name for screen readers when no visible label points at the field, such as "Time". */
		label?: string;
		onchange?: (value: string) => void;
	} = $props();

	const ownIdentifier = $props.id();
	const problemId = `${ownIdentifier}-problem`;
	let ready = $state(false);
	let text = $state(value ? spokenTime(value) : '');
	let problem = $state('');
	let lastValue = value;
	let box: HTMLInputElement | undefined = $state();

	function setValue(next: string): void {
		if (next === value) return;
		value = next;
		lastValue = next;
		onchange?.(next);
	}

	function read(): void {
		const typed = text.trim();
		const time = typed ? readTypedTime(typed) : '';
		problem = time === null ? 'Enter a time like 8:30 AM' : '';
		setValue(time ?? '');
		box?.setCustomValidity(problem);
	}

	$effect(() => {
		if (value !== lastValue) {
			lastValue = value;
			text = value ? spokenTime(value) : '';
			problem = '';
			box?.setCustomValidity('');
		}
	});

	function leave(): void {
		read();
		if (value) text = displayTime(value);
	}

	/** "8:00 AM" in the box; "noon" and "midnight" are written as times there, so the box always shows a clock time. */
	function displayTime(time: string): string {
		const [hour, minute] = time.split(':').map(Number);
		return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
	}

	onMount(() => {
		ready = true;
		if (value) text = displayTime(value);
	});
</script>

<div class="time-field">
	{#if ready}
		<input
			bind:this={box}
			{id}
			type="text"
			autocomplete="off"
			spellcheck="false"
			bind:value={text}
			oninput={() => problem && read()}
			onblur={leave}
			{required}
			aria-label={label}
			aria-describedby={[describedby, problem ? problemId : ''].filter(Boolean).join(' ') || undefined}
			aria-invalid={invalid || problem ? 'true' : undefined}
		/>
		{#if name}<input type="hidden" {name} {value} />{/if}
		{#if problem}<p class="time-problem" id={problemId}>{problem}</p>{/if}
	{:else}
		<input {id} {name} type="time" {value} {required} aria-label={label} aria-describedby={describedby} aria-invalid={invalid ? 'true' : undefined} />
	{/if}
</div>

<style>
	.time-field {
		max-width: 9.5rem;
	}

	.time-problem {
		margin: var(--space-1) 0 0;
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		color: var(--color-danger);
	}
</style>
