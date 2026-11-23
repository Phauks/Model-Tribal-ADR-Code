<script lang="ts">
	// The site's one date field (DESIGN.md, section 6, "Date fields"; Trevor asked for one shared field on Nov. 23, 2026). A reader types the date any common way ("dec 1", "12/1", "tomorrow", "Friday") or opens a calendar with the button inside the box. The line under the box says the date in words ("Tuesday, Dec. 1, 2026"), so a reader who meant 3/4 as the 3rd of April sees the mistake. The form sends an ISO day, "2026-12-01", from a hidden field under `name`, the same value a browser's own date box sends, so server code does not change.
	//
	// The calendar follows the WAI-ARIA Authoring Practices "Date Picker Dialog" example: a dialog holding a grid of days, where arrow keys move a day or a week, Page Up and Page Down a month (with Shift, a year), Home and End the start and end of the week, Enter or Space picks the day, and Escape closes the dialog and returns focus to the button. Days outside `min` and `max` are struck through and cannot be picked. On a phone the calendar rises from the bottom of the screen.
	//
	// Without scripts the field is the browser's own date box, with the same id, name, value, min, max and required.
	import { onMount, tick } from 'svelte';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import {
		addDays,
		addMonths,
		boxDate,
		calendarDay,
		localToday,
		monthNames,
		monthWeeks,
		readTypedDate,
		spokenDate,
		weekday,
		weekdayNames
	} from '#lib/date-entry.ts';

	let {
		id,
		name,
		value = $bindable(''),
		min,
		max,
		required = false,
		describedby,
		invalid = false,
		hint = 'For example, Dec. 1, 2026, or 12/1/2026',
		timeText,
		size = 'medium',
		onchange
	}: {
		/** The id the field's label points at. */
		id: string;
		/** The name the form sends the ISO day under. Leave it out when another component sends the value. */
		name?: string;
		/** The ISO day, "2026-12-01", or empty. */
		value?: string;
		/** The earliest and latest days a reader may pick, as ISO days. */
		min?: string;
		max?: string;
		required?: boolean;
		/** Ids of hints or errors outside the field that describe it. */
		describedby?: string;
		/** True when the server said the value is wrong; the box turns the danger color. */
		invalid?: boolean;
		/** Placeholder-free example the field reads to screen readers and shows when empty. Empty text hides it. */
		hint?: string;
		/** A time to add to the line under the box, such as "8:00 AM", for a date-and-time field. */
		timeText?: string;
		/** "medium" fits a date written out; "full" fills its column (a phone layout or a narrow card). */
		size?: 'medium' | 'full';
		onchange?: (value: string) => void;
	} = $props();

	const ownIdentifier = $props.id();
	const exampleId = `${ownIdentifier}-example`;
	const readBackId = `${ownIdentifier}-read-back`;
	const gridLabelId = `${ownIdentifier}-month`;

	let ready = $state(false);
	let today = $state(localToday());
	let text = $state(value ? boxDate(value) : '');
	let problem = $state('');
	let touched = $state(false);
	let lastValue = value;
	let announcement = $state('');

	let box: HTMLInputElement | undefined = $state();
	let dialog: HTMLDialogElement | undefined = $state();
	let open = $state(false);
	let focusedDay = $state(localToday());
	const shown = $derived(calendarDay(focusedDay)!);
	const weeks = $derived(monthWeeks(shown.year, shown.month));

	const firstYear = $derived(calendarDay(min ?? '')?.year ?? calendarDay(today)!.year - 100);
	const lastYear = $derived(calendarDay(max ?? '')?.year ?? calendarDay(today)!.year + 10);
	const years = $derived(
		Array.from({ length: Math.max(lastYear, shown.year) - Math.min(firstYear, shown.year) + 1 }, (_, index) => Math.min(firstYear, shown.year) + index)
	);

	const inRange = (day: string) => (!min || day >= min) && (!max || day <= max);

	function rangeProblem(day: string): string {
		if (min && day < min) return `Enter a date on or after ${boxDate(min)}`;
		if (max && day > max) return `Enter a date on or before ${boxDate(max)}`;
		return '';
	}

	/** Reads what is in the box. Sets the value when it is a date in range, and says what is wrong when it is not. */
	function read(): void {
		const typed = text.trim();
		if (!typed) {
			problem = required ? 'Enter a date' : '';
			setValue('');
		} else {
			const day = readTypedDate(typed, today);
			if (!day) {
				problem = 'Enter a date like Dec. 1, 2026';
				setValue('');
			} else {
				problem = rangeProblem(day);
				setValue(problem ? '' : day);
				if (!problem) focusedDay = day;
			}
		}
		box?.setCustomValidity(problem && (typed || touched) ? problem : '');
	}

	function setValue(next: string): void {
		if (next === value) return;
		value = next;
		lastValue = next;
		onchange?.(next);
	}

	// When the page sets the value (a quick choice such as "Tomorrow"), the box follows.
	$effect(() => {
		if (value !== lastValue) {
			lastValue = value;
			text = value ? boxDate(value) : '';
			problem = '';
			box?.setCustomValidity('');
			if (value) focusedDay = value;
		}
	});

	// What the line under the box says while the reader types: the date in words, or nothing until they leave the box.
	const typedDay = $derived(text.trim() ? readTypedDate(text, today) : null);
	const readBack = $derived(typedDay && inRange(typedDay) ? spokenDate(typedDay) + (timeText ? `, at ${timeText}` : '') : '');

	function leave(): void {
		touched = true;
		read();
		if (value) text = boxDate(value);
		announcement = problem || (value ? spokenDate(value) : '');
	}

	async function openCalendar(): Promise<void> {
		today = localToday();
		const start = value || readTypedDate(text, today) || (inRange(today) ? today : (min ?? max ?? today));
		focusedDay = start;
		place();
		dialog?.showModal();
		open = true;
		await tick();
		focusDay();
	}

	function closeCalendar(): void {
		dialog?.close();
	}

	function place(): void {
		if (!dialog || !box) return;
		const rect = box.getBoundingClientRect();
		const width = Math.min(21 * 16, window.innerWidth - 16);
		const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
		dialog.style.setProperty('--calendar-top', `${Math.round(rect.bottom + 6)}px`);
		dialog.style.setProperty('--calendar-left', `${Math.round(left)}px`);
	}

	function focusDay(): void {
		dialog?.querySelector<HTMLButtonElement>(`button[data-day="${focusedDay}"]`)?.focus();
	}

	function pick(day: string): void {
		if (!inRange(day)) return;
		text = boxDate(day);
		problem = '';
		box?.setCustomValidity('');
		setValue(day);
		announcement = spokenDate(day);
		closeCalendar();
	}

	function clear(): void {
		text = '';
		problem = '';
		box?.setCustomValidity(required ? 'Enter a date' : '');
		setValue('');
		announcement = 'Date cleared';
		closeCalendar();
	}

	async function moveTo(day: string): Promise<void> {
		focusedDay = day;
		await tick();
		focusDay();
	}

	function onGridKey(event: KeyboardEvent): void {
		const moves: Record<string, () => string> = {
			ArrowLeft: () => addDays(focusedDay, -1),
			ArrowRight: () => addDays(focusedDay, 1),
			ArrowUp: () => addDays(focusedDay, -7),
			ArrowDown: () => addDays(focusedDay, 7),
			PageUp: () => addMonths(focusedDay, event.shiftKey ? -12 : -1),
			PageDown: () => addMonths(focusedDay, event.shiftKey ? 12 : 1),
			Home: () => addDays(focusedDay, -weekday(focusedDay)),
			End: () => addDays(focusedDay, 6 - weekday(focusedDay))
		};
		const move = moves[event.key];
		if (!move) return;
		event.preventDefault();
		moveTo(move());
	}

	function showMonth(year: number, month: number): void {
		const day = Math.min(calendarDay(focusedDay)!.day, new Date(Date.UTC(year, month, 0)).getUTCDate());
		focusedDay = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	}

	function fullDayName(day: string): string {
		const parts = calendarDay(day)!;
		return `${weekdayNames[weekday(day)]}, ${monthNames[parts.month - 1]} ${parts.day}, ${parts.year}`;
	}

	onMount(() => {
		ready = true;
		read();
		const reposition = () => open && place();
		window.addEventListener('resize', reposition);
		window.addEventListener('scroll', reposition, true);
		return () => {
			window.removeEventListener('resize', reposition);
			window.removeEventListener('scroll', reposition, true);
		};
	});

	const describedBy = $derived([describedby, hint ? exampleId : '', readBackId].filter(Boolean).join(' ') || undefined);
