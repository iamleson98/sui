import { defineConfig, devices } from '@playwright/test';

/**
 * E2E + visual regression suite for the sui demo app.
 *
 * The demo routes exercise every component with the same code paths a
 * consumer app would use (real DOM, real IntersectionObserver, real REST
 * calls against the built-in mock endpoints in src/routes/api).
 *
 * Usage:
 *   npx playwright test                 # run interaction + visual suites
 *   npx playwright test --update-snapshots   # (re)generate baselines
 */
const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
	testDir: './tests/e2e',
	timeout: 30_000,
	expect: {
		timeout: 5_000,
		toHaveScreenshot: {
			// generous enough for font rasterization variance across runs,
			// tight enough to catch real layout regressions
			maxDiffPixelRatio: 0.01,
			fullPage: true,
			caret: 'hide',
			animations: 'disabled'
		}
	},
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: [['list']],
	use: {
		baseURL: BASE_URL,
		deviceScaleFactor: 1,
		reduceMotion: 'reduce'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
			// the mobile suite belongs to the phone project below
			testIgnore: /mobile\.spec\.ts/
		},
		{
			// Pixel 7: touch, 412x915 CSS px, mobile emulation — drives the
			// bottom-sheet (vaul) branch of the select family and the
			// pointer:coarse ergonomics rules in app.css
			name: 'mobile',
			use: { ...devices['Pixel 7'] },
			testMatch: /mobile\.spec\.ts/
		}
	],
	webServer: {
		command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
		port: PORT,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000
	},
	snapshotPathTemplate: '{testDir}/__screenshots__/{testFileName}/{arg}{ext}'
});
