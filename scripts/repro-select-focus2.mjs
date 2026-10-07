/**
 * Repro #2: full validation-state probe — does pointer-dismiss of the
 * popup reveal errors (the ring users read as a stuck focus state)?
 *
 * Run:  cd /home/z/my-project/sui && node scripts/repro-select-focus2.mjs
 */
import { chromium } from '@playwright/test';

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
		focus: document.activeElement === el,
		focusVisible: el.matches(':focus-visible'),
		ring: getComputedStyle(el).boxShadow.includes('0px 0px 0px 3px')
	};
};

const cases = [
	{ name: 'sui select (Country, schema)', sel: '[data-sui-select][data-sui-trigger]', nth: 0 },
	{ name: 'sui select (Region, no schema)', sel: '[data-sui-select][data-sui-trigger]', nth: 1 },
	{ name: 'sui combobox (Owner, schema)', sel: '[data-sui-combobox][data-sui-trigger]', nth: 0 },
	{ name: 'sui multi-select (Products)', sel: '[data-sui-multi-select][data-sui-trigger]', nth: 0 }
];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/selection`, { waitUntil: 'networkidle' });

for (const { name, sel, nth = 0 } of cases) {
	const el = page.locator(sel).nth(nth);
	if (!(await el.count())) {
		console.log(`\n=== ${name}: NOT FOUND ===`);
		continue;
	}
	console.log(`\n=== ${name} ===`);
	await el.scrollIntoViewIfNeeded();

	await el.click();
	await page.waitForTimeout(200);
	console.log('open:    ', JSON.stringify(await page.evaluate(probe, { sel, nth })));

	await page.mouse.click(8, 300);
	await page.waitForTimeout(300);
	console.log('dismiss: ', JSON.stringify(await page.evaluate(probe, { sel, nth })));
}

// form-engine driven selects on /validation
console.log('\n\n########## /validation page ##########');
await page.goto(`${BASE}/validation`, { waitUntil: 'networkidle' });
const formSel = '[data-sui-select][data-sui-trigger]';
const n = await page.locator(formSel).count();
console.log('sui selects on /validation:', n);
if (n > 0) {
	const el = page.locator(formSel).first();
	await el.scrollIntoViewIfNeeded();
	await el.click();
	await page.waitForTimeout(200);
	console.log('open:    ', JSON.stringify(await page.evaluate(probe, { sel: formSel })));
	await page.mouse.click(8, 300);
	await page.waitForTimeout(300);
	console.log('dismiss: ', JSON.stringify(await page.evaluate(probe, { sel: formSel })));
}

await browser.close();
