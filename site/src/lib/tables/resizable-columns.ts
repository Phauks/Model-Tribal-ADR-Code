/**
 * Column widths a reader can change, on every table in the main column
 * (Trevor asked on Nov. 23, 2026: "make it so you can adjust the widths of
 * columns in the tables").
 *
 * Each header cell gets a handle on its right edge. Dragging it changes the
 * column's width; double-clicking it fits the column to its widest line. The
 * handle is a focusable separator (WAI-ARIA window splitter pattern), so a
 * keyboard can do the same: Left and Right arrows narrow and widen the
 * column, with Shift for bigger steps, and Enter fits it. Once a column has
 * been changed, a "Reset column widths" button appears under the table.
 *
 * The end of the table stays where it is (Trevor, Nov. 24, 2026: "if you
 * expand the table, it should always keep the end of the table locked, so you
 * cannot go over the side"). Widening a column takes the width from the
 * columns after it, nearest first, then from the columns before it, each down
 * to the width of its longest word, so that no other column has its words
 * split; narrowing a column gives the width to the next one (the one before,
 * for the last). So the table is as wide after a change as before, and a
 * column stops growing once the others are down to their longest words. A
 * table that is already wider than the screen, as on a phone, scrolls in its
 * own box as before. The table also never gets narrower than its box.
 *
 * Widths are kept in em of the table's text, so they stay right when the
 * reader changes the text size, and they are remembered in this browser for
 * each table on each page. Without scripts, or before a reader changes
 * anything, tables size themselves as before.
 *
 * Left out: tables with fewer than two columns or no header row, header
 * cells that span columns, date pickers and other grids (role="grid"), text
 * being edited (contenteditable), and any table marked data-fixed-columns.
 */

const marker = 'data-resizable-columns';
const storagePrefix = 'table-column-widths:';
/** Narrowest a column can be made, in em. */
const narrowest = 3;
/** Widest a column can be made, in em. */
const widest = 80;
/** Widest that "fit" makes a column, so one long title does not take the screen. */
const widestFit = 40;
/** Keyboard steps, in em. */
const step = 1;
const bigStep = 4;

function storage(): Storage | undefined {
	try {
		return window.localStorage;
	} catch {
		return undefined;
	}
}

function fontSize(element: Element): number {
	return parseFloat(getComputedStyle(element).fontSize) || 16;
}

function round(value: number): number {
	return Math.round(value * 100) / 100;
}

function clampWidth(value: number, most = widest): number {
	return Math.min(most, Math.max(narrowest, value));
}

/**
 * Sets one column's width without changing the table's: the change comes
 * from, or goes to, the other columns (see the note at the top). Widths are
 * in em; floors are how narrow each other column may be made, also in em; the
 * result is a new list.
 */
export function shareWidth(widths: number[], index: number, width: number, most = widest, floors: number[] = []): number[] {
	const next = [...widths];
	// The other columns, in the order they give or take: after it, nearest first, then before it, nearest first.
	const others = [
		...next.map((_, place) => place).slice(index + 1),
		...next
			.map((_, place) => place)
			.slice(0, index)
			.reverse()
	];
	let change = clampWidth(width, most) - next[index];
	if (change > 0) {
		let needed = change;
		for (const other of others) {
			const given = Math.min(needed, Math.max(0, next[other] - Math.max(narrowest, floors[other] ?? 0)));
			next[other] -= given;
			needed -= given;
			if (needed <= 0) break;
		}
		change -= needed;
	} else if (change < 0) {
		let left = -change;
		for (const other of others) {
			const taken = Math.min(left, Math.max(0, widest - next[other]));
			next[other] += taken;
			left -= taken;
			if (left <= 0) break;
		}
		change += left;
	}
	next[index] += change;
	return next;
}

/** Whether a table should get handles. */
export function canResize(table: HTMLTableElement): boolean {
	if (table.hasAttribute('data-fixed-columns') || table.getAttribute('role') === 'grid') return false;
	if (table.closest('[contenteditable]:not([contenteditable="false"])')) return false;
	const header = table.tHead?.rows[0];
	if (!header || header.cells.length < 2) return false;
	return [...header.cells].every((cell) => cell.colSpan === 1);
}

/** Reads saved widths (em), if they match the table's number of columns. */
export function readWidths(key: string, columns: number): number[] | undefined {
	try {
		const saved = JSON.parse(storage()?.getItem(storagePrefix + key) ?? 'null') as unknown;
		if (!Array.isArray(saved) || saved.length !== columns) return undefined;
		if (!saved.every((value) => typeof value === 'number' && Number.isFinite(value))) return undefined;
		return saved.map((value) => clampWidth(value));
	} catch {
		return undefined;
	}
}

