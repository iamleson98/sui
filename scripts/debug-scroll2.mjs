/**
 * Debug scroll stability: exact replication of the e2e test steps
 * (combobox phase first, reduceMotion, deviceScaleFactor 1).
 *
 * Run:  cd /home/z/my-project/sui && BASE_URL=http://localhost:4173 node scripts/debug-scroll2.mjs
 */
import { chromium, devices } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const browser = await chromium.launch();
const ctx = await browser.newContext({
	...devices['Desktop Chrome'],
	deviceScaleFactor: 1,
	reduceMotion: 'reduce'
});
const page = await ctx.newPage();
await page.goto(`${BASE}/selection`, { waitUntil: 'networkidle' });

const pageY = () => page.evaluate(() => window.scrollY);
const state = (tag) =>
	page.evaluate(
		(t) => ({
			tag: t,
			y: window.scrollY,
			chips: document.querySelectorAll('[data-sui-badge]').length,
			docH: document.documentElement.scrollHeight
		}),
		tag
	);

// --- combobox phase (as in the test) ---
const combobox = page.locator('[data-sui-combobox]');
await combobox.evaluate((el) => el.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(250);
console.log(JSON.stringify(await state('cb baseline')));

await combobox.click();
await page.locator('[data-sui-combobox-list]').waitFor({ state: 'visible' });
for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowDown');
await page.waitForTimeout(150);
console.log(JSON.stringify(await state('cb arrows')));
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
console.log(JSON.stringify(await state('cb escape')));

// --- multi-select phase ---
const multi = page.locator('[data-sui-multi-select]').first();
await multi.evaluate((el) => el.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(250);
console.log(JSON.stringify(await state('multi baseline')));

await multi.click();
const items = page.locator('[data-sui-multi-select-list] [data-sui-option]');
await items.first().waitFor({ state: 'visible' });

const clickItem = async (n) => {
	const box = await items.nth(n).boundingBox();
	if (!box) throw new Error('no box');
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};
await clickItem(1);
await page.waitForTimeout(150);
console.log(JSON.stringify(await state('multi item1')));
await clickItem(3);
await page.waitForTimeout(150);
console.log(JSON.stringify(await state('multi item3')));
for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowDown');
await page.waitForTimeout(150);
console.log(JSON.stringify(await state('multi arrows')));

await browser.close();
