import { nationsDirectory } from '#lib/server/nations-directory.js';

export function load() {
  return { definition: nationsDirectory() };
}
