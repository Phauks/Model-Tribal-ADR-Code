import { nationsDirectory } from '#lib/server/nations-directory.js';

// No Svelte code is sent to the browser for this page; a small script
// enhances the prerendered table instead.
export const csr = false;

export function load() {
  return { definition: nationsDirectory() };
}
