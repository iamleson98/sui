import adapterNode from '@sveltejs/adapter-node';
import adapterVercel from '@sveltejs/adapter-vercel';

// Two build targets, one source of truth:
//
// - Vercel sets VERCEL=1 in its build environment, so there we emit the
//   Build Output API bundle (.vercel/output) via adapter-vercel — prerendered
//   pages served as static files, the /api mock endpoints and sitemap.xml as
//   serverless functions.
// - Everywhere else (e2e's `npm run build && npm run preview`, `node
//   build/index.js`, Fly.io / Railway / Render / Docker) the adapter-node
//   output stays the default, so existing workflows are untouched.
//
// svelte.config.js is also the file Vercel's framework detection looks for —
// without it the project imports as "Other" and Vercel serves the adapter-node
// build/ directory as raw static files.
const adapter = process.env.VERCEL ? adapterVercel() : adapterNode();

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter,
		prerender: {
			// crawl every page so all demos land in the static output
			entries: ['*']
		}
	}
};

export default config;
