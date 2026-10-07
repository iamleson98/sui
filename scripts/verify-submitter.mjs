/**
 * E2E probe: createSuiSubmitter on the /validation manual form.
 *
 * Run:  cd /home/z/my-project/sui && node scripts/verify-submitter.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/validation`, { waitUntil: 'networkidle' });

const manual = page.locator('form:not([data-sui-form])');
const submitBtn = manual.getByRole('button', { name: 'Create account' });

// 1. empty submit -> every error stamps, focus lands on first invalid
await submitBtn.click();
await page.waitForTimeout(400);
for (const text of [
	'Name must be at least 2 characters',
	'Enter a valid email',
	'Pick a role',
	'Select at least one topic',
	'Please accept the terms'
]) {
	console.log(`error "${text}":`, await manual.getByText(text).isVisible());
}
console.log(
	'focus on first invalid (name input):',
	await page.evaluate(
		() =>
			document.activeElement?.tagName === 'INPUT' &&
			document.activeElement?.id.includes('sui-input')
	)
);

// 2. fixing one field clears just its error
await manual.getByLabel('Name').fill('Ada Lovelace');
await page.waitForTimeout(200);
console.log(
	'name error cleared:',
	!(await manual.getByText('Name must be at least 2 characters').isVisible()),
	'| role error stays:',
	await manual.getByText('Pick a role').isVisible()
);

// 3. complete the form and submit -> typed payload in the aside
await manual.getByLabel('Email').fill('ada@example.com');
await manual.getByRole('button', { name: 'Role' }).click();
await page.locator('[data-sui-option]', { hasText: 'Admin' }).first().click();
await manual.getByLabel('Topics').click();
await page.locator('[data-sui-option]', { hasText: 'Svelte' }).first().click();
await page.keyboard.press('Escape');
await manual.getByLabel(/I accept the terms and conditions/).click();
await submitBtn.click();
await page.waitForTimeout(900);

const asideText = await page.locator('form:not([data-sui-form]) + * , aside').last().textContent();
const pre = await page
	.locator('aside pre')
	.first()
	.textContent()
	.catch(() => null);
console.log('submitted payload:', pre?.replace(/\s+/g, ' ').slice(0, 200));

await browser.close();
