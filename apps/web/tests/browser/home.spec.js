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
  await expect(page.getByLabel('Nội dung bài viết')).toBeVisible();
  await expect(page.getByLabel('Tiêu đề')).toHaveCount(0);
  await page.getByLabel('Nội dung bài viết').fill('A Facebook-style status without a title');
  await expect(page.getByRole('button', { name: 'Đăng bài' })).toBeEnabled();
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
  const message = 'Reaction UI regression ' + suffix;
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('zen_token', token);
    localStorage.setItem('zen_user', JSON.stringify(user));
  }, { token, user: account.user });

  const create = await request.post('/api/baiviet', {
    headers: { Authorization: 'Bearer ' + token },
    data: { noiDung: message + ' — temporary post for reaction E2E test' },
  });
  expect(create.status()).toBe(201);
  const created = await create.json();
  const postId = created.id;
  const post = () => page.locator('.zs-post-card').filter({ hasText: message });
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

test('Post Control Center edits, pins, saves, hides and restores posts', async ({ page, request }) => {
  const errors = collectErrors(page);
  const stamp = Date.now().toString(36);
  const pass = 'PostControls_123!_' + stamp;
  async function createAccount(name) {
    const response = await request.post('/api/DangKy', { data: {
      username: name, email: name+'@example.test', password: pass, confirmPassword: pass,
    } });
    expect(response.status()).toBe(201);
    return response.json();
  }
  const mine = await createAccount('owner_'+stamp);
  const peer = await createAccount('peer_'+stamp);
  const headers = (session) => ({Authorization:'Bearer '+session.token});
  const myText = 'Post control owner '+stamp;
  const peerText = 'Post control peer '+stamp;
  async function create(session, text) {
    const response=await request.post('/api/baiviet', {
      headers: headers(session), data: {noiDung:text},
    });
    expect(response.status()).toBe(201);
    return (await response.json()).id;
  }
  const peerId=await create(peer,peerText);
  const mineId=await create(mine,myText);
  await page.addInitScript(({token,user})=>{
    localStorage.setItem('zen_token',token);
    localStorage.setItem('zen_user',JSON.stringify(user));
  },{token:mine.token,user:mine.user});
  const minePost=()=>page.locator('.zs-post-card').filter({hasText:myText});
  const peerPost=()=>page.locator('.zs-post-card').filter({hasText:peerText});
  const menuFor=(post)=>post.getByRole('button',{name:'Tùy chọn bài viết'});
  try {
    await page.goto('/');
    await expect(minePost()).toBeVisible();
    await menuFor(minePost()).click();
    await minePost().getByRole('button',{name:'Chỉnh sửa bài viết'}).click();
    const dialog=page.getByRole('dialog',{name:'Chỉnh sửa bài viết'});
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Nội dung bài viết').fill(myText+' edited');
    await dialog.getByRole('button',{name:'Lưu thay đổi'}).click();
    await expect(dialog).not.toBeVisible();
    await expect(minePost()).toContainText('edited');

    await menuFor(minePost()).click();
    await minePost().getByRole('button',{name:'Ghim trên trang cá nhân'}).click();
    await expect(minePost()).toContainText('Đã ghim');

    await menuFor(minePost()).click();
    await minePost().getByRole('button',{name:'Lưu bài viết'}).click();
    await page.goto('/saved');
    await expect(minePost()).toBeVisible();
    await menuFor(minePost()).click();
    await expect(minePost().getByRole('button',{name:'Bỏ lưu bài viết'})).toBeVisible();
    await minePost().getByRole('button',{name:'Bỏ lưu bài viết'}).click();
    await expect(minePost()).toHaveCount(0);

    await page.goto('/');
    await expect(peerPost()).toBeVisible();
    await menuFor(peerPost()).click();
    await peerPost().getByRole('button',{name:'Ẩn khỏi bảng tin của tôi'}).click();
    await expect(peerPost()).toHaveCount(0);
    await page.getByRole('button',{name:'Hoàn tác'}).click();
    await expect(peerPost()).toBeVisible();

    // The author may pin, but another account cannot take over that permission.
    const forbidden=await request.put('/api/v1/posts/'+mineId+'/pin', {headers:headers(peer)});
    expect(forbidden.status()).toBe(403);
    expect(errors).toEqual([]);
  } finally {
    await request.delete('/api/baiviet/'+mineId,{headers:headers(mine)});
    await request.delete('/api/baiviet/'+peerId,{headers:headers(peer)});
  }
});

