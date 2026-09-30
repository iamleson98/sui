import { expect, test, type Page } from '@playwright/test';

/**
 * Interaction tests running against the built demo app in a real browser:
 * real focus, real keyboard, real IntersectionObserver, real REST calls to
 * the mock endpoints. These complement the jsdom unit suite by covering the
 * things jsdom cannot (infinite scroll, floating-ui positioning, focus
 * management, full form submit flows).
 */

const options = (page: Page) => page.getByRole('option');

test.describe('input + zod', () => {
        test('validates as you type and clears on valid input', async ({ page }) => {
                await page.goto('/input');

                const email = page.getByLabel('Email', { exact: true });
                await email.fill('not-an-email');
                await email.blur();
                await expect(page.getByText('Enter a valid email address')).toBeVisible();

                await email.fill('minh@example.com');
                await email.blur();
                await expect(page.getByText('Enter a valid email address')).toBeHidden();
        });

        test('username action reacts to the reserved name', async ({ page }) => {
                await page.goto('/input');
                const username = page.getByLabel('Username', { exact: true });

                // a free handle briefly spins, then shows the green check
                await username.fill('minh');
                const greenCheck = page.locator('svg.text-green-500');
                await expect(greenCheck).toBeVisible({ timeout: 10_000 });

                // the reserved handle spins again, then the check disappears
                await username.fill('admin');
                await expect(greenCheck).toBeHidden({ timeout: 10_000 });
        });
});

test.describe('select / combobox / multi-select', () => {
        test('select: opens, lists options with descriptions, and commits the choice', async ({ page }) => {
                await page.goto('/selection');
                const trigger = page.getByRole('button', { name: 'Country' });
                await trigger.click();

                await expect(page.getByRole('option', { name: /netherlands/i })).toBeVisible();

                await page.getByRole('option', { name: /vietnam/i }).click();
                await expect(trigger).toContainText('Vietnam');
                await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        });

        test('combobox: filters options via server search', async ({ page }) => {
                await page.goto('/selection');
                await page.getByRole('button', { name: 'Owner' }).click();

                const searchbox = page.locator('[data-sui-combobox-input]');
                await expect(searchbox).toBeFocused();

                // the Owner source is server-searchable: a unique description query
                // narrows the list to exactly one user
                await searchbox.fill('customer #10 ·');
                await expect(options(page)).toHaveCount(1);
                await expect(options(page).first()).toContainText('Clara Tanaka');
        });

        test('multi-select: badges accumulate and overflow into a +N pill', async ({ page }) => {
                await page.goto('/selection');
                await page.getByRole('button', { name: 'Tags (static)' }).click();

                // maxDisplay is 2 on this field: 3 picks → 2 badges + "+1"
                for (const name of ['Bug', 'Feature', 'Docs']) {
                        await page.getByRole('option', { name, exact: true }).click();
                }
                await page.keyboard.press('Escape');

                const trigger = page.getByRole('button', { name: 'Tags (static)' });
                await expect(trigger).toContainText('Bug');
                await expect(trigger).toContainText('+1');
        });

        test('select: infinite scroll loads the next REST page at the bottom', async ({ page }) => {
                await page.goto('/selection');
                await page.getByRole('button', { name: 'Owner' }).click();

                // first page from /api/users (cursor, size 20)
                await expect(options(page).first()).toBeVisible();
                const initial = await options(page).count();
                expect(initial).toBeGreaterThan(10);

                // jump to the bottom of the scroll container → IntersectionObserver
                // fires → the cursor source fetches page 2
                const list = page.locator('[data-sui-combobox-list]');
                await list.evaluate((el) => {
                        el.scrollTop = el.scrollHeight;
                });
                await expect
                        .poll(async () => options(page).count(), { timeout: 10_000 })
                        .toBeGreaterThan(initial);
        });
});

