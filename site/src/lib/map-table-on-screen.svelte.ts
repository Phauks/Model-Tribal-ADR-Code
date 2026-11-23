/**
 * The table of the map view on screen at /nations/map, which the masthead's Download menu offers as a CSV file (src/lib/page-downloads.ts). The map page sets it whenever the reader changes the view or shows it by state.
 */
export const mapTableOnScreen = $state<{ file: string; label: string }>({ file: 'nations-by-state', label: 'Nations by State' });
