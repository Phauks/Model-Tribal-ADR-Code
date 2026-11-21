import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// The real site runs on a Cloudflare Worker (adapter-cloudflare) with
// prerendered pages. adapter-static writes the same prerendered HTML and is
// enough to measure what a reader's browser receives. SvelteKit 3 takes its
// configuration here instead of in svelte.config.js.
export default defineConfig({
  plugins: [
    sveltekit({
      adapter: adapter({ pages: '../out/site', assets: '../out/site', strict: true }),
      files: {
        src: 'site',
        assets: '../out/site-static',
      },
      prerender: {
        crawl: false,
        // Nation pages and the request form are not part of the spike; links
        // to them are expected to be missing.
        handleHttpError: ({ path, message }) => {
          if (path.startsWith('/nations/') || path.startsWith('/requests')) return;
          throw new Error(message);
        },
      },
    }),
  ],
  server: { fs: { allow: ['..'] } },
});