test.describe('data table', () => {
        // the "Everything at once" table is the first one on the page
        test('sorts, paginates, hides columns and selects rows', async ({ page }) => {
                await page.goto('/data-table');
                const table = page.locator('[data-sui-data-table]').first();

                // sorting cycles none → asc → desc
                const firstName = table.getByRole('columnheader', { name: /first name/i });
                await firstName.click();
                await expect(firstName).toHaveAttribute('aria-sort', 'ascending');
                await firstName.click();
                await expect(firstName).toHaveAttribute('aria-sort', 'descending');

                // pagination: 23 rows, 10 per page → 3 pages
                await expect(table.getByText(/1 \/ 3/)).toBeVisible();
                await table.getByRole('button', { name: 'Next page' }).click();
                await expect(table.getByText(/2 \/ 3/)).toBeVisible();

                // column visibility menu — it portals to body level, so it is NOT a
                // child of the table element; items are labelled by lowercase column id
                await table.getByRole('button', { name: 'Toggle columns' }).click();
                await page.getByRole('menu').getByText('email', { exact: true }).click();
                await expect(table.getByRole('columnheader', { name: /email/i })).toBeHidden();
                await page.keyboard.press('Escape');

                // row selection with the footer count
                const checkboxes = table.locator('[data-sui-data-table-body] [role="checkbox"]');
                await checkboxes.nth(0).click();
                await checkboxes.nth(1).click();
                await expect(table.getByText('2 of 23 selected')).toBeVisible();
        });

        test('virtualizes 10,000 rows — only the visible window is in the DOM', async ({ page }) => {
                await page.goto('/data-table');

                const section = page.locator('section').filter({ hasText: 'Virtual scrolling' });
                const bigBody = section.locator('[data-sui-data-table-body]');
                const scroll = section.locator('[data-sui-data-table-scroll]');

                // one page of 50 rows is virtualized — never all 10,000
                await expect.poll(async () => bigBody.locator('tr').count()).toBeLessThan(120);

                await scroll.evaluate((el) => {
                        el.scrollTop = el.scrollHeight;
                });
                await page.waitForTimeout(300);
                // still windowed after a deep scroll
                expect(await bigBody.locator('tr').count()).toBeLessThan(120);
        });
});

test.describe('button', () => {
        test('loading state shows a spinner and blocks clicks', async ({ page }) => {
                await page.goto('/button');
                const save = page.getByRole('button', { name: 'Save changes', exact: true });
                await save.click();
                await expect(save).toBeDisabled();
                await expect(save).toHaveAttribute('aria-busy', 'true');
                await expect(save.locator('.animate-spin')).toBeVisible();
                await expect(save).toBeEnabled({ timeout: 10_000 }); // 1.5s simulated save
        });
});

test.describe('full form + zod submit flow', () => {
        test('submit-time force validation shows every error, then a valid submit parses', async ({ page }) => {
                await page.goto('/validation');
                // scope to the form: the demo's code sample quotes the same messages
                const form = page.locator('form');

                await page.getByRole('button', { name: 'Create account' }).click();
                await expect(form.getByText('Name must be at least 2 characters')).toBeVisible();
                await expect(form.getByText('Pick a role')).toBeVisible();
                await expect(form.getByText('Select at least one topic')).toBeVisible();

                // fill everything correctly
                await page.getByLabel('Name').fill('Minh Nguyen');
                await page.getByLabel('Email').fill('minh@example.com');
                await page.getByRole('button', { name: 'Role' }).click();
                await page.getByRole('option', { name: 'Admin' }).click();
                await page.getByRole('button', { name: 'Topics' }).click();
                await page.getByRole('option', { name: 'Svelte', exact: true }).click();
                await page.getByRole('option', { name: 'UI design', exact: true }).click();
                await page.keyboard.press('Escape');
                await page.getByLabel(/accept the terms/i).check();

                await page.getByRole('button', { name: 'Create account' }).click();
                await expect(page.getByText(/"name": "Minh Nguyen"/)).toBeVisible();
                await expect(page.getByText(/"role": "admin"/)).toBeVisible();
                await expect(page.getByText(/"topics": \[/)).toBeVisible();
        });
});

test.describe('keyboard + a11y', () => {
        test('inputs are labelled and expose invalid state to assistive tech', async ({ page }) => {
                await page.goto('/validation');
                const name = page.getByLabel('Name'); // label text is "Name *"
                await name.fill('x');
                await name.fill('');
                await name.blur();
                await expect(name).toHaveAttribute('aria-invalid', 'true');
                await expect(name).toHaveAttribute('aria-describedby', /.+/);
        });

        test('data table headers expose aria-sort after sorting', async ({ page }) => {
                await page.goto('/data-table');
                const table = page.locator('[data-sui-data-table]').first();
                const age = table.getByRole('columnheader', { name: /^age/i });
                await age.click();
                await expect(age).toHaveAttribute('aria-sort', 'ascending');
        });
});
