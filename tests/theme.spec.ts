import { test, expect } from '@playwright/test';

const pages = ['/', '/blog', '/blog/hello-world', '/cv', '/portfolio'];

test.describe('Theme Toggle', () => {
	for (const page of pages) {
		test(`defaults to dark mode on ${page}`, async ({ page: p }) => {
			await p.goto(page);
			const theme = await p.locator('html').getAttribute('data-theme');
			expect(theme).toBe('dark');
		});

		test(`toggle is in top-right on ${page}`, async ({ page: p }) => {
			await p.goto(page);
			const toggle = p.locator('#theme-toggle');
			await expect(toggle).toBeVisible();
			const box = await toggle.boundingBox();
			const viewport = p.viewportSize();
			expect(box!.x).toBeGreaterThan(viewport!.width / 2);
			expect(box!.y).toBeLessThan(100);
		});

		test(`shows sun icon in dark mode on ${page}`, async ({ page: p }) => {
			await p.goto(page);
			await expect(p.locator('.icon-sun')).toBeVisible();
			await expect(p.locator('.icon-moon')).toBeHidden();
		});

		test(`shows moon icon in light mode on ${page}`, async ({ page: p }) => {
			await p.goto(page);
			await p.click('#theme-toggle');
			await expect(p.locator('.icon-moon')).toBeVisible();
			await expect(p.locator('.icon-sun')).toBeHidden();
		});

		test(`can toggle theme on ${page}`, async ({ page: p }) => {
			await p.goto(page);
			expect(await p.locator('html').getAttribute('data-theme')).toBe('dark');
			await p.click('#theme-toggle');
			expect(await p.locator('html').getAttribute('data-theme')).toBe('light');
			await p.click('#theme-toggle');
			expect(await p.locator('html').getAttribute('data-theme')).toBe('dark');
		});
	}

	test('theme persists across navigation', async ({ page: p }) => {
		await p.goto('/');
		await p.click('#theme-toggle');
		expect(await p.locator('html').getAttribute('data-theme')).toBe('light');
		await p.click('a[href="/blog"]');
		await p.waitForURL('/blog');
		await p.waitForFunction(() => document.documentElement.getAttribute('data-theme') !== null);
		expect(await p.locator('html').getAttribute('data-theme')).toBe('light');
	});
});
