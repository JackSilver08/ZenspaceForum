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

test('Sprint 3: minimal composer, privacy, edit history, archive and trash on desktop/mobile',async({page,request})=>{
 const errors=collectErrors(page),tag=Date.now().toString(36);
 const name='life_'+tag,password='Test_Complex_123!'+tag;
 const reg=await request.post('/api/DangKy',{data:{username:name,email:name+'@example.test',password,confirmPassword:password}});
 expect(reg.status()).toBe(201);
 const session=await reg.json();const headers={Authorization:'Bearer '+session.token};
 await page.addInitScript(({token,user})=>{
  localStorage.setItem('zen_token',token);
  localStorage.setItem('zen_user',JSON.stringify(user));
 },{token:session.token,user:session.user});
 let postId;
 const content='Creative ZenSpace story '+tag;
 const post=()=>page.locator('.zs-post-card').filter({hasText:content});
 try{
  await page.goto('/');
  await page.getByRole('button',{name:'Bạn đang nghĩ gì?'}).click();
  const dialog=page.getByRole('dialog',{name:'Bài viết mới'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Hủy'})).toHaveCount(0);
  await expect(dialog.getByRole('button',{name:'Đóng'})).toHaveCount(1);
  const editor=dialog.getByRole('textbox',{name:'Nội dung bài viết'});
  await editor.click();
  const editorVisuals=await editor.evaluate(el=>{
    const style=getComputedStyle(el);
    return {outline:style.outlineStyle,border:style.borderTopStyle,shadow:style.boxShadow};
  });
  expect(editorVisuals.outline).toBe('none');
  expect(editorVisuals.shadow).toBe('none');
  await expect(dialog.getByText('Không gian của bạn, câu chuyện của bạn.')).toHaveCount(0);
  await dialog.getByLabel('Đối tượng xem').selectOption('private');
  await dialog.getByRole('button',{name:'Chèn emoji'}).click();
  await dialog.getByRole('group',{name:'Chọn emoji'}).getByRole('button',{name:'✨'}).click();
  await dialog.getByLabel('Nội dung bài viết').fill(content);
  await dialog.getByRole('button',{name:'Đăng bài'}).click();
  await expect(dialog).not.toBeVisible();
  await expect(post()).toBeVisible();
  await expect(post()).toContainText('Chỉ mình tôi');
  const row=post();
  const menu=()=>row.getByRole('button',{name:'Tùy chọn bài viết'});
  await menu().click();
  await expect(row.getByRole('button',{name:'Lịch sử chỉnh sửa'})).toBeVisible();
  await row.getByRole('button',{name:'Chỉnh sửa bài viết'}).click();
  await page.getByRole('dialog',{name:'Chỉnh sửa bài viết'}).getByLabel('Nội dung bài viết').fill(content+' edited');
  await page.getByRole('button',{name:'Lưu thay đổi'}).click();
  await expect(row).toContainText('edited');
  await menu().click();
  await row.getByRole('button',{name:'Lịch sử chỉnh sửa'}).click();
  await expect(page.getByRole('dialog',{name:'Lịch sử chỉnh sửa'})).toContainText(content);
  await page.getByRole('button',{name:'Đóng lịch sử'}).click();
  await menu().click();
  await row.getByRole('button',{name:'Lưu trữ bài viết'}).click();
  await expect(row).toHaveCount(0);
  await page.goto('/archive');
  await expect(page.locator('.zs-managed-post').filter({hasText:content})).toBeVisible();
  await page.locator('.zs-managed-post').filter({hasText:content}).getByRole('button',{name:'Khôi phục'}).click();
  await page.goto('/');
  await expect(row).toBeVisible();
  await menu().click();
  page.once('dialog',d=>d.accept());
  await row.getByRole('button',{name:'Chuyển vào thùng rác'}).click();
  await expect(row).toHaveCount(0);
  await page.goto('/trash');
  const trashed=page.locator('.zs-managed-post').filter({hasText:content});
  await expect(trashed).toBeVisible();
  await expect(trashed).toContainText('Hạn xóa:');
  await trashed.getByRole('button',{name:'Khôi phục'}).click();
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.getByRole('button',{name:'Bạn đang nghĩ gì?'}).click();
  await expect(page.getByRole('dialog',{name:'Bài viết mới'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const mobileComposer=page.getByRole('dialog',{name:'Bài viết mới'});
  await expect(mobileComposer.getByRole('button',{name:'Hủy'})).toHaveCount(0);
  await mobileComposer.getByRole('button',{name:'Đóng'}).click();
  await expect(mobileComposer).not.toBeVisible();
  expect(errors).toEqual([]);
 }finally{
  const list=await request.get('/api/v1/feed/public',{headers});
  if(list.ok()){const data=await list.json();postId=data.data?.find(p=>p.noiDung.includes(content))?.id;}
  if(postId){
   await request.delete('/api/baiviet/'+postId,{headers});
   await request.delete('/api/v1/posts/'+postId+'/permanent',{headers});
  }
 }
});

test('Post media stays inside Feed and Profile cards for portrait and landscape images', async ({page}) => {
  await page.goto('/');
  for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
    await page.setViewportSize(viewport);
    const metrics=await page.evaluate(async()=>{
      const host=document.querySelector('.zs-main');
      if(!host)throw Error('Main content container missing');
      const fixture=document.createElement('div');
      fixture.id='zs-media-regression';
      const specs=[
        {name:'feed-portrait',css:'zs-post-card',media:'zs-post-media',w:600,h:960},
        {name:'feed-landscape',css:'zs-post-card',media:'zs-post-media',w:1280,h:720},
        {name:'profile-portrait',css:'card post p-3 mb-3',media:'zs-post-media zs-post-media--profile',w:600,h:960},
        {name:'profile-landscape',css:'card post p-3 mb-3',media:'zs-post-media zs-post-media--profile',w:1280,h:720}
      ];
      const promises=specs.map(item=>new Promise((resolve,reject)=>{
        const card=document.createElement('article');
        card.className=item.css;
        const stage=document.createElement('div');
        stage.className=item.media;
        const img=document.createElement('img');
        img.alt=item.name;
        img.onload=()=>resolve({item,card,stage,img});
        img.onerror=()=>reject(Error('SVG layout fixture failed: '+item.name));
        stage.append(img);card.append(stage);fixture.append(card);
        img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="'+item.w+'" height="'+item.h+
          '" viewBox="0 0 '+item.w+' '+item.h+'"><rect width="100%" height="100%" fill="#a9bbd1"/></svg>'
        );
      }));
      host.append(fixture);
      try{
        const loaded=await Promise.all(promises);
        return loaded.map(({item,card,stage,img})=>{
          const c=card.getBoundingClientRect(),s=stage.getBoundingClientRect(),i=img.getBoundingClientRect();
          return {name:item.name,cardWidth:c.width,stageWidth:s.width,imageWidth:i.width,imageHeight:i.height,
            imageRatio:i.width/i.height,originalRatio:item.w/item.h,
            cardRight:c.right,stageRight:s.right,imageRight:i.right,
            stageBackground:getComputedStyle(stage).backgroundColor,
            centeredOffset:Math.abs((i.left-s.left)-(s.right-i.right)),
            bodyOverflow:document.documentElement.scrollWidth>window.innerWidth+1};
        });
      }finally{fixture.remove()}
    });
    for (const box of metrics){
      expect(box.stageWidth,box.name+' stage must fit its card').toBeLessThanOrEqual(box.cardWidth+1);
      expect(box.stageRight,box.name+' stage must not cross card').toBeLessThanOrEqual(box.cardRight+1);
      expect(box.imageRight,box.name+' image must not cross stage').toBeLessThanOrEqual(box.stageRight+1);
      expect(box.imageWidth,box.name+' image must fit container').toBeLessThanOrEqual(box.stageWidth+1);
      expect(box.imageHeight,box.name+' image must have bounded height').toBeLessThanOrEqual(561);
      expect(Math.abs(box.imageRatio-box.originalRatio),box.name+' ratio must be preserved').toBeLessThan(0.02);
      expect(box.centeredOffset,box.name+' image should be centered').toBeLessThan(2);
      expect(box.stageBackground,box.name+' should not show gray side gutters').toBe('rgba(0, 0, 0, 0)');
      expect(box.bodyOverflow,box.name+' should not cause horizontal page overflow').toBe(false);
    }
  }
});

test('Nebula Pearl member discovery opens a real profile with post and media tabs', async ({ page }) => {
  await page.goto('/explore');
  await expect(page.getByRole('heading', { name: 'Khám phá thành viên' })).toBeVisible();
  const member = page.locator('.zs-member-card').first();
  await expect(member).toBeVisible();
  await member.getByRole('link', { name: 'Xem hồ sơ' }).click();
  await expect(page.locator('.zs-profile-hero')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bài viết' })).toBeVisible();
  const mediaTab = page.getByRole('button', { name: 'Ảnh & video' });
  await mediaTab.click();
  await expect(mediaTab).toHaveClass(/is-active/);
  await expect(page.locator('.zs-profile-feed')).toBeVisible();
});

test('comment threads: reply, like, edit, and three-dot moderation permissions', async ({ page,request,browser }) => {
  const errors=collectErrors(page);
  const stamp=Date.now().toString(36);
  const password='CommentThread_123!'+stamp;
  async function signup(prefix) {
    const username=prefix+'_'+stamp;
    const result=await request.post('/api/DangKy',{data:{
      username,email:username+'@example.test',password,confirmPassword:password
    }});
    expect(result.status()).toBe(201);
    return result.json();
  }
  const owner=await signup('thread_owner'),viewer=await signup('thread_peer');
  const headers=session=>({Authorization:'Bearer '+session.token});
  const created=await request.post('/api/baiviet',{headers:headers(owner),data:{noiDung:'Comment thread '+stamp}});
  expect(created.status()).toBe(201);
  const postId=(await created.json()).id;
  const seed=await request.post('/api/binhluan',{headers:headers(owner),data:{idBaiDang:postId,noiDung:'First message '+stamp}});
  expect(seed.status()).toBe(201);
  const parentId=(await seed.json()).id;
  await page.addInitScript(({token,user})=>{
    localStorage.setItem('zen_token',token);
    localStorage.setItem('zen_user',JSON.stringify(user));
  },{token:viewer.token,user:viewer.user});
  const peerContext=await browser.newContext();
  const ownerPage=await peerContext.newPage();
  await ownerPage.addInitScript(({token,user})=>{
    localStorage.setItem('zen_token',token);
    localStorage.setItem('zen_user',JSON.stringify(user));
  },{token:owner.token,user:owner.user});
  try{
    await page.goto('/posts/'+postId);
    await expect(page.getByRole('heading',{name:'Chi tiết bài viết'})).toBeVisible();
    const root=page.locator('#comment-'+parentId);
    await expect(root).toBeVisible();
    await root.getByRole('button',{name:'Thích'}).click();
    await expect(root.getByRole('button',{name:/Đã thích · 1/})).toBeVisible();
    await root.getByRole('button',{name:'Trả lời'}).click();
    await expect(page.getByText('Đang trả lời')).toBeVisible();
    await page.getByPlaceholder('Viết bình luận...').fill('Reply message '+stamp);
    await page.getByRole('button',{name:'Gửi trả lời'}).click();
    const reply=page.locator('.zs-comment--reply').first(); // Stable when the editor replaces comment text
    await expect(reply).toBeVisible();
    await reply.getByRole('button',{name:/Tùy chọn bình luận/}).click();
    await expect(reply.getByRole('button',{name:'Sửa bình luận'})).toBeVisible();
    await expect(root.getByRole('button',{name:/Tùy chọn bình luận/})).toBeVisible();
    await root.getByRole('button',{name:/Tùy chọn bình luận/}).click();
    await expect(root.getByRole('button',{name:'Xóa bình luận'})).toHaveCount(0);
    await expect(root.getByRole('button',{name:'Sửa bình luận'})).toHaveCount(0);

    await reply.getByRole('button',{name:/Tùy chọn bình luận/}).click();
    await reply.getByRole('button',{name:'Sửa bình luận'}).click();
    await reply.getByLabel('Chỉnh sửa bình luận').fill('Edited reply '+stamp);
    await reply.getByRole('button',{name:'Lưu thay đổi'}).click();
    await expect(page.getByText('Edited reply '+stamp)).toBeVisible();
    await expect(reply.getByText('Đã chỉnh sửa')).toBeVisible();

    await ownerPage.goto('/posts/'+postId);
    const ownComment=ownerPage.locator('#comment-'+parentId);
    await ownComment.getByRole('button',{name:/Tùy chọn bình luận/}).click();
    await expect(ownComment.getByRole('button',{name:'Sửa bình luận'})).toBeVisible();
    await expect(ownComment.getByRole('button',{name:'Xóa bình luận'})).toBeVisible();
    const notOwner=await request.put('/api/binhluan/'+parentId,{headers:headers(viewer),data:{noiDung:'unauthorized edit'}});
    expect(notOwner.status()).toBe(403);
    const commentsResponse=await request.get('/api/binhluan/'+postId,{headers:headers(viewer)});
    expect(commentsResponse.ok()).toBeTruthy();
    const comments=await commentsResponse.json();
    expect(comments.find(c=>c.id===parentId).likeCount).toBe(1);
    expect(comments.some(c=>c.parentId===parentId&&c.noiDung==='Edited reply '+stamp)).toBeTruthy();
    expect(errors).toEqual([]);
  }finally{
    await peerContext.close();
    await request.delete('/api/baiviet/'+postId,{headers:headers(owner)});
    await request.delete('/api/v1/posts/'+postId+'/permanent',{headers:headers(owner)});
  }
});
