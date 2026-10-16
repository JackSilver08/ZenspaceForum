import { test, expect } from '@playwright/test';

test('Messenger: search by name, start conversation, send and receive, mobile navigation', async ({page, request}) => {
  const stamp=Date.now().toString(36);
  const password='Messenger_123!_'+stamp;
  async function account(prefix) {
    const username=prefix+'_'+stamp;
    const r=await request.post('/api/DangKy',{data:{
      username,email:username+'@example.test',password,confirmPassword:password
    }});
    expect(r.status()).toBe(201);
    return r.json();
  }
  const mine=await account('messenger_sender');
  const peer=await account('messenger_friend');
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({token,user})=>{
    localStorage.setItem('zen_token',token);
    localStorage.setItem('zen_user',JSON.stringify(user));
  },{token:mine.token,user:mine.user});
  await page.goto('/messages');
  await expect(page.getByRole('heading',{name:'Tin nhắn'})).toBeVisible();
  await expect(page.getByText('Chào mừng đến với')).toBeVisible();
  await expect(page.locator('#zs-peer-id')).toHaveCount(0);
  await page.getByRole('button',{name:'Bắt đầu cuộc trò chuyện mới'}).click();
  await page.getByRole('searchbox',{name:'Tìm kiếm hội thoại hoặc thành viên'}).fill(peer.user.tenDangNhap);
  await expect(page.locator('.zs-messenger-person').filter({hasText:peer.user.tenDangNhap})).toBeVisible();
  await page.locator('.zs-messenger-person').filter({hasText:peer.user.tenDangNhap}).click();
  await expect(page.locator('.zs-messenger-conversation-header')).toContainText(peer.user.tenDangNhap);
  const editor=page.getByRole('textbox',{name:'Nội dung tin nhắn'});
  await editor.fill('Lời chào từ ZenSpace '+stamp);
  await editor.press('Enter');
  const outgoing=page.locator('.zs-messenger-bubble-row.is-own .zs-messenger-bubble');
  await expect(outgoing).toContainText('Lời chào từ ZenSpace '+stamp);
  await expect(page.locator('.zs-messenger-person').filter({hasText:peer.user.tenDangNhap})).toBeVisible();
  await page.reload();
  await expect(page.locator('.zs-messenger-conversation-header')).toContainText(peer.user.tenDangNhap);
  await expect(outgoing).toContainText('Lời chào từ ZenSpace '+stamp);
  const reply=await request.post('/api/chat/gui',{headers:{Authorization:'Bearer '+peer.token},
    data:{nguoiNhanID:mine.user.id,noiDung:'Hồi âm '+stamp}});
  expect(reply.status()).toBe(201);
  await page.getByRole('button',{name:'Làm mới tin nhắn'}).click();
  await expect(page.locator('.zs-messenger-bubble-row:not(.is-own) .zs-messenger-bubble')).toContainText('Hồi âm '+stamp);
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.zs-messenger-conversation')).toBeVisible();
  await expect(page.locator('.zs-messenger-list')).toBeHidden();
  await page.getByRole('button',{name:'Quay lại danh sách hội thoại'}).click();
  await expect(page.locator('.zs-messenger-list')).toBeVisible();
  await expect(page.locator('.zs-messenger-conversation')).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});
