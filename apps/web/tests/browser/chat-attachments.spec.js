import { test, expect } from '@playwright/test';

test('Chat composer uploads optimized private attachments, emoji and sends with WebSocket', async ({page,request}) => {
  const stamp=Date.now().toString(36);
  const password='ChatMedia_123!';
  async function signup(prefix) {
    const username=prefix+'_'+stamp;
    const response=await request.post('/api/DangKy',{data:{
      username,email:username+'@example.test',password,confirmPassword:password
    }});
    expect(response.status()).toBe(201);
    return response.json();
  }
  const alice=await signup('media_alice');
  const bob=await signup('media_bob');
  const stranger=await signup('media_stranger');
  await page.addInitScript(({token,user})=>{
    localStorage.setItem('zen_token',token);
    localStorage.setItem('zen_user',JSON.stringify(user));
  },{token:alice.token,user:alice.user});
  await page.goto('/messages?user='+bob.user.id);
  const composer=page.getByRole('form',{name:'Soạn tin nhắn'});
  await expect(composer).toBeVisible();
  await composer.getByRole('button',{name:'Chọn emoji'}).click();
  await composer.getByRole('button',{name:'Thêm emoji 🚀'}).click();
  await expect(composer.getByRole('textbox',{name:'Nội dung tin nhắn'})).toHaveValue('🚀');
  const text=Buffer.from('Thông tin nén văn bản của ZenSpace.\n'.repeat(1200));
  await composer.locator('input[type=file]').setInputFiles({name:'notes.txt',mimeType:'text/plain',buffer:text});
  await expect(composer.getByText('notes.txt')).toBeVisible();
  await composer.getByRole('button',{name:'Gửi'}).click();
  await expect(page.locator('.zs-chat-media-caption').filter({hasText:'notes.txt'})).toBeVisible();
  const history=await request.get('/api/chat/lichsu/'+alice.user.id+'/'+bob.user.id,{
    headers:{Authorization:'Bearer '+alice.token}
  });
  expect(history.ok()).toBeTruthy();
  const messages=(await history.json()).tinNhan;
  const fileMsg=messages.find(message=>message.attachment?.name==='notes.txt');
  expect(fileMsg).toBeTruthy();
  expect(fileMsg.noiDung).toBe('🚀');
  expect(fileMsg.attachment.kind).toBe('file');
  expect(fileMsg.attachment.size).toBeLessThan(text.length);
  const endpoint='/api/chat/attachments/'+fileMsg.attachment.id;
  const unauthorized=await request.get(endpoint);
  expect(unauthorized.status()).toBe(401);
  const forbidden=await request.get(endpoint,{headers:{Authorization:'Bearer '+stranger.token}});
  expect(forbidden.status()).toBe(404);
  const permitted=await request.get(endpoint,{headers:{Authorization:'Bearer '+bob.token}});
  expect(permitted.ok()).toBeTruthy();
  expect((await permitted.body()).equals(text)).toBeTruthy();

  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAY0lEQVR4nO3PQQ3AIADAQEAaqpCIrIngcVnSU9DOfe74s6UDXjWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgfQIxAgJVdKIwAAAAAElFTkSuQmCC','base64');
  await composer.locator('input[type=file]').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:png});
  await composer.getByRole('button',{name:'Gửi'}).click();
  await expect(page.locator('.zs-chat-media-caption').filter({hasText:'photo.png'})).toBeVisible();
  const imageMessages=await request.get('/api/chat/lichsu/'+alice.user.id+'/'+bob.user.id,{
    headers:{Authorization:'Bearer '+alice.token}
  });
  const images=(await imageMessages.json()).tinNhan;
  const image=images.find(message=>message.attachment?.name==='photo.png');
  expect(image).toBeTruthy();
  expect(image.attachment.kind).toBe('image');
  expect(image.attachment.mime).toBe('image/webp');
  const bytes=await request.get('/api/chat/attachments/'+image.attachment.id,{
    headers:{Authorization:'Bearer '+alice.token}
  });
  expect(bytes.ok()).toBeTruthy();
  expect(bytes.headers()['content-type']).toContain('image/webp');
  await expect(page.locator('.zs-chat-image')).toBeVisible();
  // Public uploads must not expose private chat media.
  const disallowed=await request.get('/uploads/chat/'+image.attachment.id+'.webp');
  expect(disallowed.status()).toBe(404);
});

test('Composer rejects unsupported extensions before persistence',async ({page,request})=>{
  const stamp=Date.now().toString(36);
  const password='ChatMedia_123!';
  async function signup(prefix) {
    const username=prefix+'_'+stamp;
    const response=await request.post('/api/DangKy',{data:{
      username,email:username+'@example.test',password,confirmPassword:password
    }});
    expect(response.status()).toBe(201);
    return response.json();
  }
  const sender=await signup('reject_sender');
  const receiver=await signup('reject_receiver');
  const result=await request.post('/api/chat/attachments',{
    headers:{Authorization:'Bearer '+sender.token},
    multipart:{
      receiverId:String(receiver.user.id),caption:'Blocked executable',
      file:{name:'payload.exe',mimeType:'application/octet-stream',buffer:Buffer.from([0x4d,0x5a,0x90,0x00])}
    }
  });
  expect(result.status()).toBe(400);
  const history=await request.get('/api/chat/lichsu/'+sender.user.id+'/'+receiver.user.id,{
    headers:{Authorization:'Bearer '+sender.token}
  });
  expect((await history.json()).tinNhan).toHaveLength(0);
});
