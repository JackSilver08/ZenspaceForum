import { test, expect } from '@playwright/test';

async function signedIn(page, request, suffix) {
  const username = 'hub_' + suffix + '_' + Date.now().toString(36);
  const password = 'SettingsHub_123!';
  const response = await request.post('/api/DangKy', {data: {
    username, email: username + '@example.test', password, confirmPassword: password
  }});
  expect(response.status()).toBe(201);
  const session = await response.json();
  await page.addInitScript(({token, user}) => {
    localStorage.setItem('zen_token', token);
    localStorage.setItem('zen_user', JSON.stringify(user));
  }, {token: session.token, user: session.user});
  return session;
}

for (const width of [1440, 1024, 820, 390]) {
  test('Settings Hub navigation and responsive cards at ' + width + 'px', async ({page, request}) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await signedIn(page, request, String(width));
    await page.setViewportSize({width, height:900});
    await page.goto('/');
    await page.evaluate(() => { window.__spaMarker = 'no-reload'; });

    const desktop = width > 767;
    const settingsNav = desktop
      ? page.locator('.zs-sidebar-settings a[href="/settings"]')
      : page.locator('.zs-mobile-nav a[href="/settings"]');
    await expect(settingsNav).toBeVisible();
    if (desktop) {
      const entries = page.locator('.zs-side-nav a');
      await expect(entries).toHaveCount(2);
      await expect(page.locator('.zs-sidebar-footer')).toHaveCount(0);
      await expect(page.locator('.zs-side-nav a[href="/explore"]')).toHaveCount(0);
    }

    await settingsNav.click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('heading', {name:'Cài đặt',level:1})).toBeVisible();
    await expect(page.locator('.zs-settings-card')).toHaveCount(5);
    const expected = width >= 1024 ? 3 : width >= 768 ? 2 : 1;
    const columns = await page.locator('.zs-settings-grid').evaluate(el =>
      getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length);
    expect(columns).toBe(expected);

    await page.locator('.zs-settings-card[href="/saved"]').click();
    await expect(page).toHaveURL(/\/saved$/);
    await expect(settingsNav).toHaveClass(/is-active/);
    expect(await page.evaluate(() => window.__spaMarker)).toBe('no-reload');
    await settingsNav.click();
    await page.locator('.zs-settings-card[href="/following"]').click();
    await expect(page).toHaveURL(/\/following$/);
    await settingsNav.click();
    for (const route of ['/archive','/trash','/blocked']) {
      await page.locator('.zs-settings-card[href="' + route + '"]').click();
      await expect(page).toHaveURL(new RegExp(route + '$'));
      await settingsNav.click();
    }
    expect(await page.evaluate(() => window.__spaMarker)).toBe('no-reload');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 2);
    expect(errors).toEqual([]);
  });
}

test('Search Palette supports Ctrl/Meta K, keyboard navigation and legacy /explore', async ({page,request}) => {
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await signedIn(page,request,'searcher');
  const username = 'palette_target_' + Date.now().toString(36);
  const password = 'SearchPalette_123!';
  const created = await request.post('/api/DangKy', {data:{
    username, email:username+'@example.test', password,confirmPassword:password
  }});
  expect(created.status()).toBe(201);
  const target = await created.json();
  await page.goto('/');
  await page.getByRole('button',{name:'Tìm kiếm thành viên'}).click();
  const dialog=page.getByRole('dialog',{name:'Khám phá ZenSpace'});
  await expect(dialog).toBeVisible();
  const search=dialog.getByRole('combobox',{name:'Tìm kiếm thành viên'});
  await expect(search).toBeFocused();
  await search.fill(target.user.tenDangNhap);
  const option=dialog.getByRole('option').filter({hasText:target.user.tenDangNhap});
  await expect(option).toBeVisible();
  await search.press('ArrowDown');
  await search.press('ArrowUp');
  await search.press('Enter');
  await expect(page).toHaveURL(new RegExp('/users/' + target.user.id + '$'));
  await expect(dialog).toHaveCount(0);

  await page.keyboard.press('Control+k');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.keyboard.press('Meta+k');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:'Đóng tìm kiếm'}).click();
  await expect(dialog).toHaveCount(0);

  await page.goto('/explore');
  await expect(page).toHaveURL(/\/$/);
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Search remains reachable on mobile without sidebar Explore', async ({page,request}) => {
  await signedIn(page,request,'mobile');
  await page.setViewportSize({width:390,height:844});
  await page.goto('/messages');
  await page.locator('.zs-mobile-nav button[aria-label="Tìm kiếm"]').click();
  const dialog=page.getByRole('dialog',{name:'Khám phá ZenSpace'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox',{name:'Tìm kiếm thành viên'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(392);
});

test('Moderation card is only visible for administrators', async ({page}) => {
  await page.goto('/login');
  await page.getByPlaceholder('Tên đăng nhập').fill('admin');
  await page.getByPlaceholder('Mật khẩu').fill('ZenSpaceDemo123!');
  await page.locator('form.auth').getByRole('button',{name:'Đăng nhập'}).click();
  await page.locator('.zs-sidebar-settings a[href="/settings"]').click();
  await expect(page.locator('.zs-settings-card[href="/moderation"]')).toBeVisible();
  await expect(page.locator('.zs-settings-card')).toHaveCount(6);
});
