/** Made by the offline-files plugin in vite.config.ts when the service worker is built. */
declare module 'virtual:offline-files' {
	/** The address of this build's list of prerendered files, as JSON; empty in development. */
	export const builtPathsAddress: string;
	/** The prerendered files and reader tools saved on install (src/lib/offline-shell.ts). */
	export const installFiles: string[];
}
