/**
 * Repro: sui select-family triggers keep the focus ring after
 * pointer-open + pointer-dismiss (click outside without choosing).
 *
 * Run:  cd /home/z/my-project/sui && node /home/z/my-project/scripts/repro-select-focus.mjs
 * Needs the dev server on http://localhost:5173
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';

const probe = (sel) => ({
	sel,
	focus: document.activeElement
		? `${document.activeElement.tagName.toLowerCase()}${
				document.activeElement.id ? `#${document.activeElement.id}` : ''
			}[data-sui-select=${document.activeElement.hasAttribute('data-sui-select')}]`
		: 'none',
	isFocused: document.querySelector(sel)?.matches(':focus') ?? false,
	isFocusVisible: document.querySelector(sel)?.matches(':focus-visible') ?? false,
	boxShadow: getComputedStyle(document.querySelector(sel)).boxShadow,
	dataState: document.querySelector(sel)?.getAttribute('data-state') ?? null
});

const cases = [
	{ name: 'sui select', sel: '[data-sui-select][data-sui-trigger]' },
	{ name: 'sui combobox', sel: '[data-sui-combobox][data-sui-trigger]' },
	{ name: 'sui multi-select', sel: '[data-sui-multi-select][data-sui-trigger]' }
];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/selection`, { waitUntil: 'networkidle' });

for (const { name, sel } of cases) {
	const el = page.locator(sel).first();
	if (!(await el.count())) {
		console.log(`\n=== ${name}: NOT FOUND ===`);
		continue;
	}
	console.log(`\n=== ${name} (${sel}) ===`);
	await el.scrollIntoViewIfNeeded();

	// -- pointer flow ----------------------------------------------------
	await el.click(); // opens the list
	await page.waitForTimeout(250);
	console.log('after click (open):  ', JSON.stringify(await page.evaluate(probe, sel)));

	await page.mouse.click(8, 8); // click "outside" (top-left corner)
	await page.waitForTimeout(300);
	console.log('after outside click: ', JSON.stringify(await page.evaluate(probe, sel)));

	// -- keyboard flow ---------------------------------------------------
	await el.focus();
	await page.keyboard.press('Enter');
	await page.waitForTimeout(250);
	console.log('kb open:             ', JSON.stringify(await page.evaluate(probe, sel)));

	await page.keyboard.press('Escape');
	await page.waitForTimeout(300);
	console.log('kb escape:           ', JSON.stringify(await page.evaluate(probe, sel)));

	await el.blur();
}

await browser.close();
