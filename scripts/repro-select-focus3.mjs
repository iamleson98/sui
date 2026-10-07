/**
 * Repro #3: mobile (Pixel 7) — does opening / dismissing the bottom sheet
 * reveal validation errors on a pristine field?
 *
 * Run:  cd /home/z/my-project/sui && node scripts/repro-select-focus3.mjs
 */
import { chromium, devices } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';

const probe = (args) => {
	const { sel, nth = 0 } = args;
	const el = document.querySelectorAll(sel)[nth];
	if (!el) return null;
	const field = el.closest('[data-sui-field]');
	const msg = field?.querySelector('[data-sui-field-message]');
	return {
		variant: el.getAttribute('data-sui-variant'),
		ariaInvalid: el.getAttribute('aria-invalid'),
		message: msg?.textContent?.trim() ?? null,
		ring: getComputedStyle(el).boxShadow.includes('0px 0px 0px 3px'),
		activeIsTrigger: document.activeElement === el
	};
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 7'] });
const page = await ctx.newPage();
await page.goto(`${BASE}/selection`, { waitUntil: 'networkidle' });

const sel = '[data-sui-select][data-sui-trigger]';
const el = page.locator(sel).first();
await el.scrollIntoViewIfNeeded();

await el.tap();
await page.waitForTimeout(400);
console.log('sheet open:  ', JSON.stringify(await page.evaluate(probe, { sel })));

// dismiss by tapping the dark overlay above the sheet
await page.mouse.click(200, 150);
await page.waitForTimeout(400);
console.log('tap outside: ', JSON.stringify(await page.evaluate(probe, { sel })));

// reopen and drag the sheet away
await el.tap();
await page.waitForTimeout(400);
const box = await page.locator('[data-sui-select-content]').boundingBox();
if (box) {
	await page.mouse.move(box.x + 100, box.y + 40);
	await page.mouse.down();
	await page.mouse.move(box.x + 100, box.y + 500, { steps: 12 });
	await page.mouse.up();
}
await page.waitForTimeout(400);
console.log('drag away:   ', JSON.stringify(await page.evaluate(probe, { sel })));

// reopen and Escape (keyboard dismissal)
await el.tap();
await page.waitForTimeout(400);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
console.log('escape:      ', JSON.stringify(await page.evaluate(probe, { sel })));

await browser.close();
