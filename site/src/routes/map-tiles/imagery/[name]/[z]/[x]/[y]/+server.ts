/**
 * One picture of a picture base map (satellite, terrain or contour lines), fetched from the U.S. Geological Survey for the reader (src/lib/server/map-imagery.ts).
 */
import { serveMapImagery } from '#lib/server/map-imagery.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = ({ params, fetch }) => serveMapImagery(params.name, Number(params.z), Number(params.x), Number(params.y), fetch);
