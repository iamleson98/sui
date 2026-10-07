/**
 * Debug the peek test: click open → outside click → focus+blur → expect error.
 *
 * Run:  cd /home/z/my-project/sui && BASE_URL=http://localhost:4173 node scripts/debug-peek.mjs
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
page.on('console', (m) => console.log('PAGE:', m.text()));
await page.goto(`${BASE}/selection`, { waitUntil: 'networkidle' });

const sel = '[data-sui-select][data-sui-trigger]';
const el = page.locator(sel).first();
await el.scrollIntoViewIfNeeded();

await page.evaluate(() => {
	const t = document.querySelector('[data-sui-select][data-sui-trigger]');
	t?.addEventListener('blur', () => console.log('TRIGGER BLUR'));
	t?.addEventListener('focus', () => console.log('TRIGGER FOCUS'));
	document.addEventListener(
		'pointerdown',
		(e) => console.log('DOC POINTERDOWN', e.target.constructor.name),
		true
	);
});

const msg = () =>
	page.evaluate(() =>
		document
			.querySelector('[data-sui-field="select"] [data-sui-field-message]')
			?.textContent?.trim()
	);
const state = () =>
	page.evaluate(
		() =>
			document.querySelector('[data-sui-select][data-sui-trigger]')?.getAttribute('data-state') +
			' | active=' +
			(document.activeElement?.tagName ?? 'null') +
			' | described=' +
			(document.activeElement?.id?.slice(0, 20) ?? '')
	);

await el.click();
await page.waitForTimeout(200);
console.log('open:', await state());

await page.mouse.click(8, 300);
await page.waitForTimeout(300);
console.log('dismissed:', await state(), '| msg:', await msg());

await el.focus();
await page.waitForTimeout(100);
console.log('focused:', await state());

await el.blur();
await page.waitForTimeout(300);
console.log('blurred:', await state(), '| msg:', await msg());

await browser.close();
