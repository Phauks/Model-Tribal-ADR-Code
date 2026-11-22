// The edition this build serves: the three track versions and the build
// version the service worker names its cache after. A reader's page fetches
// it from the network to say what a waiting update brings
// (site/DESIGN.md, section 10, "Updates"), including the pull requests merged
// most recently, so the update card can list the ones the reader lacks. The
// service worker never saves it.
import { json } from '@sveltejs/kit';
import { version } from '$app/env';
import { recentChanges } from 'virtual:build';
import { trackVersions } from '#lib/server/versions.ts';
import type { RequestHandler } from './$types';

export const prerender = true;

export const GET: RequestHandler = () => json({ build: version, ...trackVersions(), changes: recentChanges });
