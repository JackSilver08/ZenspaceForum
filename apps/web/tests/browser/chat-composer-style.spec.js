import { test, expect } from '@playwright/test';

async function createAccount(request, prefix, nonce) {
  const username = prefix + '_' + nonce;
  const password = 'ComposerStyle_123!';
  const response = await request.post('/api/DangKy', {
    data: { username, email: username + '@example.test', password, confirmPassword: password }
  });
  expect(response.status()).toBe(201);
  return response.json();
}

for (const width of [1440, 820, 390]) {
  test('Chat composer CSS renders as compact rounded bar at ' + width + 'px', async ({ page, request }) => {
    const nonce = String(width) + '_' + Date.now().toString(36);
    const mine = await createAccount(request, 'composer_css', nonce);
    const recipient = await createAccount(request, 'composer_peer', nonce);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 880 });
    await page.addInitScript(({ token, user }) => {
      localStorage.setItem('zen_token', token);
      localStorage.setItem('zen_user', JSON.stringify(user));
    }, { token: mine.token, user: mine.user });

    await page.goto('/messages?user=' + recipient.user.id);
    const form = page.locator('form.zs-chat-composer');
    const line = form.locator('.zs-chat-input-line');
    const textarea = form.getByRole('textbox', { name: 'Nội dung tin nhắn' });
    const attach = form.getByRole('button', { name: 'Đính kèm tệp' });
    const emoji = form.getByRole('button', { name: 'Chọn emoji' });
    const send = form.getByRole('button', { name: 'Gửi' });
    const file = form.locator('input[type=file]');

    await expect(form).toBeVisible();
    await expect(line).toHaveCSS('display', 'flex');
    await expect(line).toHaveCSS('border-radius', '28px');
    await expect(textarea).toHaveCSS('resize', 'none');
    await expect(file).toHaveCSS('position', 'absolute');
    await expect(file).toHaveCSS('opacity', '0');
    await expect(attach).toHaveCSS('display', 'grid');
    await expect(emoji).toHaveCSS('display', 'grid');
    await expect(send).toHaveCSS('border-radius', '50%');
    await expect(form).toHaveCSS('background-color', 'rgb(255, 255, 255)');

    const geometry = await page.evaluate(() => {
      const rect = selector => {
        const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
        return { x, y, width, height };
      };
      return {
        form: rect('.zs-chat-composer'),
        line: rect('.zs-chat-input-line'),
        textarea: rect('#zs-message-text'),
        attach: rect('.zs-chat-tool'),
        file: rect('.zs-chat-file-input'),
        send: rect('.zs-chat-send'),
        viewportWidth: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });
    expect(geometry.form.width).toBeGreaterThan(width === 390 ? 290 : 400);
    expect(geometry.form.height).toBeLessThan(125);
    expect(geometry.line.height).toBeGreaterThanOrEqual(45);
    expect(geometry.line.height).toBeLessThan(75);
    expect(geometry.line.x).toBeGreaterThanOrEqual(0);
    expect(geometry.line.x + geometry.line.width).toBeLessThanOrEqual(width + 2);
    expect(geometry.textarea.x + geometry.textarea.width).toBeLessThan(geometry.attach.x + 2);
    expect(geometry.attach.x).toBeLessThan(geometry.send.x);
    expect(geometry.file.width).toBeLessThanOrEqual(2);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(width + 2);

    await emoji.click();
    const picker = form.locator('.zs-chat-emoji-picker');
    await expect(picker).toBeVisible();
    await expect(picker.locator('.zs-chat-emoji-grid')).toHaveCSS('display', 'grid');
    const pickerRect = await picker.boundingBox();
    expect(pickerRect.x).toBeGreaterThanOrEqual(-2);
    expect(pickerRect.x + pickerRect.width).toBeLessThanOrEqual(width + 2);
    expect(pickerRect.y).toBeGreaterThanOrEqual(-2);
    await picker.getByRole('button', { name: 'Thêm emoji 💙' }).click();
    await expect(textarea).toHaveValue('💙');

    await file.setInputFiles({
      name: 'sample.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('ZenSpace CSS visual regression'),
    });
    const preview = form.locator('.zs-chat-attachment-draft');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('sample.txt');
    await expect(preview).toHaveCSS('display', 'flex');
    await preview.getByRole('button', { name: 'Bỏ tệp đính kèm' }).click();
    await expect(preview).toHaveCount(0);
    await textarea.press('Enter');
    await expect(page.locator('.zs-messenger-bubble-row.is-own')).toContainText('💙');
    expect(errors).toEqual([]);
  });
}
