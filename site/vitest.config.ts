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
		// Nov. 22, 2026). The first test in a file that reads every source record
		// (about 31,000 by Nov. 26, 2026) takes 15 to 30 seconds on a CI runner,
		// so a test got 60 s. With the 12,392 lower federal court opinions (about
		// 49,000 records, Nov. 27, 2026) such a test took up to 60 s on a laptop and
		// more on a CI runner, so a test gets 180 s.
		testTimeout: 180_000
	}
});
