// Unit tests for the server code (npm test). Kept apart from vite.config.ts
// so tests do not need to build the site or read the content files.
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['tests/**/*.test.ts'],
		environment: 'node'
	}
});
