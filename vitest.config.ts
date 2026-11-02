import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

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
	// The dependency scan bundles node_modules only, which needs no tsconfig;
	// left to find one, rolldown cannot follow `"extends": "$app/tsconfig"`.
	optimizeDeps: { rolldownOptions: { tsconfig: false } },
	resolve: {
		// pick the browser (client) build of svelte — otherwise $state /
		// mount() resolve to the SSR runtime and tests explode
		// (#lib resolves through package.json "imports")
		conditions: ['browser']
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
