// Candidate "simple-datatables" (LGPL-3.0): turns the table already in the
// page into a sortable, searchable table. Paging is turned off so all rows
// stay in the page like the other candidates; the library's own sort is
// replaced by the shared rules only where its options allow.

import { DataTable } from 'simple-datatables';

const table = document.querySelector('table[data-enhance-table]');
const headers = [...table.tHead.rows[0].cells];
// eslint-disable-next-line no-new
new DataTable(table, {
  paging: false,
  searchable: true,
  // By default a row matches if any word matches, so "Sample Nation 99"
  // matched all 1,000 rows (measured). searchAnd requires every word.
  searchAnd: true,
  sortable: true,
  labels: { placeholder: 'Search nations', searchTitle: 'Search nations', info: 'Showing {start} to {end} of {rows} entries' },
  columns: headers.map((header, index) => ({
    select: index,
    // The rows arrive sorted by this column; saying so makes the first click reverse the order.
    ...(header.hasAttribute('aria-sort') ? { sort: header.getAttribute('aria-sort') === 'descending' ? 'desc' : 'asc' } : {}),
    sortable: header.hasAttribute('data-table-sortable'),
    searchable: header.hasAttribute('data-table-searchable'),
    // simple-datatables parses dates with dayjs; the cells show "March 4, 2026".
    ...(header.dataset.tableType === 'date' ? { type: 'date', format: 'MMMM D, YYYY' } : {}),
    ...(header.dataset.tableType === 'number' ? { type: 'number' } : {}),
  })),
});
document.documentElement.dataset.tableReady = 'true';
