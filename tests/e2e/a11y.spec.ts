import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Automated WCAG 2.1 A/AA audit (axe-core) of every demo route and of the
 * overlays the controls open. axe finds roughly a third of accessibility
 * problems — it complements, never replaces, manual screen-reader passes —
 * but those it does find are always real, so the bar is zero violations.
 */

const ROUTES = [
	'/',
	'/button',
	'/input',
	'/selection',
	'/toggles',
	'/date-time',
	'/field-arrays',
	'/server-form',
	'/data-table',
	'/skeletons',
	'/validation',
	'/pagination'
];

async function audit(page: Page) {
	// axe reads computed colors: a popover mid fade-in is partly transparent
	// and would report contrast failures that exist for ~100ms only
	await page.evaluate(() =>
		Promise.all(
			document
				.getAnimations()
				// pulses and spinners never finish — only wait for entrance/exit animations
				.filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
				.map((a) => a.finished.catch(() => null))
		)
	);
	const results = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
		.analyze();
	// readable failure output: rule, impact and the offending nodes
	const summary = results.violations.map(
		(v) => `${v.id} (${v.impact}): ${v.nodes.length}× — ${v.nodes[0]?.target.join(' ')}`
	);
	expect(summary).toEqual([]);
}

for (const route of ROUTES) {
	test(`a11y: ${route} has no axe violations`, async ({ page }) => {
		await page.goto(route);
		await page.evaluate(() => document.fonts.ready);
		await audit(page);
	});
}

test('a11y: open select, combobox and multi-select popovers', async ({ page }) => {
	await page.goto('/selection');
	await page.getByRole('combobox', { name: 'Country' }).click();
	await expect(page.getByRole('option').first()).toBeVisible();
	await audit(page);
	await page.keyboard.press('Escape');
	// the first popover must be gone before the next one opens
	await expect(page.getByRole('option').first()).toBeHidden();

	await page.getByRole('combobox', { name: 'Owner' }).click();
	await expect(page.getByRole('option').first()).toBeVisible();
	await audit(page);
});

test('a11y: date calendar and time slot popovers', async ({ page }) => {
	await page.goto('/date-time');
	await page.getByRole('button', { name: 'Open calendar' }).first().click();
	await expect(page.getByRole('grid').first()).toBeVisible();
	await audit(page);
	await page.keyboard.press('Escape');
	await expect(page.getByRole('grid').first()).toBeHidden();

	await page.getByRole('button', { name: 'Choose a time' }).first().click();
	await expect(page.getByRole('listbox')).toBeVisible();
	await audit(page);
});

test('a11y: invalid state (errors announced, summary present)', async ({ page }) => {
	await page.goto('/validation');
	await page.locator('form[data-sui-form]').getByRole('button', { name: 'Create account' }).click();
	await expect(page.locator('[data-sui-error-summary]')).toBeVisible();
	await audit(page);
});
