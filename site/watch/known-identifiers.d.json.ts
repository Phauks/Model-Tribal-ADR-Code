// The shape of known-identifiers.json, which make-known-identifiers.ts writes
// during the build and git does not keep, so the type check needs no copy.
import type { KnownIdentifiers } from '../src/lib/server/watch/known.ts';

declare const knownIdentifiers: KnownIdentifiers;
export default knownIdentifiers;
