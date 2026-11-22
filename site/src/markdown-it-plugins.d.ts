// Type declarations for the markdown-it plugins the essay reader uses
// (src/lib/essays/syntax.ts), which ship without their own.

declare module 'markdown-it-ins' {
	import type { PluginSimple } from 'markdown-it';
	const underline: PluginSimple;
	export default underline;
}

declare module 'markdown-it-container' {
	import type { PluginWithOptions } from 'markdown-it';
	const container: PluginWithOptions<{ validate?: (info: string) => boolean }> &
		((markdown: import('markdown-it').default, name: string, options?: { validate?: (info: string) => boolean }) => void);
	export default container;
}
