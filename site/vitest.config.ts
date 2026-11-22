// Unit tests for the server code (npm test). Kept apart from vite.config.ts
// so tests do not need to build the site or read the content files.
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['tests/**/*.test.ts'],
		environment: 'node',
		// The first citation in a file loads the citation formatter (citeproc and
		// the project's style), about 2 s on a laptop. With every test file running
		// at once on a CI runner that went past the 5 s default (document-history,
		// Nov. 22, 2026), so a test gets 20 s.
		testTimeout: 20_000
	}
});
