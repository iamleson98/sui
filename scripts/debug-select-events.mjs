/**
 * Debug: exact event sequence when pointer-dismissing the sui select popup.
 *
 * Run:  cd /home/z/my-project/sui && node scripts/debug-select-events.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (msg) => {
	const text = msg.text();
	if (text.startsWith('[')) console.log(text);
});
await page.goto(`${BASE}/selection`, { waitUntil: 'networkidle' });

await page.evaluate(() => {
	const log = (what) => console.log(`[${performance.now().toFixed(1)}] ${what}`);
	document.addEventListener(
		'pointerdown',
		(e) =>
			log(
				`pointerdown on ${e.target.tagName}.${(e.target.className || '').toString().slice(0, 30)}`
			),
		{ capture: true }
	);
	document.addEventListener(
		'focusin',
		(e) =>
			log(
				`focusin ${e.target.tagName}#${e.target.id || '-'} sui=${e.target.hasAttribute('data-sui-select')}`
			),
		{ capture: true }
	);
	document.addEventListener(
		'focusout',
		(e) =>
			log(
				`focusout ${e.target.tagName}#${e.target.id || '-'} related=${e.relatedTarget ? e.relatedTarget.tagName : 'null'}`
			),
		{ capture: true }
	);
	window.__suiLog = log;
});

const el = page.locator('[data-sui-select][data-sui-trigger]').first();
await el.scrollIntoViewIfNeeded();
await el.click();
await page.waitForTimeout(300);

const state1 = await page.evaluate(() => ({
	open: document.querySelector('[data-sui-select][data-sui-trigger]')?.getAttribute('data-state'),
	active: document.activeElement?.tagName + '#' + (document.activeElement?.id || '')
}));
console.log('after open:', JSON.stringify(state1));

console.log('--- clicking outside ---');
await page.mouse.click(8, 300);
await page.waitForTimeout(400);

const state2 = await page.evaluate(() => ({
	open: document.querySelector('[data-sui-select][data-sui-trigger]')?.getAttribute('data-state'),
	active: document.activeElement?.tagName,
	variant: document
		.querySelector('[data-sui-select][data-sui-trigger]')
		?.getAttribute('data-sui-variant'),
	msg: document.querySelector('[data-sui-field-message]')?.textContent?.trim()
}));
console.log('after dismiss:', JSON.stringify(state2));

await browser.close();
