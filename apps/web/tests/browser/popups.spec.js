import { test, expect } from '@playwright/test';

async function newAccount(request, prefix) {
  const username = prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6);
  const password='ZenPopup_123!';
  const response=await request.post('/api/DangKy',{data:{username,email:username+'@example.test',password,confirmPassword:password}});
  expect(response.status()).toBe(201);
  return response.json();
}
async function loginBySession(page,session){
  await page.addInitScript(({token,user})=>{
    localStorage.setItem('zen_token',token);
    localStorage.setItem('zen_user',JSON.stringify(user));
  },{token:session.token,user:session.user});
}

test('Block account uses custom ZenSpace popup, cancel, Escape, and confirm',async({page,request})=>{
  const self=await newAccount(request,'popup_owner');
  const other=await newAccount(request,'popup_other');
  await loginBySession(page,self);
  const nativeDialogs=[];
  page.on('dialog',dialog=>{nativeDialogs.push(dialog.type());dialog.dismiss();});
  await page.goto('/users/'+other.user.id);
  const action=page.getByRole('button',{name:'Chặn tài khoản',exact:true});
  await expect(action).toBeVisible();
  await action.click();
  const modal=page.getByRole('dialog',{name:'Chặn tài khoản?'});
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('Quan hệ theo dõi sẽ bị hủy.');
  await expect(modal.getByRole('button',{name:'Hủy'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(action).toBeVisible();
  await action.click();
  await modal.getByRole('button',{name:'Hủy'}).click();
  await expect(modal).toHaveCount(0);
  await action.click();
  await modal.getByRole('button',{name:'Chặn tài khoản'}).click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Bỏ chặn tài khoản'})).toBeVisible();
  expect(nativeDialogs).toEqual([]);
});

test('Unsent composer draft stays intact when confirmation is cancelled',async({page,request})=>{
  const user=await newAccount(request,'popup_composer');
  await loginBySession(page,user);
  const dialogs=[];
  page.on('dialog',d=>{dialogs.push(d.type());d.dismiss();});
  await page.goto('/');
  await page.getByRole('button',{name:'Bạn đang nghĩ gì?'}).click();
  const editor=page.getByRole('textbox',{name:'Nội dung bài viết'});
  await editor.fill('Nội dung chưa đăng cần giữ lại');
  await page.getByRole('dialog',{name:'Bài viết mới'}).getByRole('button',{name:'Đóng'}).click();
  const confirm=page.getByRole('dialog',{name:'Bỏ bản nháp?'});
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button',{name:'Hủy'}).click();
  await expect(editor).toHaveValue('Nội dung chưa đăng cần giữ lại');
  await page.getByRole('dialog',{name:'Bài viết mới'}).getByRole('button',{name:'Đóng'}).click();
  await confirm.getByRole('button',{name:'Bỏ bản nháp'}).click();
  await expect(page.getByRole('dialog',{name:'Bài viết mới'})).toHaveCount(0);
  expect(dialogs).toEqual([]);
});

test('Destructive confirmation is usable at mobile width without overflow',async({page,request})=>{
  const self=await newAccount(request,'popup_mobile');
  const other=await newAccount(request,'popup_target');
  await loginBySession(page,self);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/users/'+other.user.id);
  await page.getByRole('button',{name:'Chặn tài khoản',exact:true}).click();
  const modal=page.getByRole('dialog',{name:'Chặn tài khoản?'});
  await expect(modal).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(392);
  await modal.getByRole('button',{name:'Hủy'}).click();
  await expect(modal).toHaveCount(0);
});
