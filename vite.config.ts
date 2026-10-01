import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			// Kit options inline — SvelteKit ignores svelte.config.js when
			// options are passed here (since 2.62).
			//
			// Node adapter: prerendered pages are served as static HTML (fast,
			// SEO friendly) while the /api mock endpoints stay dynamic. Deploys
			// to any Node host (`node build/index.js`), Fly.io, Railway,
			// Render, Docker…
			adapter: adapter(),
			prerender: {
				// crawl every page so all demos land in the static output
				entries: ['*']
			},
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			}
		})
	],
	build: {
		rollupOptions: {
			output: {
				// Fine-grained chunks so each route downloads only the sui
				// components it actually renders. `advancedChunks` is the
				// deprecated alias of `codeSplitting`.
				//
				// Chasing cross-chunk imports taught us three lessons:
				// - SvelteKit forces `codeSplitting = false` for the client
				//   unless `kit.output.bundleStrategy = 'split'` (the default,
				//   but kept explicit here for clarity).
				// - `includeDependenciesRecursively: false` is incompatible
				//   with Kit's `preserveEntrySignatures: 'strict'`, so groups
				//   capture dependency subtrees — shared sui root helpers must
				//   therefore be claimed by their own high-priority group,
				//   or one family chunk swallows them and cross-links every
				//   page to every family.
				// - @lucide/svelte icon modules live under …/svelte/DIST/icons/
				//   (not …/svelte/icons/) — a wrong `test` quietly lets each
				//   icon follow its first importer, which is how the button
				//   page ended up loading the combobox chunk for SearchIcon.
				codeSplitting: {
					groups: [
						// overlay machinery shared by every select-family control
						{
							name: 'vendor-bits-ui',
							priority: 10,
							test: /node_modules[\\/](bits-ui|@floating-ui)[\\/]/
						},
						// the data-table engine — only table pages pay for it
						{
							name: 'vendor-tanstack',
							priority: 10,
							test: /node_modules[\\/]@tanstack[\\/]/
						},
						// mobile bottom sheets
						{ name: 'vendor-vaul', priority: 10, test: /node_modules[\\/]vaul-svelte[\\/]/ },
						// all icons in one cached chunk (tiny per-icon modules)
						{
							name: 'icons',
							priority: 5,
							test: /node_modules[\\/]@lucide[\\/]svelte[\\/]dist[\\/]icons[\\/]/
						},
						// shared sui root helpers (styles/types/field/zod/…) —
						// every family imports these, so they get one small
						// chunk of their own instead of hiding inside a family
						{
							name: 'sui-shared',
							priority: 5,
							test: /[\\/]src[\\/]lib[\\/]sui[\\/][^\\/]+$/
						},
						// one chunk per sui component directory; minSize 0 —
						// no merging, each page fetches only the families it
						// uses. null = leave to default chunking.
						{
							debugName: 'sui-family',
							minSize: 0,
							name: (id: string) => {
								const m = /[\\/]src[\\/]lib[\\/]sui[\\/]([^\\/\\.]+)/.exec(id);
								return m ? `sui-${m[1]}` : null;
							}
						}
					]
				}
			}
		}
	}
});
