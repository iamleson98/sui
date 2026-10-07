// Smoke test for the /showcase route — runtime errors, view switching,
// command palette, mobile layout. Run against the preview server on :4173.
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:4173';
const errors = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (msg) => {
	if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
});
page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));

await page.goto(BASE + '/showcase', { waitUntil: 'networkidle' });
await page.waitForTimeout(1400); // skeleton flip + charts

// overview rendered?
const hasStats = await page
	.getByText('Deploys this week')
	.isVisible()
	.catch(() => false);
const hasChart = await page
	.locator('[data-chart]')
	.first()
	.isVisible()
	.catch(() => false);
console.log('overview stats:', hasStats, '| chart canvas:', hasChart);

await page.screenshot({ path: '/tmp/showcase-overview.png', fullPage: false });

// switch views via sidebar
for (const view of ['Board', 'Deployments', 'Schedule', 'Settings']) {
	await page.getByRole('button', { name: view, exact: true }).first().click();
	await page.waitForTimeout(700);
	await page.screenshot({ path: `/tmp/showcase-${view.toLowerCase()}.png` });
	console.log('view ok:', view);
}

// command palette via keyboard
await page.keyboard.press('Control+k');
await page.waitForTimeout(400);
const paletteVisible = await page
	.getByPlaceholder('Type a command or search…')
	.isVisible()
	.catch(() => false);
console.log('command palette opens with ctrl+k:', paletteVisible);
await page.keyboard.type('nim');
await page.waitForTimeout(900); // async search debounce
const result = await page
	.getByText('Ada Okafor — Platform lead')
	.isVisible()
	.catch(() => false);
console.log('async search finds Ada:', result);
await page.keyboard.press('Escape');

// theme toggle
await page
	.getByRole('button', { name: /switch to dark theme/i })
	.first()
	.click();
await page.waitForTimeout(500);
const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
console.log('dark mode applied:', isDark);
await page.screenshot({ path: '/tmp/showcase-dark-board.png' });

// horizontal overflow check (desktop)
const overflowX = await page.evaluate(
	() => document.documentElement.scrollWidth - document.documentElement.clientWidth
);
console.log('desktop horizontal overflow px:', overflowX);

// ---------- mobile ----------
const mctx = await browser.newContext({ ...devices['Pixel 7'] });
const mpage = await mctx.newPage();
mpage.on('pageerror', (err) => errors.push(`[mobile pageerror] ${err.message}`));
await mpage.goto(BASE + '/showcase', { waitUntil: 'networkidle' });
await mpage.waitForTimeout(1200);
const mOverflow = await mpage.evaluate(
	() => document.documentElement.scrollWidth - document.documentElement.clientWidth
);
console.log('mobile horizontal overflow px:', mOverflow);
// sidebar opens as a sheet
await mpage
	.getByRole('button', { name: /toggle sidebar/i })
	.first()
	.click();
await mpage.waitForTimeout(600);
const sheetVisible = await mpage
	.getByRole('dialog', { name: 'Sidebar' })
	.isVisible()
	.catch(() => false);
console.log('mobile sidebar sheet opens:', sheetVisible);
await mpage.screenshot({ path: '/tmp/showcase-mobile.png' });
await mpage.keyboard.press('Escape');

await browser.close();

if (errors.length) {
	console.log('\nRUNTIME ERRORS:');
	for (const e of errors) console.log(' ', e.slice(0, 300));
	process.exit(1);
}
console.log('\nNo runtime errors. Smoke OK.');
