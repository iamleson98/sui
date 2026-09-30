import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';

export default defineConfig({
	plugins: [
		// compile sui components for tests; runes mode on
		svelte({
			compilerOptions: {
				runes: true,
				dev: true
			}
		})
	],
	resolve: {
		// pick the browser (client) build of svelte — otherwise $state /
		// mount() resolve to the SSR runtime and tests explode
		conditions: ['browser'],
		alias: {
			$lib: path.resolve(__dirname, 'src/lib')
		}
	},
	test: {
		environment: 'jsdom',
		setupFiles: ['./tests/setup.ts'],
		include: ['tests/unit/**/*.test.ts'],
		css: false,
		// jsdom lacks these browser APIs that bits-ui / sui rely on
		mockReset: true
	}
});
