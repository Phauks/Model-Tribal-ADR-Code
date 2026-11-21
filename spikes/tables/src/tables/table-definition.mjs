// The one shape every table takes, whatever it is rendered into: the
// website (prerendered HTML), the print book (Typst) and the ebook (XHTML).
//
// A table definition is plain JSON:
//
//   {
//     "identifier": "nations-directory",
//     "caption": "Shown above the table and read first by screen readers",
//     "columns": [
//       {
//         "key": "name",              // matches a key in every row's cells
//         "header": "Nation",         // header text, sentence case
//         "type": "text",             // text | number | date | action
//         "isRowHeader": true,        // this column's cells become <th scope="row">
//         "sortable": true,
//         "searchable": true,         // included in the search box
//         "align": "start",           // start | end (numbers)
//         "printWidth": "2fr",        // Typst column width
//         "media": ["website", "print", "ebook"]   // where the column appears
//       }
//     ],
//     "defaultSort": { "key": "name", "direction": "ascending" },
//     "rows": [
//       { "key": "unique-row-key",
//         "cells": { "name": { "text": "...", "sortValue": "...", "href": "...", "hiddenText": "..." } } }
//     ]
//   }
//
// "text" is what readers see. "sortValue" is what sorting uses when it differs
// (a date shown as "March 4, 2026" sorts by "2026-03-04"). "hiddenText" is
// read by screen readers only, for example the nation's name after
// "Report a problem".

export const columnTypes = ['text', 'number', 'date', 'action'];
export const allMedia = ['website', 'print', 'ebook'];

// Sorting that follows the reader's language: accents sort with their base
// letter, case is ignored and numbers inside text sort as numbers.
const textCollator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

export function sortValueOf(cell) {
  return cell?.sortValue ?? cell?.text ?? '';
}

export function compareCells(column, first, second) {
  const firstValue = sortValueOf(first);
  const secondValue = sortValueOf(second);
  if (column.type === 'number') return Number(firstValue) - Number(secondValue);
  if (column.type === 'date') return String(firstValue).localeCompare(String(secondValue), 'en');
  return textCollator.compare(String(firstValue), String(secondValue));
}

export function sortRows(definition, rows, key, direction) {
  const column = definition.columns.find((candidate) => candidate.key === key);
  if (!column || !column.sortable) return rows;
  const sign = direction === 'descending' ? -1 : 1;
  return [...rows].sort((first, second) => sign * compareCells(column, first.cells[key], second.cells[key]));
}

// Search: every word typed must appear in one of the searchable cells.
// Accents and case are ignored, so "a" finds "Ä".
export function foldForSearch(text) {
  return String(text).normalize('NFD').replace(/\p{Mark}/gu, '').toLocaleLowerCase('en');
}

export function filterRows(definition, rows, query) {
  const words = foldForSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return rows;
  const searchableKeys = definition.columns.filter((column) => column.searchable).map((column) => column.key);
  return rows.filter((row) => {
    const haystack = foldForSearch(searchableKeys.map((key) => row.cells[key]?.text ?? '').join(' '));
    return words.every((word) => haystack.includes(word));
  });
}

export function columnsFor(definition, medium) {
  return definition.columns.filter((column) => (column.media ?? allMedia).includes(medium));
}

// Checks a definition before any renderer sees it. Returns a list of problems.
export function problemsIn(definition) {
  const problems = [];
  const keys = new Set();
  if (!definition.caption) problems.push('the table has no caption');
  for (const column of definition.columns) {
    if (keys.has(column.key)) problems.push(`column key "${column.key}" is used twice`);
    keys.add(column.key);
    if (!columnTypes.includes(column.type)) problems.push(`column "${column.key}" has unknown type "${column.type}"`);
  }
  if (definition.columns.filter((column) => column.isRowHeader).length !== 1) {
    problems.push('exactly one column must be the row header');
  }
  const rowKeys = new Set();
  for (const row of definition.rows) {
    if (rowKeys.has(row.key)) problems.push(`row key "${row.key}" is used twice`);
    rowKeys.add(row.key);
    for (const key of keys) {
      const text = row.cells[key]?.text;
      if (text === undefined) problems.push(`row "${row.key}" has no "${key}" cell`);
      else if (text.normalize('NFC') !== text) problems.push(`row "${row.key}" cell "${key}" is not in Unicode Normalization Form C`);
    }
  }
  return problems;
}
