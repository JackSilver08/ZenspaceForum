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

test('selected reaction appears, survives reload, switches and toggles off', async ({ page, request }) => {
  const errors = collectErrors(page);
  const suffix = Date.now().toString(36);
  const password = 'TestOnly_Reaction_123!';
  const username = 'reaction_' + suffix;
  const signup = await request.post('/api/DangKy', { data: {
    username, email: username + '@example.test', password, confirmPassword: password,
  } });
  expect(signup.status()).toBe(201);
  const account = await signup.json();
  const token = account.token;
  const title = 'Reaction UI regression ' + suffix;
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('zen_token', token);
    localStorage.setItem('zen_user', JSON.stringify(user));
  }, { token, user: account.user });

  const create = await request.post('/api/baiviet', {
    headers: { Authorization: 'Bearer ' + token },
    data: { tieuDe: title, noiDung: 'Temporary post for reaction E2E test' },
  });
  expect(create.status()).toBe(201);
  const created = await create.json();
  const postId = created.id;
  const post = () => page.locator('.zs-post-card').filter({ hasText: title });
  const trigger = () => post().locator('.zs-reaction-trigger');

  async function choose(label) {
    await trigger().click();
    await post().getByRole('group', { name: 'Chọn cảm xúc' })
      .getByRole('button', { name: new RegExp(label) }).click();
  }

  try {
    await page.goto('/');
    await expect(post()).toBeVisible();
    await choose('Bất ngờ');
    await expect(trigger()).toContainText('Bất ngờ');
    await expect(trigger()).toHaveClass(/is-reacted/);
    await page.reload();
    await expect(trigger()).toContainText('Bất ngờ');
    await choose('Yêu thích');
    await expect(trigger()).toContainText('Yêu thích');
    await page.reload();
    await expect(trigger()).toContainText('Yêu thích');
    await choose('Yêu thích');
    await expect(trigger()).toContainText('Cảm xúc');
    await expect(trigger()).not.toHaveClass(/is-reacted/);
    await page.reload();
    await expect(trigger()).toContainText('Cảm xúc');

    const mine = await request.get('/api/camxuc/cua-toi?ids=' + postId, {
      headers: { Authorization: 'Bearer ' + token },
    });
    expect(mine.status()).toBe(200);
    expect((await mine.json()).data).toEqual({});
    expect(errors).toEqual([]);
  } finally {
    await request.delete('/api/baiviet/' + postId, {
      headers: { Authorization: 'Bearer ' + token },
    });
  }
});