function writeWidths(key: string, widths: number[] | undefined) {
	try {
		if (widths) storage()?.setItem(storagePrefix + key, JSON.stringify(widths.map(round)));
		else storage()?.removeItem(storagePrefix + key);
	} catch {
		// Private windows and blocked storage: widths last until the page closes.
	}
}

/**
 * Gives one table resizable columns. Returns a function that takes the
 * handles away again and puts the table back as it was.
 */
export function resizableColumns(table: HTMLTableElement, key: string): () => void {
	const header = table.tHead!.rows[0];
	const cells = [...header.cells];
	const names = cells.map((cell, index) => cell.textContent?.replace(/\s+/g, ' ').trim() || `Column ${index + 1}`);
	let widths: number[] | undefined;

	const columnGroup = document.createElement('colgroup');
	columnGroup.setAttribute('data-column-widths', '');
	const columns = cells.map(() => columnGroup.appendChild(document.createElement('col')));

	const reset = document.createElement('button');
	reset.type = 'button';
	reset.className = 'button button-quiet column-reset no-print';
	reset.textContent = 'Reset column widths';
	reset.addEventListener('click', () => {
		apply(undefined);
		writeWidths(key, undefined);
		handles[0]?.focus();
	});

	/** The widths the columns have now, in em, read from the page. */
	function measure(): number[] {
		const size = fontSize(table);
		return cells.map((cell) => cell.getBoundingClientRect().width / size);
	}

	function apply(next: number[] | undefined) {
		widths = next;
		if (next) {
			if (!columnGroup.isConnected) table.insertBefore(columnGroup, table.tHead);
			next.forEach((width, index) => (columns[index].style.width = `${round(width)}em`));
			table.style.tableLayout = 'fixed';
			// Never narrower than its box: widths saved on a wider screen, or set before the text got smaller, spread to fill it.
			table.style.width = `max(100%, ${round(next.reduce((sum, width) => sum + width, 0))}em)`;
			table.classList.add('columns-resized');
			if (!reset.isConnected) table.after(reset);
		} else {
			columnGroup.remove();
			table.style.removeProperty('table-layout');
			table.style.removeProperty('width');
			table.classList.remove('columns-resized');
			reset.remove();
		}
		describeAll();
	}

	/**
	 * Tells assistive technology each column's width, in CSS pixels. A
	 * focusable separator must state its value (WAI-ARIA), so every handle
	 * does from the start.
	 */
	function describeAll() {
		const now = widths ?? measure();
		const size = fontSize(table);
		handles.forEach((handle, index) => {
			const pixels = Math.round(now[index] * size);
			handle.setAttribute('aria-valuemin', String(Math.round(narrowest * size)));
			handle.setAttribute('aria-valuemax', String(Math.round(widest * size)));
			handle.setAttribute('aria-valuenow', String(pixels));
			handle.setAttribute('aria-valuetext', `${names[index]} column, ${pixels} pixels wide`);
		});
	}

	/**
	 * How narrow each column can be without splitting a word, in em: the
	 * widths the table takes when it is made as narrow as it can be, laid out
	 * as the browser would without any widths set.
	 */
	function measureFloors(): number[] {
		const size = fontSize(table);
		const style = table.style.cssText;
		const attached = columnGroup.isConnected;
		const resized = table.classList.contains('columns-resized');
		if (attached) columnGroup.remove();
		table.classList.remove('columns-resized');
		table.classList.add('columns-measuring');
		table.style.tableLayout = 'auto';
		table.style.width = 'min-content';
		const found = cells.map((cell) => cell.getBoundingClientRect().width / size);
		table.style.cssText = style;
		table.classList.remove('columns-measuring');
		if (resized) table.classList.add('columns-resized');
		if (attached) table.insertBefore(columnGroup, table.tHead);
		return found;
	}

	/** The floors for the change under way: measured once when a drag starts or a handle takes the focus, since measuring lays out every row. */
	let floors: number[] | undefined;

	/** Sets one column's width, from the widths given or the ones the columns have now, keeping the end of the table where it is. */
	function setWidth(index: number, width: number, most = widest, from = widths ?? measure()) {
		apply(shareWidth(from, index, width, most, floors ?? (floors = measureFloors())));
	}

	/** The width that shows the column's widest line without wrapping, up to widestFit. */
	function fit(index: number) {
		const size = fontSize(table);
		const column = [...table.rows]
			.map((row) => row.cells[index])
			.filter((cell): cell is HTMLTableCellElement => Boolean(cell) && cell.colSpan === 1);
		table.classList.add('columns-measuring');
		const before = column.map((cell) => cell.style.whiteSpace);
		column.forEach((cell) => (cell.style.whiteSpace = 'nowrap'));
		const longest = Math.max(...column.map((cell) => cell.scrollWidth));
		column.forEach((cell, row) => (cell.style.whiteSpace = before[row]));
		table.classList.remove('columns-measuring');
		// One em on top for the handle and rounding, so the last letter never wraps.
		floors = measureFloors();
		setWidth(index, longest / size + 1, widestFit);
		writeWidths(key, widths);
	}

	const handles = cells.map((cell, index) => {
		const handle = document.createElement('span');
		handle.className = 'column-resizer no-print';
		handle.setAttribute('role', 'separator');
		handle.setAttribute('aria-orientation', 'vertical');
		handle.setAttribute('aria-label', `Resize the ${names[index]} column`);
		handle.title = 'Drag to resize. Double-click to fit.';
		handle.tabIndex = 0;

		handle.addEventListener('pointerdown', (event) => {
			if (event.button !== 0) return;
			event.preventDefault();
			const start = event.clientX;
			// Each move starts again from the widths at the start of the drag, so dragging back gives every column its width back.
			const startWidths = widths ?? measure();
			floors = measureFloors();
			const size = fontSize(table);
			handle.setPointerCapture(event.pointerId);
			handle.classList.add('dragging');
			const move = (moved: PointerEvent) => setWidth(index, startWidths[index] + (moved.clientX - start) / size, widest, startWidths);
			const end = () => {
				handle.classList.remove('dragging');
				handle.removeEventListener('pointermove', move);
				handle.removeEventListener('pointerup', end);
				handle.removeEventListener('pointercancel', end);
				if (widths) writeWidths(key, widths);
			};
			handle.addEventListener('pointermove', move);
			handle.addEventListener('pointerup', end);
			handle.addEventListener('pointercancel', end);
		});
		handle.addEventListener('focus', () => {
			floors = undefined;
			describeAll();
		});
		handle.addEventListener('dblclick', () => fit(index));
		handle.addEventListener('keydown', (event) => {
			const change = event.shiftKey ? bigStep : step;
			const now = (widths ?? measure())[index];
			if (event.key === 'ArrowRight') setWidth(index, now + change);
			else if (event.key === 'ArrowLeft') setWidth(index, now - change);
			else if (event.key === 'Enter') return void (event.preventDefault(), fit(index));
			else return;
			event.preventDefault();
			writeWidths(key, widths);
		});
		// Keeps a drag or a click on the handle from sorting the column.
		handle.addEventListener('click', (event) => event.stopPropagation());

		cell.classList.add('resizable-header');
		cell.append(handle);
		return handle;
	});

	table.setAttribute(marker, '');
	apply(readWidths(key, cells.length));

	return () => {
		apply(undefined);
		handles.forEach((handle) => handle.remove());
		cells.forEach((cell) => cell.classList.remove('resizable-header'));
		table.removeAttribute(marker);
	};
}

/**
 * A Svelte attachment for the main column: gives every table in it, and every
 * table added to it later, resizable columns. Tables are told apart by their
 * id, or else by their place on the page.
 *
 * Use: <main {@attach resizableTables}>
 */
export function resizableTables(root: HTMLElement): () => void {
	const undo = new Map<HTMLTableElement, () => void>();

	const scan = () => {
		for (const [table, remove] of undo) {
			if (!table.isConnected) {
				remove();
				undo.delete(table);
			}
		}
		const tables = [...root.querySelectorAll('table')];
		tables.forEach((table, place) => {
			if (table.hasAttribute(marker) || !canResize(table)) return;
			undo.set(table, resizableColumns(table, `${location.pathname}#${table.id || place}`));
		});
	};

	let pending = 0;
	const observer = new MutationObserver(() => {
		if (pending) return;
		pending = requestAnimationFrame(() => {
			pending = 0;
			scan();
		});
	});
	scan();
	observer.observe(root, { childList: true, subtree: true });
	return () => {
		observer.disconnect();
		cancelAnimationFrame(pending);
		undo.forEach((remove) => remove());
		undo.clear();
	};
}
