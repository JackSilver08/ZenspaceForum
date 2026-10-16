import { test, expect } from '@playwright/test';

for (const viewport of [
  {width:1440,height:900},
  {width:820,height:900},
  {width:390,height:844},
]) {
  test('Messenger switches layouts without reload at '+viewport.width+'px', async ({page,request}) => {
    const stamp=Math.random().toString(36).slice(2,9);
    const username='nav_chat_'+viewport.width+'_'+stamp;
    const password='NavChat_123!'+stamp;
    const signup=await request.post('/api/DangKy',{data:{
      username,email:username+'@example.test',password,confirmPassword:password
    }});
    expect(signup.status()).toBe(201);
    const session=await signup.json();
    await page.setViewportSize(viewport);
    await page.addInitScript(({token,user})=>{
      localStorage.setItem('zen_token',token);
      localStorage.setItem('zen_user',JSON.stringify(user));
    },{token:session.token,user:session.user});
    await page.goto('/');
    await expect(page.locator('.zs-layout')).toBeVisible();
    await page.evaluate(()=>{window.__chatRouteMarker='no-document-reload';});

    const nav=page.locator(viewport.width<=767?'.zs-mobile-nav':'.zs-side-nav');
    async function checkMessenger() {
      await expect(page).toHaveURL(/\/messages$/);
      await expect(page.locator('.zs-app--messages')).toBeVisible();
      await expect(page.locator('.zs-main--messages')).toBeVisible();
      await expect(page.locator('.zs-messenger-list')).toBeVisible();
      await expect(page.locator('.zs-layout')).toHaveCount(0);
      await expect.poll(()=>page.evaluate(()=>{
        const area=document.querySelector('.zs-content-area')?.getBoundingClientRect();
        const app=document.querySelector('.zs-messenger')?.getBoundingClientRect();
        return area&&app?Math.abs(area.width-app.width):10000;
      })).toBeLessThanOrEqual(2);
      await expect.poll(()=>page.evaluate(()=>
        Math.max(0,document.documentElement.scrollWidth-window.innerWidth)
      )).toBeLessThanOrEqual(2);
      expect(await page.evaluate(()=>window.__chatRouteMarker)).toBe('no-document-reload');
    }
    await nav.locator('a[href="/messages"]').click();
    await checkMessenger();

    await nav.locator('a[href="/"]').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('.zs-layout')).toBeVisible();
    await expect(page.locator('.zs-main--messages')).toHaveCount(0);
    expect(await page.evaluate(()=>window.__chatRouteMarker)).toBe('no-document-reload');

    await nav.locator('a[href="/messages"]').click();
    await checkMessenger();
  });
}