test('Sprint 2: report, block, unblock, comment moderation and admin review', async ({ page, request, browser }) => {
  const errors=collectErrors(page);
  const tag=Date.now().toString(36),password='SafetyRegression_123!'+tag;
  async function signup(name) {
    const r=await request.post('/api/DangKy',{data:{username:name,email:name+'@example.test',password,confirmPassword:password}});
    expect(r.status()).toBe(201);return r.json();
  }
  const owner=await signup('safety_owner_'+tag), viewer=await signup('safety_viewer_'+tag);
  const headers=(a)=>({Authorization:'Bearer '+a.token});
  const body='Social safety regression '+tag;
  const created=await request.post('/api/baiviet',{headers:headers(owner),data:{noiDung:body}});
  expect(created.status()).toBe(201);const postId=(await created.json()).id;
  const authorId=owner.user.id;
  const post=()=>page.locator('.zs-post-card').filter({hasText:body});
  await page.addInitScript(({token,user})=>{
    localStorage.setItem('zen_token',token);localStorage.setItem('zen_user',JSON.stringify(user));
  },{token:viewer.token,user:viewer.user});
  const ownerContext=await browser.newContext();
  const ownerPage=await ownerContext.newPage();
  await ownerPage.addInitScript(({token,user})=>{
    localStorage.setItem('zen_token',token);localStorage.setItem('zen_user',JSON.stringify(user));
  },{token:owner.token,user:owner.user});
  try {
    await page.goto('/');
    await expect(post()).toBeVisible();
    await post().getByRole('button',{name:'Tùy chọn bài viết'}).click();
    await post().getByRole('button',{name:'Báo cáo bài viết'}).click();
    const dialog=page.getByRole('dialog',{name:'Báo cáo bài viết'});
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Lý do báo cáo').selectOption('spam');
    await dialog.getByLabel('Mô tả thêm (tùy chọn)').fill('Test moderation queue');
    await dialog.getByRole('button',{name:'Gửi báo cáo'}).click();
    await expect(page.getByText('Báo cáo đã được chuyển đến quản trị viên.')).toBeVisible();

    await post().getByRole('button',{name:'Tùy chọn bài viết'}).click();
    await post().getByRole('button',{name:'Chặn tác giả'}).click();
    await expect(post()).toHaveCount(0);
    await page.goto('/blocked');
    await expect(page.locator('.zs-safety-item').getByText(owner.user.tenDangNhap)).toBeVisible();
    await page.getByRole('button',{name:'Bỏ chặn'}).click();
    await page.goto('/');
    await expect(post()).toBeVisible();

    await ownerPage.goto('/posts/'+postId);
    const ownMenu=ownerPage.getByRole('button',{name:'Tùy chọn bài viết'});
    await ownMenu.click();
    await ownerPage.getByRole('button',{name:'Tắt bình luận'}).click();
    await expect(ownerPage.getByText('Tác giả đã tắt bình luận cho bài viết này.')).toBeVisible();
    await ownerPage.reload();
    await expect(ownerPage.getByText('Tác giả đã tắt bình luận cho bài viết này.')).toBeVisible();
    await ownMenu.click();
    await ownerPage.getByRole('button',{name:'Bật bình luận'}).click();
    await expect(ownerPage.getByPlaceholder('Viết bình luận...')).toBeVisible();

    const adminResponse=await request.post('/api/DangNhap',{data:{TenDangNhap:'admin',MatKhau:'ZenSpaceDemo123!'}});
    expect(adminResponse.ok()).toBeTruthy();
    const admin=await adminResponse.json();
    const adminContext=await browser.newContext();
    const adminPage=await adminContext.newPage();
    await adminPage.addInitScript(({token,user})=>{
      localStorage.setItem('zen_token',token);localStorage.setItem('zen_user',JSON.stringify(user));
    },{token:admin.token,user:admin.user});
    try {
      await adminPage.goto('/moderation');
      await expect(adminPage.getByRole('heading',{name:'Trung tâm kiểm duyệt'})).toBeVisible();
      const card=adminPage.locator('.zs-report-card').filter({hasText:'Test moderation queue'});
      await expect(card).toBeVisible();
      await card.getByRole('button',{name:'Bỏ qua'}).click();
      await expect(card).toHaveCount(0);
    } finally { await adminContext.close(); }
    expect(errors).toEqual([]);
  } finally {
    await request.delete('/api/baiviet/'+postId,{headers:headers(owner)});
    await ownerContext.close();
  }
});
