// Candidate "no library, DOM enhancer": a small script that adds sorting and
// search to a table that is already in the page. It reads the rows that the
// server wrote, so the data is sent once (as HTML), and the page needs no
// Svelte code. Uses the same sort and search rules as every other medium.
//
// Markup it expects (StaticTable.svelte writes it):
//   <table data-enhance-table> with <th data-table-sortable data-table-type="text|number|date">
//   and optional data-sort-value on body cells.

import { foldForSearch } from '../../tables/table-definition.mjs';

const textCollator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

function compareValues(type, first, second) {
  if (type === 'number') return Number(first) - Number(second);
  if (type === 'date') return first.localeCompare(second, 'en');
  return textCollator.compare(first, second);
}

export function enhanceTable(table) {
  const headers = [...table.tHead.rows[0].cells];
  const body = table.tBodies[0];
  const rows = [...body.rows].map((element) => ({
    element,
    values: [...element.cells].map((cell) => cell.dataset.sortValue ?? cell.textContent.trim()),
    searchText: foldForSearch(
      headers
        .map((header, index) => (header.hasAttribute('data-table-searchable') ? element.cells[index].textContent : ''))
        .join(' '),
    ),
  }));
  let sortIndex = headers.findIndex((header) => header.hasAttribute('aria-sort'));
  let direction = sortIndex >= 0 ? headers[sortIndex].getAttribute('aria-sort') : 'ascending';

  // Search box and live count, added only now that the script runs.
  const identifier = table.id || 'table';
  const tools = document.createElement('div');
  tools.className = 'table-tools';
  tools.innerHTML = `<div><label for="${identifier}-search">Search nations</label><input id="${identifier}-search" type="search" autocomplete="off"></div><p class="table-status" role="status" aria-live="polite"></p>`;
  const container = table.closest('.table-scroll') ?? table;
  container.before(tools);
  const input = tools.querySelector('input');
  const status = tools.querySelector('[role="status"]');

  function render() {
    const words = foldForSearch(input.value).split(/\s+/).filter(Boolean);
    let shown = 0;
    const order = [...rows];
    if (sortIndex >= 0) {
      const type = headers[sortIndex].dataset.tableType;
      const sign = direction === 'descending' ? -1 : 1;
      order.sort((first, second) => sign * compareValues(type, first.values[sortIndex], second.values[sortIndex]));
    }
    const fragment = document.createDocumentFragment();
    for (const row of order) {
      const matches = words.every((word) => row.searchText.includes(word));
      row.element.hidden = !matches;
      if (matches) shown += 1;
      fragment.append(row.element);
    }
    body.append(fragment);
    status.textContent = `Showing ${shown} of ${rows.length}`;
    headers.forEach((header, index) => {
      if (index === sortIndex) header.setAttribute('aria-sort', direction);
      else header.removeAttribute('aria-sort');
      const indicator = header.querySelector('.sort-indicator');
      if (indicator) indicator.textContent = index === sortIndex ? (direction === 'ascending' ? '▲' : '▼') : '↕';
    });
  }

  headers.forEach((header, index) => {
    if (!header.hasAttribute('data-table-sortable')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sort-button';
    button.append(header.textContent.trim());
    const indicator = document.createElement('span');
    indicator.className = 'sort-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    button.append(indicator);
    header.replaceChildren(button);
    button.addEventListener('click', () => {
      direction = index === sortIndex && direction === 'ascending' ? 'descending' : 'ascending';
      sortIndex = index;
      render();
    });
  });
  input.addEventListener('input', render);
  status.textContent = `Showing ${rows.length} of ${rows.length}`;
  render();
}

for (const table of document.querySelectorAll('table[data-enhance-table]')) enhanceTable(table);
document.documentElement.dataset.tableReady = 'true';
