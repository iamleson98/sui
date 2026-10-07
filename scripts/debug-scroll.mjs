/**
 * Debug the scroll-stability regression: replicate the test steps and
 * dump page state after each interaction.
 *
 * Run:  cd /home/z/my-project/sui && BASE_URL=http://localhost:4173 node scripts/debug-scroll.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/selection`, { waitUntil: 'networkidle' });

const pageY = () => page.evaluate(() => window.scrollY);
const state = () =>
	page.evaluate(() => ({
		y: window.scrollY,
		multiHeights: Array.from(document.querySelectorAll('[data-sui-multi-select]')).map(
			(el) => el.getBoundingClientRect().height
		),
		messages: Array.from(document.querySelectorAll('[data-sui-field-message]')).length,
		chips: document.querySelectorAll('[data-sui-badge]').length,
		open: !!document.querySelector('[data-sui-multi-select-content]')
	}));

const multi = page.locator('[data-sui-multi-select]').first();
await multi.evaluate((el) => el.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(250);
console.log('y1 baseline:', JSON.stringify(await state()));

await multi.click();
await page.waitForTimeout(250);
console.log('after open:  ', JSON.stringify(await state()));

const items = page.locator('[data-sui-multi-select-list] [data-sui-option]');
const clickItem = async (n) => {
	const box = await items.nth(n).boundingBox();
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};
await clickItem(1);
await page.waitForTimeout(150);
console.log('after item1: ', JSON.stringify(await state()));
await clickItem(3);
await page.waitForTimeout(150);
console.log('after item3: ', JSON.stringify(await state()));
for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowDown');
await page.waitForTimeout(150);
console.log('after arrows:', JSON.stringify(await state()));

await browser.close();
