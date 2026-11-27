/**
 * The starry sky behind the map's globe (Trevor, 2026-11-27, mockup A): a night sky in both themes, its stars where the real sky is behind that side of the earth, and a thin glow at the earth's edge. The stars come from the Hipparcos Catalogue (static/map-sky/stars.json, written by tools/fetch-globe-stars.mjs), and they move only when the reader moves the globe; nothing here animates.
 *
 * No nation's constellations are drawn: none had clear permission to share when this was built (research session 2026-11-27-globe-star-sky).
 */

/** One star: right ascension and declination in degrees, V magnitude, and B-V color. */
export type Star = [number, number, number, number];

/** What the map shows: its size in CSS pixels, the point at its center, its zoom and its vertical field of view in degrees. */
export interface GlobeSkyView {
	width: number;
	height: number;
	longitude: number;
	latitude: number;
	zoom: number;
	fieldOfView: number;
	/** When the sky is shown: the stars stand where they stand at this moment. */
	time: Date;
}

/** The sky's colors, from the color tokens (design-tokens.json), as six-digit hexadecimal colors. */
export interface GlobeSkyColors {
	sky: string;
	skyEdge: string;
	star: string;
	starCool: string;
	starWarm: string;
	glow: string;
}

/** The faintest star in the file; brighter stars are drawn larger and stronger. */
export const faintestMagnitude = 6.2;

const radians = Math.PI / 180;

/** MapLibre's tiles are 512 pixels wide at zoom 0. */
const tileSize = 512;

/**
 * Where the globe's edge is on screen. MapLibre draws the globe with a radius of worldSize / 2π / cos(center latitude) pixels (getGlobeRadiusPixels in maplibre-gl 5), seen from a camera cameraToCenterDistance pixels above the center point, which is also the camera's focal length. From that close, the edge one sees is a little smaller than the radius.
 */
export function globeOutline(view: GlobeSkyView): { x: number; y: number; radius: number; focalLength: number } {
	const focalLength = view.height / 2 / Math.tan((view.fieldOfView / 2) * radians);
	const radius = (tileSize * 2 ** view.zoom) / (2 * Math.PI) / Math.max(Math.cos(view.latitude * radians), 0.01);
	return { x: view.width / 2, y: view.height / 2, radius: (focalLength * radius) / Math.sqrt(focalLength * focalLength + 2 * focalLength * radius), focalLength };
}

/** Greenwich mean sidereal time in degrees: how far the sky has turned past the earth's prime meridian at that moment (U.S. Naval Observatory, Approximate Sidereal Time). */
export function siderealDegrees(time: Date): number {
	const daysSince2000 = time.getTime() / 86_400_000 + 2_440_587.5 - 2_451_545;
	return (((280.46061837 + 360.98564736629 * daysSince2000) % 360) + 360) % 360;
}

/** A unit vector in the earth's frame: x toward longitude 0 on the equator, y toward longitude 90° east, z toward the north pole. */
function direction(longitude: number, latitude: number): [number, number, number] {
	const cosine = Math.cos(latitude * radians);
	return [cosine * Math.cos(longitude * radians), cosine * Math.sin(longitude * radians), Math.sin(latitude * radians)];
}

