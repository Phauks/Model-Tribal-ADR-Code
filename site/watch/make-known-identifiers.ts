/**
 * Writes the source watch's index of known identifiers
 * (src/lib/server/watch/known-build.ts) to known-identifiers.json beside this
 * file, for the watch Worker to bundle. Workers Builds runs it before each
 * deploy (npm run watch:index; site/watch/README.md). The file is not kept in
 * git.
 */
import { writeFileSync } from 'node:fs';
import { knownIdentifiersBuild } from '../src/lib/server/watch/known-build.ts';

const index = knownIdentifiersBuild();
writeFileSync(new URL('./known-identifiers.json', import.meta.url), JSON.stringify(index));
console.log(`Wrote the index of known identifiers: ${index.sources.length} sources, ${index.histories.length} document histories, ${index.nations.length} nations, ${index.capturedSha256s.length} captured files (build ${index.buildHash}).`);
