import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAY0lEQVR4nO3PQQ3AIADAQEAaqpCIrIngcVnSU9DOfe74s6UDXjWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgfQIxAgJVdKIwAAAAAElFTkSuQmCC','base64');
const video=readFileSync(new URL('../fixtures/tiny-video.mp4',import.meta.url));

async function signup(request,prefix,stamp){
 const username=prefix+'_'+stamp, password='Gallery_123!';
 const response=await request.post('/api/DangKy',{data:{username,email:username+'@example.test',password,confirmPassword:password}});
 expect(response.status()).toBe(201);
 return response.json();
}

test('Zalo-style gallery groups media in one chat message and opens conversation viewer',async({page,request})=>{
 const stamp=Date.now().toString(36);
 const alice=await signup(request,'gallery_alice',stamp);
 const bob=await signup(request,'gallery_bob',stamp);
 const stranger=await signup(request,'gallery_stranger',stamp);
 await page.addInitScript(({token,user})=>{
   localStorage.setItem('zen_token',token);
   localStorage.setItem('zen_user',JSON.stringify(user));
 },{token:alice.token,user:alice.user});
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/messages?user='+bob.user.id);
 const composer=page.getByRole('form',{name:'Soạn tin nhắn'});
 await composer.locator('input[type=file]').setInputFiles([
   {name:'first.png',mimeType:'image/png',buffer:png},
   {name:'second.png',mimeType:'image/png',buffer:png},
   {name:'third.png',mimeType:'image/png',buffer:png},
   {name:'clip.mp4',mimeType:'video/mp4',buffer:video},
 ]);
 await expect(composer.locator('.zs-chat-attachment-draft')).toHaveCount(4);
 await expect(composer.getByText('4/10 tệp')).toBeVisible();
 await composer.getByRole('textbox',{name:'Nội dung tin nhắn'}).fill('Album cuối tuần');
 await composer.getByRole('button',{name:'Gửi'}).click();
 const own=page.locator('.zs-messenger-bubble-row.is-own');
 await expect(own).toHaveCount(1);
 await expect(own.locator('.zs-chat-media-grid')).toHaveCount(1);
 await expect(own.locator('.zs-chat-media-tile')).toHaveCount(4);
 await expect(own.locator('.zs-chat-media-grid')).not.toHaveClass(/is-single/);
 await expect(own.locator('.zs-chat-media-tile').first()).toHaveCSS('aspect-ratio','1 / 1');
 const tiles=await own.locator('.zs-chat-media-tile').evaluateAll(nodes=>nodes.map(node=>{
   const box=node.getBoundingClientRect();
   return {x:box.x,y:box.y,w:box.width,h:box.height};
 }));
 expect(tiles.every(tile=>Math.abs(tile.w-tile.h)<2)).toBeTruthy();
 expect(tiles[0].y).toBe(tiles[1].y);
 expect(tiles[0].x).toBeLessThan(tiles[1].x);
 await expect(own).toContainText('Album cuối tuần');

 const history=await request.get('/api/chat/lichsu/'+alice.user.id+'/'+bob.user.id,{
  headers:{Authorization:'Bearer '+alice.token}
 });
 expect(history.ok()).toBeTruthy();
 const messages=(await history.json()).tinNhan;
 expect(messages).toHaveLength(1);
 expect(messages[0].attachments).toHaveLength(4);
 expect(messages[0].attachments.map(file=>file.name)).toEqual(['first.png','second.png','third.png','clip.mp4']);
 expect(messages[0].attachments.slice(0,3).every(file=>file.mime==='image/webp')).toBeTruthy();
 const clip=messages[0].attachments[3];
 expect(clip.previewUrl).toMatch(/\/preview$/);
 const poster=await request.get(clip.previewUrl,{headers:{Authorization:'Bearer '+bob.token}});
 expect(poster.ok()).toBeTruthy();
 expect(poster.headers()['content-type']).toContain('image/webp');
 expect((await poster.body()).length).toBeGreaterThan(50);
 expect((await request.get(clip.previewUrl)).status()).toBe(401);
 expect((await request.get(clip.previewUrl,{headers:{Authorization:'Bearer '+stranger.token}})).status()).toBe(404);

 await own.getByRole('button',{name:'Xem second.png'}).click();
 const viewer=page.getByRole('dialog',{name:'Trình xem ảnh và video'});
 await expect(viewer).toBeVisible();
 await expect(viewer).toHaveCSS('background-color','rgb(17, 19, 22)');
 await expect(viewer.locator('.zs-chat-viewer-image')).toBeVisible();
 await expect(viewer.locator('.zs-chat-viewer-strip .zs-chat-media-tile')).toHaveCount(4);
 await expect(viewer).toContainText('2 / 4');
 await page.keyboard.press('ArrowRight');
 await expect(viewer).toContainText('3 / 4');
 await viewer.getByRole('button',{name:'Media tiếp theo'}).click();
 await expect(viewer).toContainText('4 / 4');
 await expect(viewer.locator('video')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(viewer).toHaveCount(0);

 // A later standalone photo becomes a fifth item in the same viewer sidebar.
 await composer.locator('input[type=file]').setInputFiles({name:'after.png',mimeType:'image/png',buffer:png});
 await composer.getByRole('button',{name:'Gửi'}).click();
 await expect(page.locator('.zs-messenger-bubble-row.is-own')).toHaveCount(2);
 await page.locator('.zs-messenger-bubble-row.is-own').first().getByRole('button',{name:'Xem first.png'}).click();
 await expect(viewer.locator('.zs-chat-viewer-strip .zs-chat-media-tile')).toHaveCount(5);
 await viewer.getByRole('button',{name:'Đóng trình xem'}).click();
 await expect(viewer).toHaveCount(0);
});

test('Gallery is responsive and enforces 10-file limit without sending',async({page,request})=>{
 const stamp=Date.now().toString(36);
 const self=await signup(request,'gallery_mobile',stamp);
 const peer=await signup(request,'gallery_mobile_peer',stamp);
 await page.addInitScript(({token,user})=>{
   localStorage.setItem('zen_token',token);
   localStorage.setItem('zen_user',JSON.stringify(user));
 },{token:self.token,user:self.user});
 await page.setViewportSize({width:390,height:844});
 await page.goto('/messages?user='+peer.user.id);
 const form=page.getByRole('form',{name:'Soạn tin nhắn'});
 await form.locator('input[type=file]').setInputFiles(
  Array.from({length:10},(_,i)=>({name:'pic'+i+'.png',mimeType:'image/png',buffer:png}))
 );
 await expect(form.locator('.zs-chat-attachment-draft')).toHaveCount(10);
 await form.locator('input[type=file]').setInputFiles({name:'extra.png',mimeType:'image/png',buffer:png});
 await expect(form.getByText('Mỗi tin nhắn gửi tối đa 10 tệp.')).toBeVisible();
 await form.locator('.zs-chat-attachment-draft').first().getByRole('button',{name:/Bỏ tệp đính kèm/}).click();
 await expect(form.locator('.zs-chat-attachment-draft')).toHaveCount(9);
 await form.getByRole('button',{name:'Gửi'}).click();
 const gallery=page.locator('.zs-chat-media-grid');
 await expect(gallery).toBeVisible();
 await expect(gallery.locator('.zs-chat-media-tile')).toHaveCount(9);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(392);
 await gallery.getByRole('button',{name:'Xem pic1.png'}).click();
 const viewer=page.getByRole('dialog',{name:'Trình xem ảnh và video'});
 await expect(viewer.locator('.zs-chat-viewer-strip .zs-chat-media-tile')).toHaveCount(9);
 await expect(viewer.locator('.zs-chat-viewer-strip')).toHaveCSS('width','390px');
 await viewer.getByRole('button',{name:'Đóng trình xem'}).click();
});
