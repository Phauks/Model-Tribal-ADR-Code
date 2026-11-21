import { json } from '@sveltejs/kit';
import { glossaryTermSummaries } from '#lib/server/glossary-entries.ts';
import type { RequestHandler } from './$types';

// Every published glossary entry in a short form, built once with the site:
// the hover cards on glossary links read it (site/DESIGN.md, "Glossary link
// and hover card"), and the service worker saves it for offline reading.
export const prerender = true;

export const GET: RequestHandler = () => json({ terms: glossaryTermSummaries() });
