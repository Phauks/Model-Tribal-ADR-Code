// Candidate "DataTables 3" (MIT): turns the table already in the page into a
// sortable, searchable table. Paging is turned off so all rows stay in the
// page like the other candidates.

import DataTable from 'datatables.net-dt';

const table = document.querySelector('table[data-enhance-table]');
// DataTables sorts by a cell's data-order attribute when present. Without
// it, "March 4, 2026" sorted as text, so April came first (measured).
for (const cell of table.querySelectorAll('td[data-sort-value]')) cell.dataset.order = cell.dataset.sortValue;
const headers = [...table.tHead.rows[0].cells];
const sortedIndex = headers.findIndex((header) => header.hasAttribute('aria-sort'));
// eslint-disable-next-line no-new
new DataTable(table, {
  paging: false,
  info: true,
  // The rows arrive sorted by this column.
  order: sortedIndex >= 0 ? [[sortedIndex, headers[sortedIndex].getAttribute('aria-sort') === 'descending' ? 'desc' : 'asc']] : [],
  language: { search: 'Search nations' },
  columnDefs: headers.map((header, index) => ({
    targets: index,
    orderable: header.hasAttribute('data-table-sortable'),
    searchable: header.hasAttribute('data-table-searchable'),
  })),
});
document.documentElement.dataset.tableReady = 'true';