</script>

{#if hint}<p class="hint date-example" id={exampleId}>{hint}</p>{/if}
<div class="date-field" class:full={size === 'full'}>
	{#if ready}
		<div class="date-box">
			<input
				bind:this={box}
				{id}
				type="text"
				autocomplete="off"
				spellcheck="false"
				bind:value={text}
				oninput={() => problem && read()}
				onblur={leave}
				onkeydown={(event) => {
					if (event.key === 'ArrowDown' && event.altKey) {
						event.preventDefault();
						openCalendar();
					}
				}}
				{required}
				aria-describedby={describedBy}
				aria-invalid={invalid || (touched && !!problem) ? 'true' : undefined}
			/>
			<button
				type="button"
				class="calendar-button"
				aria-label={value ? `Change the date, ${spokenDate(value)}` : 'Choose a date'}
				title="Choose a date"
				aria-haspopup="dialog"
				aria-expanded={open}
				onclick={openCalendar}
			>
				<CalendarIcon size={20} strokeWidth={1.75} aria-hidden="true" />
			</button>
		</div>
		{#if name}<input type="hidden" {name} {value} />{/if}
	{:else}
		<input {id} {name} type="date" {value} {min} {max} {required} aria-describedby={describedby} aria-invalid={invalid ? 'true' : undefined} />
	{/if}
	<p class="read-back" id={readBackId}>
		{#if touched && problem}
			<span class="date-problem">{problem}</span>
		{:else if readBack}
			<Check size={16} aria-hidden="true" /><span>{readBack}</span>
		{/if}
	</p>
	<span class="visually-hidden" aria-live="polite">{announcement}</span>
</div>

{#if ready}
	<dialog
		bind:this={dialog}
		class="calendar"
		aria-modal="true"
		aria-label="Choose a date"
		onclose={() => (open = false)}
		onclick={(event) => event.target === dialog && closeCalendar()}
	>
		<div class="calendar-inner">
			<div class="calendar-title">
				<span>Choose a date</span>
				<button type="button" class="icon-button" aria-label="Close" title="Close" onclick={closeCalendar}><X size={20} aria-hidden="true" /></button>
			</div>
			<div class="calendar-head">
				<button type="button" class="icon-button" aria-label="Previous month" title="Previous month" onclick={() => (focusedDay = addMonths(focusedDay, -1))}>
					<ChevronLeft size={20} aria-hidden="true" />
				</button>
				<span class="month-choice">
					<select aria-label="Month" value={shown.month} onchange={(event) => showMonth(shown.year, Number(event.currentTarget.value))}>
						{#each monthNames as month, index (month)}<option value={index + 1}>{month}</option>{/each}
					</select>
					<select aria-label="Year" value={shown.year} onchange={(event) => showMonth(Number(event.currentTarget.value), shown.month)}>
						{#each years as year (year)}<option value={year}>{year}</option>{/each}
					</select>
				</span>
				<button type="button" class="icon-button" aria-label="Next month" title="Next month" onclick={() => (focusedDay = addMonths(focusedDay, 1))}>
					<ChevronRight size={20} aria-hidden="true" />
				</button>
			</div>
			<div class="visually-hidden" id={gridLabelId} aria-live="polite">{monthNames[shown.month - 1]} {shown.year}</div>
			<table role="grid" aria-labelledby={gridLabelId} onkeydown={onGridKey}>
				<thead>
					<tr>
						{#each weekdayNames as name (name)}<th scope="col" abbr={name}>{name.slice(0, 2)}</th>{/each}
					</tr>
				</thead>
				<tbody>
					{#each weeks as week (week[0])}
						<tr>
							{#each week as day (day)}
								{@const outside = calendarDay(day)!.month !== shown.month}
								{@const allowed = inRange(day)}
								<td role="gridcell" aria-selected={day === value ? 'true' : undefined}>
									<button
										type="button"
										class="day"
										class:outside
										class:blocked={!allowed}
										class:today={day === today}
										class:chosen={day === value}
										data-day={day}
										tabindex={day === focusedDay ? 0 : -1}
										aria-label={fullDayName(day) + (day === today ? ', today' : '') + (allowed ? '' : ', not available')}
										aria-current={day === today ? 'date' : undefined}
										aria-disabled={allowed ? undefined : 'true'}
										onclick={() => pick(day)}
									>
										{calendarDay(day)!.day}
									</button>
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
			<p class="calendar-keys">Arrow keys move a day or a week. Page Up and Page Down move a month.</p>
			<div class="calendar-foot">
				<button type="button" class="button button-quiet" disabled={!inRange(today)} onclick={() => pick(today)}>Today</button>
				<button type="button" class="button button-quiet" onclick={clear}>Clear</button>
				<button type="button" class="button button-quiet close-button" onclick={closeCalendar}>Close</button>
			</div>
		</div>
	</dialog>
{/if}

<style>
	.date-example {
		margin-bottom: var(--space-2);
	}

	.date-field {
		max-width: 17rem;
	}

	.date-field.full {
		max-width: none;
	}

	.date-box {
		position: relative;
	}

	.date-box input {
		padding-inline-end: calc(var(--layout-target-minimum) + var(--space-1));
	}

	.calendar-button {
		position: absolute;
		inset-block: 2px;
		inset-inline-end: 2px;
		display: inline-grid;
		place-items: center;
		min-width: var(--layout-target-minimum);
		padding: 0;
		border: none;
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--color-ink-muted);
		cursor: pointer;
	}

	.calendar-button:hover,
	.calendar-button[aria-expanded='true'] {
		color: var(--color-ink);
		background: color-mix(in srgb, currentColor 14%, transparent);
	}

	.read-back {
		display: flex;
		gap: var(--space-1);
		align-items: center;
		min-height: 1.5em;
		margin: var(--space-1) 0 0;
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		color: var(--color-ink);
	}

	.date-problem {
		color: var(--color-danger);
	}

	/* The calendar. It sits in the top layer, so it sets its own colors. */
	.calendar {
		position: fixed;
		inset: var(--calendar-top, 10vh) auto auto var(--calendar-left, 50%);
		width: min(21rem, calc(100vw - 1rem));
		max-height: calc(100vh - var(--calendar-top, 10vh) - var(--space-2));
		margin: 0;
		padding: var(--space-3);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
		color: var(--color-ink);
		box-shadow: 0 var(--space-2) var(--space-5) color-mix(in srgb, var(--color-ink) 18%, transparent);
		overflow: auto;
	}

	.calendar::backdrop {
		background: transparent;
	}

	.calendar[open] {
		transition: opacity var(--motion-duration-short) var(--motion-easing-enter);

		@starting-style {
			opacity: 0;
		}
	}

	.calendar-title {
		display: none;
	}

	.calendar-head {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		margin-bottom: var(--space-2);
	}

	.month-choice {
		display: flex;
		flex: 1;
		gap: var(--space-1);
		justify-content: center;
	}

	.month-choice select {
		font-weight: var(--font-weight-semibold);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		margin: 0;
	}

	th {
		padding: 0 0 var(--space-1);
		border: 0;
		background: transparent;
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
		text-align: center;
	}

	td {
		padding: 1px;
		border: 0;
		text-align: center;
	}

	.day {
		position: relative;
		width: 100%;
		min-width: 2.5rem;
		min-height: 2.5rem;
		padding: 0;
		border: 0;
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
	}

	.day:hover {
		background: color-mix(in srgb, currentColor 12%, transparent);
	}

	.day.outside {
		color: var(--color-ink-muted);
	}

	.day.blocked {
		color: var(--color-ink-muted);
		text-decoration: line-through;
		cursor: not-allowed;
	}

	.day.today {
		box-shadow: inset 0 0 0 2px var(--color-link);
		font-weight: var(--font-weight-bold);
	}

	.day.chosen {
		background: var(--color-action);
		color: var(--color-action-text);
		font-weight: var(--font-weight-bold);
	}

	.calendar-keys {
		margin: var(--space-2) 0 0;
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
	}

	.calendar-foot {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-2);
		padding-top: var(--space-2);
		border-top: 1px solid var(--color-line);
	}

	.calendar-foot .close-button {
		margin-inline-start: auto;
	}

	.calendar-foot .button {
		min-height: 2.5rem;
		padding: var(--space-1) var(--space-3);
		font-size: var(--font-size-small);
	}

	/* On a phone the calendar rises from the bottom of the screen, with bigger days. */
	@media (max-width: 40rem) {
		.calendar {
			inset: auto 0 0 0;
			width: 100%;
			max-width: none;
			max-height: 90vh;
			border-radius: var(--radius-panel) var(--radius-panel) 0 0;
			border-bottom: 0;
		}

		.calendar::backdrop {
			background: var(--color-band);
			opacity: 0.6;
		}

		.calendar-title {
			display: flex;
			align-items: center;
			justify-content: space-between;
			font-weight: var(--font-weight-bold);
		}

		.day {
			min-height: var(--layout-target-minimum);
		}

		.calendar-keys {
			display: none;
		}

		.calendar-foot .button {
			flex: 1;
			justify-content: center;
			min-height: var(--layout-target-minimum);
		}

		.calendar-foot .close-button {
			margin-inline-start: 0;
		}
	}
</style>
