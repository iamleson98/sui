/**
 * Verify the flip side: genuine blur / submit still validate.
 *
 * Run:  cd /home/z/my-project/sui && node scripts/verify-validation-still-works.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const sel = '[data-sui-select][data-sui-trigger]';

const probe = (args) => {
	const el = document.querySelectorAll(args.sel)[0];
	const field = el?.closest('[data-sui-field]');
	const msg = field?.querySelector('[data-sui-field-message]');
	return {
		variant: el.getAttribute('data-sui-variant'),
		message: msg?.textContent?.trim() ?? null,
		ring: getComputedStyle(el).boxShadow.includes('0px 0px 0px 3px')
	};
};

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/selection`, { waitUntil: 'networkidle' });
const el = page.locator(sel).first();
await el.scrollIntoViewIfNeeded();

// 1. keyboard: tab into the select, open, Escape (refocus), tab away -> error
await el.focus();
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
console.log(
	'1. kb open+escape (focus back on trigger):',
	JSON.stringify(await page.evaluate(probe, { sel }))
);
await page.keyboard.press('Tab');
await page.waitForTimeout(200);
console.log(
	'2. tab away after escape (genuine blur):   ',
	JSON.stringify(await page.evaluate(probe, { sel }))
);

// clear the error by selecting a value (change validation should make it valid)
await page.goto(`${BASE}/selection`, { waitUntil: 'networkidle' });
await el.scrollIntoViewIfNeeded();
await el.click();
await page.waitForTimeout(200);
await page.locator('[data-sui-option]', { hasText: 'Netherlands' }).first().click();
await page.waitForTimeout(300);
console.log(
	'3. after selecting Netherlands (valid):    ',
	JSON.stringify(await page.evaluate(probe, { sel }))
);

// 4. clear it again -> change validation on the explicit clear shows the error
await page.locator('[data-sui-clear]').first().click();
await page.waitForTimeout(300);
console.log(
	'4. after explicit clear (change-validate): ',
	JSON.stringify(await page.evaluate(probe, { sel }))
);

// 5. submit path on /validation manual form still stamps errors everywhere
await page.goto(`${BASE}/validation`, { waitUntil: 'networkidle' });
const manual = page.locator('form:not([data-sui-form])');
await manual.getByRole('button', { name: 'Create account' }).click();
await page.waitForTimeout(400);
const roleErr = await manual.getByText('Pick a role').isVisible();
const nameErr = await manual.getByText('Name must be at least 2 characters').isVisible();
console.log('5. manual form submit -> role error:', roleErr, '| name error:', nameErr);
// 6. focus should have landed on the first invalid control (Name input)
console.log(
	'   focused first invalid:',
	await page.evaluate(
		() =>
			document.activeElement?.getAttribute('data-sui-input') !== null ||
			document.activeElement?.tagName === 'INPUT'
	)
);

await browser.close();
