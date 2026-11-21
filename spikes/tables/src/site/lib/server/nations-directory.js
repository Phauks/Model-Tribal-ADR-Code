// Build-time only: reads the mock records and returns the table definition.
import { buildNationsDirectory, readRecords } from '#tables/build-nations-directory.mjs';

let cached;
export function nationsDirectory() {
  cached ??= buildNationsDirectory(readRecords());
  return cached;
}
