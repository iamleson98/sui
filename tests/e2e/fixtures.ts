import { expect, test as base } from '@playwright/test';

/**
 * Shared Playwright fixtures.
 *
 * The demo app is prerendered: `page.goto` resolves on `load`, but SvelteKit
 * hydrates a moment later. A click or blur that lands on the inert HTML in
 * between does nothing (no menu opens, no validation runs) — a timing race
 * that shows up as flakes under load. Every navigation therefore waits for
 * the root layout's `html[data-hydrated]` marker, unless the test asks for
 * an earlier `waitUntil` on purpose (e.g. to type before hydration).
 */
export const test = base.extend({
	page: async ({ page }, use) => {
		const goto = page.goto.bind(page);
		page.goto = async (url, options) => {
			const response = await goto(url, options);
			if (options?.waitUntil === undefined || options.waitUntil === 'load') {
				await page.waitForSelector('html[data-hydrated]', { state: 'attached' });
			}
			return response;
		};
		await use(page);
	}
});

export { expect };
