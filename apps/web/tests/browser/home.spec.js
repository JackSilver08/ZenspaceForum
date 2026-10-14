import { test, expect } from '@playwright/test';

function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('home feed mounts React and loads real MySQL posts', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bảng tin', level: 1 })).toBeVisible();
  await expect(page.locator('.zs-post-card').first()).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Điều hướng' })).toBeVisible();
  expect(errors, 'No uncaught browser runtime errors, including undefined JSX icons').toEqual([]);
});

test('Explore and Login routes render without JavaScript exceptions', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/explore');
  await expect(page.getByRole('heading', { name: 'Khám phá thành viên' })).toBeVisible();
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('authenticated home and following feed render; compose expands', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/login');
  await page.getByPlaceholder('Tên đăng nhập').fill('admin');
  await page.getByPlaceholder('Mật khẩu').fill('ZenSpaceDemo123!');
  await page.locator('form.auth').getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Bảng tin', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Bạn đang nghĩ gì?' }).click();
  await expect(page.getByLabel('Tiêu đề', { exact: true })).toBeVisible();
  await page.goto('/following');
  await expect(page.getByRole('heading', { name: 'Đang theo dõi', level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});

test('mobile layout still renders a feed and bottom navigation', async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bảng tin', level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Điều hướng trên điện thoại' })).toBeVisible();
  const bodyWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(bodyWidth).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});
