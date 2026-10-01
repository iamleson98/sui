import { expect, test } from '@playwright/test';

/**
 * Mobile-viewport suite (Pixel 7 project).
 *
 * Under 640px the select family swaps its anchored popover for a vaul
 * bottom sheet — the platform-native picker pattern. These tests pin that
 * contract plus the pointer:coarse ergonomics rules from app.css.
 */

test('select opens a bottom-sheet drawer instead of a popover', async ({ page }) => {
	await page.goto('/selection');

	const trigger = page.locator('[data-sui-select]').first();
	await trigger.tap();

	const sheet = page.locator('[data-sui-select-content]');
	await expect(sheet).toBeVisible();
	// the sheet hugs the bottom of the viewport (anchored popover would
	// sit mid-screen near the trigger)
	const box = await sheet.boundingBox();
	expect(box).not.toBeNull();
	expect(box!.y + box!.height).toBeGreaterThan(850);
	// options render inside the sheet
	await expect(sheet.locator('[data-sui-option]').first()).toBeVisible();
});

test('selecting from the sheet closes it and updates the trigger', async ({ page }) => {
	await page.goto('/selection');

	const trigger = page.locator('[data-sui-select]').first();
	await trigger.tap();
	await page
		.locator('[data-sui-select-content] [data-sui-option]', { hasText: 'Netherlands' })
		.first()
		.tap();

	await expect(page.locator('[data-sui-select-content]')).toBeHidden();
	await expect(trigger).toContainText('Netherlands');
});

test('combobox sheet keeps search working', async ({ page }) => {
	await page.goto('/selection');

	await page.getByLabel('Owner').first().tap();
	const sheet = page.locator('[data-sui-combobox-content]');
	await expect(sheet).toBeVisible();

	// search input is reachable inside the sheet and still filters
	const search = sheet.locator('[data-sui-combobox-input]');
	await expect(search).toBeVisible();
	await search.fill('a');
	await expect(sheet.locator('[data-sui-option]').first()).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
});

test('multi-select sheet selects multiple, chips land in the trigger', async ({ page }) => {
	await page.goto('/selection');

	const trigger = page.getByLabel('Products').first();
	await trigger.tap();
	const sheet = page.locator('[data-sui-multi-select-content]');
	await expect(sheet).toBeVisible();

	// the demo preselects the first product — its check icon is lit
	const firstIcon = sheet.locator('[data-sui-option]').nth(0).locator('svg').first();
	await expect
		.poll(async () => (await firstIcon.getAttribute('class'))?.includes('opacity-100'))
		.toBe(true);

	// adding a second product keeps the sheet open (multi-select pattern)
	await sheet.locator('[data-sui-option]').nth(1).tap();
	await expect(sheet).toBeVisible();

	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	// two selected: either two chips, or one chip + the "+1" overflow pill
	await expect(trigger.locator('[data-sui-badge]')).toHaveCount(2);
});

test('inputs render at 16px so iOS does not zoom on focus', async ({ page }) => {
	await page.goto('/input');

	const email = page.getByLabel('Email');
	await expect(email).toBeVisible();
	const size = await email.evaluate((el) => getComputedStyle(el).fontSize);
	expect(parseFloat(size)).toBeGreaterThanOrEqual(16);
});

test('coarse-pointer ergonomics: no tap highlight, no double-tap zoom delay', async ({ page }) => {
	await page.goto('/selection');

	const trigger = page.locator('[data-sui-select]').first();
	const styles = await trigger.evaluate((el) => {
		const cs = getComputedStyle(el);
		return {
			// non-standard property — not on the TS CSSStyleDeclaration type
			tap: cs.getPropertyValue('-webkit-tap-highlight-color'),
			touch: cs.touchAction
		};
	});
	// Chromium sometimes serializes the (correctly transparent) tap
	// highlight as '' — accept the transparent serializations only
	expect(['', 'rgba(0, 0, 0, 0)', 'transparent']).toContain(styles.tap);
	expect(styles.touch).toBe('manipulation');
});
