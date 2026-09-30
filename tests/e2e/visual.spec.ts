import { expect, test } from '@playwright/test';

/**
 * Visual regression baselines — one full-page screenshot per demo route.
 * Every sui component appears on at least one of these pages, so a CSS or
 * layout change that shifts pixels anywhere in the library fails here.
 *
 * Regenerate baselines after an intentional redesign:
 *   npx playwright test visual --update-snapshots
 */

const routes: Array<{ name: string; path: string }> = [
        { name: 'home', path: '/' },
        { name: 'input', path: '/input' },
        { name: 'button', path: '/button' },
        { name: 'selection', path: '/selection' },
        { name: 'data-table', path: '/data-table' },
        { name: 'toggles', path: '/toggles' },
        { name: 'validation', path: '/validation' },
        { name: 'pagination', path: '/pagination' },
        { name: 'skeletons', path: '/skeletons' }
];

for (const route of routes) {
        test(`visual baseline: ${route.name}`, async ({ page }) => {
                await page.goto(route.path);
                // wait for fonts + any first-page fetches (infinite-scroll selects
                // prefetch their first page on mount) so content is settled
                await page.evaluate(() => document.fonts.ready);
                await expect(page).toHaveScreenshot(`${route.name}.png`);
        });
}

test('visual baseline: open select menu', async ({ page }) => {
        await page.goto('/selection');
        await page.getByRole('button', { name: 'Country' }).click();
        await expect(page.getByRole('option', { name: /vietnam/i })).toBeVisible();
        await expect(page).toHaveScreenshot('select-open.png');
});

test('visual baseline: validation errors', async ({ page }) => {
        await page.goto('/validation');
        await page.getByRole('button', { name: 'Create account' }).click();
        // zod messages for every required field (scoped: the page's code sample
        // quotes the same strings)
        await expect(page.locator('form').getByText('Pick a role')).toBeVisible();
        await expect(page).toHaveScreenshot('validation-errors.png');
});
