// Renders any table definition (see ../tables/table-definition.mjs) as an
// XHTML table for the ebook: caption, column headers with scope="col", the
// row header column as <th scope="row">, no scripts and no links back to the
// website (the ebook stands alone).

import { columnsFor } from '../tables/table-definition.mjs';

export function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderTableXhtml(definition) {
  const columns = columnsFor(definition, 'ebook');
  const alignClass = (column) => (column.align === 'end' ? ' class="align-end"' : '');
  const header = columns
    .map((column) => `<th scope="col"${alignClass(column)}>${escapeXml(column.header)}</th>`)
    .join('');
  const body = definition.rows
    .map((row) => {
      const cells = columns
        .map((column) => {
          const text = escapeXml(row.cells[column.key].text);
          return column.isRowHeader
            ? `<th scope="row">${text}</th>`
            : `<td${alignClass(column)}>${text}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('\n');
  return `<div class="table-scroll">
<table id="${escapeXml(definition.identifier)}">
<caption>${escapeXml(definition.caption)}</caption>
<thead><tr>${header}</tr></thead>
<tbody>
${body}
</tbody>
</table>
</div>`;
}
