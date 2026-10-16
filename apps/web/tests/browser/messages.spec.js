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
  await expect(page.getByRole('button',{name:/Làm mới (hội thoại|tin nhắn)/})).toHaveCount(0);
  await expect(page.getByText('Chào mừng đến với')).toBeVisible();
  await expect(page.locator('#zs-peer-id')).toHaveCount(0);
  await page.getByRole('button',{name:'Bắt đầu cuộc trò chuyện mới'}).click();
  await page.getByRole('searchbox',{name:'Tìm kiếm hội thoại hoặc thành viên'}).fill(peer.user.tenDangNhap);
  await expect(page.locator('.zs-messenger-person').filter({hasText:peer.user.tenDangNhap})).toBeVisible();
  await page.locator('.zs-messenger-person').filter({hasText:peer.user.tenDangNhap}).click();
  await expect(page.locator('.zs-messenger-conversation-header')).toContainText(peer.user.tenDangNhap);
  await expect(page.getByRole('button',{name:/Làm mới (hội thoại|tin nhắn)/})).toHaveCount(0);
  const editor=page.getByRole('textbox',{name:'Nội dung tin nhắn'});
  await editor.fill('Lời chào từ ZenSpace '+stamp);
  await editor.press('Enter');
  const outgoing=page.locator('.zs-messenger-bubble-row.is-own .zs-messenger-bubble');
  await expect(outgoing).toContainText('Lời chào từ ZenSpace '+stamp);
  await expect(page.locator('.zs-messenger-person').filter({hasText:peer.user.tenDangNhap})).toBeVisible();
  await page.reload();
  await expect(page.locator('.zs-messenger-conversation-header')).toContainText(peer.user.tenDangNhap);
  await expect(outgoing).toContainText('Lời chào từ ZenSpace '+stamp);
  // The recipient already has an authenticated WebSocket connection.
  // HTTP sent by another account must appear without clicking Refresh.
  await expect(page.locator('.zs-messenger-chat-person')).toContainText('Kết nối thời gian thực');
  const reply=await request.post('/api/chat/gui',{headers:{Authorization:'Bearer '+peer.token},
    data:{nguoiNhanID:mine.user.id,noiDung:'Hồi âm '+stamp}});
  expect(reply.status()).toBe(201);
  await expect(page.locator('.zs-messenger-bubble-row:not(.is-own) .zs-messenger-bubble')).toContainText('Hồi âm '+stamp);
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.zs-messenger-conversation')).toBeVisible();
  await expect(page.getByRole('button',{name:/Làm mới (hội thoại|tin nhắn)/})).toHaveCount(0);
  await expect(page.locator('.zs-messenger-list')).toBeHidden();
  await page.getByRole('button',{name:'Quay lại danh sách hội thoại'}).click();
  await expect(page.locator('.zs-messenger-list')).toBeVisible();
  await expect(page.locator('.zs-messenger-conversation')).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});


test('WebSocket pushes messages to two simultaneously logged-in browser sessions', async ({browser,request}) => {
  const stamp=Date.now().toString(36);
  const password='Websocket_123!_'+stamp;
  async function account(prefix) {
    const username=prefix+'_'+stamp;
    const r=await request.post('/api/DangKy',{data:{username,email:username+'@example.test',password,confirmPassword:password}});
    expect(r.status()).toBe(201);
    return r.json();
  }
  const alice=await account('realtime_alice');
  const bob=await account('realtime_bob');
  const makeContext=async session=>{
    const context=await browser.newContext();
    await context.addInitScript(({token,user})=>{
      localStorage.setItem('zen_token',token);
      localStorage.setItem('zen_user',JSON.stringify(user));
    },session);
    return context;
  };
  const aliceCtx=await makeContext(alice);
  const bobCtx=await makeContext(bob);
  try {
    const alicePage=await aliceCtx.newPage();
    const bobPage=await bobCtx.newPage();
    await Promise.all([
      alicePage.goto('/messages?user='+bob.user.id),
      bobPage.goto('/messages')
    ]);
    await expect(alicePage.locator('.zs-messenger-chat-person')).toContainText('Kết nối thời gian thực');
    // Wait for Bob's WebSocket to open by selecting Alice's chat.
    await bobPage.goto('/messages?user='+alice.user.id);
    await expect(bobPage.locator('.zs-messenger-chat-person')).toContainText('Kết nối thời gian thực');

    await alicePage.getByRole('textbox',{name:'Nội dung tin nhắn'}).fill('Realtime Alice '+stamp);
    await alicePage.getByRole('button',{name:'Gửi',exact:true}).click();
    await expect(bobPage.locator('.zs-messenger-bubble-row:not(.is-own) .zs-messenger-bubble'))
      .toContainText('Realtime Alice '+stamp);

    await bobPage.getByRole('textbox',{name:'Nội dung tin nhắn'}).fill('Realtime Bob '+stamp);
    await bobPage.getByRole('button',{name:'Gửi',exact:true}).click();
    await expect(alicePage.locator('.zs-messenger-bubble-row:not(.is-own) .zs-messenger-bubble'))
      .toContainText('Realtime Bob '+stamp);
  } finally {
    await aliceCtx.close();
    await bobCtx.close();
  }
});
