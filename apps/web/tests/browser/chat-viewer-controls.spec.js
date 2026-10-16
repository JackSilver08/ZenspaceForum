import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

const png=readFileSync(new URL('../fixtures/gallery-blue.png',import.meta.url));

async function account(request,prefix,stamp){
  const username=prefix+'_'+stamp;
  const response=await request.post('/api/DangKy',{data:{
    username,email:username+'@example.test',password:'GalleryControls_123!',confirmPassword:'GalleryControls_123!'
  }});
  expect(response.status()).toBe(201);
  return response.json();
}
async function login(page,session) {
  await page.addInitScript(({token,user})=>{
    localStorage.setItem('zen_token',token);
    localStorage.setItem('zen_user',JSON.stringify(user));
    Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
    Object.defineProperty(navigator,'share',{configurable:true,value:async ({files})=>{
      window.__zenSharedNames=files.map(file=>file.name);
    }});
  },{token:session.token,user:session.user});
}
async function sendAlbum(page,names){
  const composer=page.getByRole('form',{name:'Soạn tin nhắn'});
  await composer.locator('input[type=file]').setInputFiles(names.map(name=>({
    name,mimeType:'image/png',buffer:png
  })));
  const response=page.waitForResponse(response=>response.url().includes('/api/chat/attachments'));
  await composer.getByRole('button',{name:'Gửi'}).click();
  const upload=await response;
  expect(upload.status(),await upload.text()).toBe(201);
}

test('Viewer controls, mouse wheel navigation, private sharing and compact collage',async({page,request})=>{
  const stamp=Date.now().toString(36);
  const alice=await account(request,'viewer_alice',stamp);
  const bob=await account(request,'viewer_bob',stamp);
  const outsider=await account(request,'viewer_outsider',stamp);
  await login(page,alice);
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/messages?user='+bob.user.id);
  await sendAlbum(page,['one.png','two.png','three.png']);
  await sendAlbum(page,['four.png']);
  const rows=page.locator('.zs-messenger-bubble-row.is-own');
  await expect(rows).toHaveCount(2);
  const mosaic=rows.first().locator('.zs-chat-media-grid');
  await expect(mosaic).toHaveClass(/is-trio/);
  await expect(mosaic.locator('.zs-chat-media-tile')).toHaveCount(3);
  const sizes=await mosaic.locator('.zs-chat-media-tile').evaluateAll(items=>items.map(element=>{
    const {width,height}=element.getBoundingClientRect();
    return {width,height};
  }));
  expect(sizes.every(item=>Math.abs(item.width-item.height)<2&&item.width<125)).toBe(true);
  const single=rows.nth(1).locator('.zs-chat-media-grid');
  await expect(single).toHaveClass(/is-single/);
  const singleSize=await single.locator('.zs-chat-media-tile').boundingBox();
  expect(Math.abs(singleSize.width-singleSize.height)).toBeLessThan(2);
  expect(singleSize.width).toBeLessThanOrEqual(245);

  // Dedicated gallery includes all recent photo history and restricts access.
  const history=await request.get('/api/chat/media/'+bob.user.id,{
    headers:{Authorization:'Bearer '+alice.token}
  });
  expect(history.status()).toBe(200);
  const gallery=await history.json();
  expect(gallery.data.map(item=>item.name)).toEqual(['four.png','three.png','two.png','one.png']);
  expect(gallery.hasMore).toBe(false);
  expect((await request.get('/api/chat/media/'+bob.user.id)).status()).toBe(401);
  const stranger=await request.get('/api/chat/media/'+bob.user.id,{
    headers:{Authorization:'Bearer '+outsider.token}
  });
  expect((await stranger.json()).data).toHaveLength(0);
  const badCursor=await request.get('/api/chat/media/'+bob.user.id+'?before=invalid',{
    headers:{Authorization:'Bearer '+alice.token}
  });
  expect(badCursor.status()).toBe(400);

  await rows.first().getByRole('button',{name:'Xem one.png'}).click();
  const viewer=page.getByRole('dialog',{name:'Trình xem ảnh và video'});
  await expect(viewer).toBeVisible();
  await expect(viewer.locator('.zs-chat-viewer-strip .zs-chat-media-tile')).toHaveCount(4);
  await expect(viewer).toContainText('1 / 4');
  await viewer.getByRole('button',{name:'Phóng to ảnh'}).click();
  await expect(viewer.getByLabel('Mức phóng đại')).toHaveText('125%');
  await viewer.getByRole('button',{name:'Xoay ảnh'}).click();
  await expect(viewer.locator('.zs-chat-viewer-image')).toHaveAttribute('style',/rotate\(90deg\) scale\(1.25\)/);
  await viewer.getByRole('button',{name:'Thu nhỏ ảnh'}).click();
  await expect(viewer.getByLabel('Mức phóng đại')).toHaveText('100%');
  await viewer.getByRole('button',{name:'Media phía dưới'}).click();
  await expect(viewer).toContainText('2 / 4');
  await viewer.getByRole('button',{name:'Media phía trên'}).click();
  await expect(viewer).toContainText('1 / 4');

  await viewer.locator('.zs-chat-viewer-main').hover();
  await page.mouse.wheel(0,440);
  await expect(viewer).toContainText('2 / 4');
  await page.keyboard.press('ArrowRight');
  await expect(viewer).toContainText('3 / 4');
  await viewer.getByRole('button',{name:'Chia sẻ media'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__zenSharedNames)).toEqual(['three.png']);
  const download=page.waitForEvent('download');
  await viewer.getByRole('button',{name:'Tải media'}).click();
  expect((await download).suggestedFilename()).toBe('three.png');

  await viewer.getByRole('button',{name:'Thu nhỏ trình xem'}).click();
  await expect(viewer).toHaveClass(/is-minimized/);
  await expect(viewer.getByRole('button',{name:'Mở rộng trình xem'})).toBeVisible();
  await expect(page.getByRole('form',{name:'Soạn tin nhắn'})).toBeVisible();
  await viewer.getByRole('button',{name:'Mở rộng trình xem'}).click();
  await expect(viewer.locator('.zs-chat-viewer-image')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(viewer).toHaveCount(0);
});

test('Mobile viewer toolbar, swipe gallery and minimized dock never overflow',async({page,request})=>{
  const stamp=Date.now().toString(36);
  const alice=await account(request,'viewer_mobile',stamp);
  const bob=await account(request,'viewer_mobile_peer',stamp);
  await login(page,alice);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/messages?user='+bob.user.id);
  await sendAlbum(page,['left.png','middle.png','right.png','more.png']);
  await page.getByRole('button',{name:'Xem left.png'}).click();
  const viewer=page.getByRole('dialog',{name:'Trình xem ảnh và video'});
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole('button',{name:'Chia sẻ media'})).toBeVisible();
  await expect(viewer.getByRole('button',{name:'Xoay ảnh'})).toBeEnabled();
  await expect(viewer.locator('.zs-chat-viewer-strip-scroll')).toHaveCSS('overflow-x','auto');
  await viewer.getByRole('button',{name:'Phóng to ảnh'}).click();
  await expect(viewer.getByLabel('Mức phóng đại')).toHaveText('125%');
  await viewer.getByRole('button',{name:'Thu nhỏ trình xem'}).click();
  await expect(viewer).toHaveClass(/is-minimized/);
  await viewer.getByRole('button',{name:'Mở rộng trình xem'}).click();
  await expect(viewer).not.toHaveClass(/is-minimized/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(392);
  await viewer.getByRole('button',{name:'Đóng trình xem'}).click();
  await expect(viewer).toHaveCount(0);
});
