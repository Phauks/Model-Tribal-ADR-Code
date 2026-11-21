// Types of the modules that vite.config.ts makes at build time.

declare module 'virtual:map-geometry' {
	const geometry: import('./lib/map-geometry.ts').MapGeometry;
	export default geometry;
}
