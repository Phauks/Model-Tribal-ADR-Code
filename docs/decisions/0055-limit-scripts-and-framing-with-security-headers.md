# 0055. Limit scripts and framing with a Content Security Policy and security headers

- **Status:** Accepted
- **Date:** 2026-11-24
- **Extends:** decision record [0023](0023-permission-levels-per-document.md) ("Protection against unauthorized changes")

## Context

Essays, the glossary, the timeline, case pages and several other pages insert stored HTML with Svelte's `{@html}`. Before this decision, public pages sent no Content Security Policy and no basic security headers; only private pages sent `X-Frame-Options`, `Referrer-Policy` and `X-Content-Type-Options` (`site/src/hooks.server.ts`). A script that reached that HTML, through a mistake in the renderer or an edited essay, would have run with a signed-in reader's session. The refactor and improvements report of Nov. 24, 2026 (item S1) recommended SvelteKit's own policy in hash mode and headers for every page, and Trevor Goldsmith approved acting on it the same day.

## Decision

- SvelteKit writes the policy (`site/vite.config.ts`, `csp`, mode `hash`). It lists a SHA-256 hash of each script SvelteKit itself writes into a page, so a script inside `{@html}` text does not run, and neither does an inline event handler or a `javascript:` link. Hashes, not nonces, because most pages are built ahead of time and a nonce in a fixed file would be the same for every visitor.
- `script-src` also allows the reader-settings script in `src/app.html` (its hash is read from the file at build time), Svelte's `onload` and `onerror` replay text `this.__e=event` (through `'unsafe-hashes'`, which allows only that exact text), and WebAssembly (`'wasm-unsafe-eval'`, for spelling and grammar checking). `worker-src` allows `blob:` for the map and the video call kit. `object-src 'none'` and `base-uri 'self'` close two other ways to load code.
- Images, styles, fonts, frames and connections are not limited. The site's own styles, Svelte's transitions and the video call kit rely on inline styles and on outside hosts, and limiting them would break pages for little gain; the risk the policy answers is scripts.
- Every page and file sends `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and `X-Frame-Options: SAMEORIGIN`, with `frame-ancestors 'self'` in a second policy. Only the site's own pages may frame a public page. Private pages keep `DENY` and `frame-ancestors 'none'`, except a message's HTML, which the inbox frames. The Worker adds these to its answers (`src/lib/server/security-headers.ts`), and `site/_headers` gives them to the pages and files Cloudflare serves without running the Worker. A test keeps the two in step.
- Strict-Transport-Security waits for the project domain. Every `.dev` address, including `workers.dev`, is already on the browsers' HTTPS-only preload list.

## Consequences

- A page built ahead of time carries its policy in a `<meta>` tag, which browsers apply to everything after it in the page; `frame-ancestors` cannot go in a `<meta>` tag, which is why it is sent as a header as well.
- A new inline script in `src/app.html` is allowed automatically, but a script added any other way (a `<script>` inside `{@html}`, a third-party embed that injects its own script) will be refused. Add its source to `script-src` in `vite.config.ts` on purpose.
- Two policies apply to pages the Worker answers. A browser enforces both, so a later change must allow a thing in both to allow it at all.

## Sources

- Svelte, [SvelteKit configuration: csp](https://svelte.dev/docs/kit/configuration#csp).
- W3C, [Content Security Policy Level 3](https://www.w3.org/TR/CSP3/) (sections on `'unsafe-hashes'`, `'wasm-unsafe-eval'`, `frame-ancestors` and policies delivered by `<meta>`).
- OWASP, [HTTP Security Response Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html).
- Cloudflare, [Headers for Workers static assets](https://developers.cloudflare.com/workers/static-assets/headers/).
- Chromium, [HSTS preload list](https://hstspreload.org/) (the `.dev` top-level domain is preloaded).
