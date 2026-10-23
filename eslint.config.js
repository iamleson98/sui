import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default ts.config(
	{
		// vendored shadcn-svelte primitives are re-synced from upstream, and
		// build output is generated
		ignores: [
			'.svelte-kit/**',
			'.vercel/**',
			'build/**',
			'node_modules/**',
			'dist/**',
			'src/lib/components/ui/**',
			'playwright-report/**',
			'test-results/**'
		]
	},
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } }
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: { parserOptions: { parser: ts.parser } }
	},
	{
		rules: {
			// `any` appears only at the Standard Schema / zod introspection
			// boundary, each with a comment; unused args may be `_`-prefixed
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }
			],
			// internal bookkeeping (timers, memo maps, de-dupe sets) is deliberately
			// NOT reactive — reactivity lives in $state fields and, where a view
			// must update, SvelteMap/SvelteSet
			'svelte/prefer-svelte-reactivity': 'off',
			// SvelteKit apps link with plain hrefs; this repo's demo does not use `resolve()`
			'svelte/no-navigation-without-resolve': 'off',
			// `{@html}` is not used; keep it that way
			'svelte/no-at-html-tags': 'error',
			// keyed each blocks: required for stable DOM in lists
			'svelte/require-each-key': 'error'
		}
	}
);