function dot(a: [number, number, number], b: [number, number, number]): number {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Where each star falls on screen, seen past the earth from the map's camera: the camera looks at the earth's center from above the map's center point, with north up, so the stars it sees around the earth are those on the far side of it. A star's longitude in the earth's frame is its right ascension less the sidereal time. Stars behind the camera are left out.
 */
export function placeStars(stars: Star[], view: GlobeSkyView): { x: number; y: number; star: Star }[] {
	const { x: centerX, y: centerY, focalLength } = globeOutline(view);
	const position = direction(view.longitude, view.latitude);
	const forward: [number, number, number] = [-position[0], -position[1], -position[2]];
	const north = forward[2];
	const upLength = Math.hypot(-north * forward[0], -north * forward[1], 1 - north * forward[2]) || 1;
	const up: [number, number, number] = [(-north * forward[0]) / upLength, (-north * forward[1]) / upLength, (1 - north * forward[2]) / upLength];
	const right: [number, number, number] = [forward[1] * up[2] - forward[2] * up[1], forward[2] * up[0] - forward[0] * up[2], forward[0] * up[1] - forward[1] * up[0]];
	const turned = siderealDegrees(view.time);
	const placed: { x: number; y: number; star: Star }[] = [];
	for (const star of stars) {
		const toward = direction(star[0] - turned, star[1]);
		const depth = dot(toward, forward);
		if (depth <= 0.05) continue;
		const x = centerX + (focalLength * dot(toward, right)) / depth;
		const y = centerY - (focalLength * dot(toward, up)) / depth;
		if (x < -8 || y < -8 || x > view.width + 8 || y > view.height + 8) continue;
		placed.push({ x, y, star });
	}
	return placed;
}

/** A six-digit hexadecimal color with an alpha added, so the token's color can fade without naming a color of its own. */
function withAlpha(color: string, alpha: number): string {
	const hex = color.trim();
	if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
	return `${hex}${Math.round(Math.min(1, Math.max(0, alpha)) * 255)
		.toString(16)
		.padStart(2, '0')}`;
}

/** Blue-white for hot stars, white, and a warm white for cool stars, from the star's B-V color. */
function starColor(color: number, colors: GlobeSkyColors): string {
	if (color < 0.2) return colors.starCool;
	if (color > 1.0) return colors.starWarm;
	return colors.star;
}

/** Draws the sky, its stars and the glow at the earth's edge on a canvas the size of the map. The globe itself, drawn over it by MapLibre, hides the stars behind the earth. */
export function drawGlobeSky(context: CanvasRenderingContext2D, stars: Star[], view: GlobeSkyView, colors: GlobeSkyColors): void {
	const { width, height } = view;
	context.clearRect(0, 0, width, height);
	const outline = globeOutline(view);
	// Closer in, the earth covers the whole map and no sky shows.
	if (outline.radius >= Math.hypot(width / 2, height / 2)) return;

	const sky = context.createRadialGradient(outline.x, outline.y, outline.radius * 0.8, outline.x, outline.y, Math.max(width, height) * 0.9);
	sky.addColorStop(0, colors.sky);
	sky.addColorStop(1, colors.skyEdge);
	context.fillStyle = sky;
	context.fillRect(0, 0, width, height);

	for (const { x, y, star } of placeStars(stars, view)) {
		const brightness = faintestMagnitude - star[2];
		const radius = Math.min(2.6, 0.55 + brightness * 0.3);
		const alpha = Math.min(1, 0.35 + brightness * 0.16);
		const color = starColor(star[3], colors);
		// The brightest few get a soft halo.
		if (brightness > 4.5) {
			const halo = context.createRadialGradient(x, y, 0, x, y, radius * 4);
			halo.addColorStop(0, withAlpha(color, 0.22));
			halo.addColorStop(1, withAlpha(color, 0));
			context.fillStyle = halo;
			context.beginPath();
			context.arc(x, y, radius * 4, 0, 2 * Math.PI);
			context.fill();
		}
		context.fillStyle = withAlpha(color, alpha);
		context.beginPath();
		context.arc(x, y, radius, 0, 2 * Math.PI);
		context.fill();
	}

	const glow = context.createRadialGradient(outline.x, outline.y, outline.radius * 0.98, outline.x, outline.y, outline.radius * 1.14);
	glow.addColorStop(0, withAlpha(colors.glow, 0.38));
	glow.addColorStop(1, withAlpha(colors.glow, 0));
	context.fillStyle = glow;
	context.beginPath();
	context.arc(outline.x, outline.y, outline.radius * 1.14, 0, 2 * Math.PI);
	context.fill();
}
