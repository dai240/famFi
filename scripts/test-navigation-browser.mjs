import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {navigate,openMasters} from './browser-navigation.mjs';
const base='http://127.0.0.1:3101',output='test-results/navigation';
await mkdir(output,{recursive:true});let checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch();const context=await browser.newContext({locale:'ja-JP',timezoneId:'Asia/Tokyo',hasTouch:true});const page=await context.newPage();const errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.setDefaultTimeout(20000);
  try{
    await page.goto(base+'/login');await page.getByLabel('メールアドレス').fill('fixture0@example.invalid');await page.getByRole('button',{name:'確認コードを送信',exact:true}).click();await page.getByLabel('確認コード',{exact:true}).fill('111111');await page.getByRole('button',{name:'ログイン',exact:true}).click();await page.waitForURL('**/expenses');
    const masters=await(await page.request.get(base+'/api/masters')).json();if(masters.parties.find(p=>p.id===masters.selfPartyId)?.profileConfirmed===false)await page.getByRole('button',{name:'確認して始める',exact:true}).click();
    await page.getByRole('dialog',{name:'利用者を確認',exact:true}).waitFor({state:'hidden'});await page.getByLabel('表示する月').fill('2038-03');
    for(const [width,height] of [[320,568],[390,844],[667,375],[1280,800]]){
      await page.setViewportSize({width,height});const nav=page.getByRole('navigation',{name:'メインメニュー',exact:true});
      check(await nav.isVisible()===(width<768),'Responsive navigation visibility');
      if(width>=768){check(await page.getByRole('tab',{name:'支出',exact:true}).isVisible(),'Desktop tabs retained');continue;}
      const box=await nav.boundingBox();check(Math.abs(box.y+box.height-height)<2,'Navigation stays at bottom');
      check(await nav.evaluate(el=>{const b=el.getBoundingClientRect();return [...el.querySelectorAll('button')].every(e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.left>=b.left&&r.right<=b.right;});}),'Five touch targets fit');
      const plus=await nav.getByRole('button',{name:'支出を記録',exact:true}).boundingBox();check(Math.abs(plus.x+plus.width/2-width/2)<2,'New expense is centered');
      check(await page.locator('.workspace-tabs').isVisible()===false,'No duplicate mobile tabs');
      for(const [view,key] of [['支出','expenses'],['立替・精算','settlements'],['予定・定期','recurring'],['変更履歴','history']]){
        await navigate(page,view);await page.locator('.expense-main:visible h1').first().waitFor();
        const heading=await page.locator('.expense-main:visible h1').first().innerText();
        await nav.getByRole('button',{name:'支出を記録',exact:true}).click();const dialog=page.getByRole('dialog',{name:'支出を記録',exact:true});await dialog.waitFor();
        check((await dialog.getByRole('combobox',{name:'支払元',exact:true}).innerText()).includes('家族カード'),'Family card default from '+key);
        const save=await dialog.getByRole('button',{name:'保存',exact:true}).boundingBox();check(save.y>=0&&save.y+save.height<=height,'Save fits '+key);
        await dialog.getByRole('button',{name:'キャンセル',exact:true}).click();await dialog.waitFor({state:'hidden'});
        check(await page.locator('.expense-main:visible h1').first().innerText()===heading,'Cancel returns to '+key);
        check(await nav.locator('[aria-current=page]').count()===1,'One current navigation item');
      }
      await nav.getByRole('button',{name:'メニュー',exact:true}).click();let menu=page.getByRole('dialog',{name:'メニュー',exact:true});await menu.waitFor();
      await menu.evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished)));const menuBox=await menu.boundingBox();check(menuBox.y>=0&&menuBox.y+menuBox.height<=height+1,'Menu fits short viewport');
      await page.screenshot({path:`${output}/${name}-${width}-menu.png`,animations:'disabled'});
      await menu.getByRole('button',{name:'表示名の設定',exact:true}).click();let profile=page.getByRole('dialog');await profile.getByLabel('表示名',{exact:true}).waitFor();check(await page.getByRole('dialog').count()===1,'Sheet closes before profile opens');await profile.getByRole('button',{name:'キャンセル',exact:true}).click();await profile.waitFor({state:'hidden'});
      await openMasters(page);const manager=page.getByRole('dialog');await manager.getByRole('heading',{name:'マスタ管理',exact:true}).waitFor();check(await page.getByRole('dialog').count()===1,'Sheet closes before masters open');await manager.getByRole('button',{name:'Close',exact:true}).click();await manager.waitFor({state:'hidden'});
      await navigate(page,'支出');check(await page.getByLabel('表示する月').inputValue()==='2038-03','Month survives navigation');
      const attention=await(await page.request.get(base+'/api/attention')).json();await page.getByRole('button',{name:'一覧を更新',exact:true}).click();
      if(attention.count){await nav.getByLabel('確認待ち'+attention.count+'件',{exact:true}).waitFor();checks++;}
      await page.screenshot({path:`${output}/${name}-${width}-expenses.png`,animations:'disabled'});
      check(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),'No page overflow');
    }
    await page.setViewportSize({width:390,height:844});await navigate(page,'予定・定期');await page.locator('.expense-main:visible h1').first().waitFor();const heading=await page.locator('.expense-main:visible h1').first().innerText();
    await page.locator('.mobile-add button').click();const editor=page.getByRole('dialog',{name:'支出を記録',exact:true});await editor.getByLabel('金額（円）').fill('1234');const description='Navigation '+name+' '+Date.now();await editor.getByLabel('内容',{exact:false}).fill(description);await editor.getByRole('button',{name:'保存',exact:true}).click();await editor.waitFor({state:'hidden'});check(await page.locator('.expense-main:visible h1').first().innerText()===heading,'Saving keeps recurring view');
    await navigate(page,'支出');await page.getByRole('button',{name:new RegExp(description)}).waitFor();checks++;
    await page.getByRole('navigation',{name:'メインメニュー'}).getByRole('button',{name:'メニュー',exact:true}).click();await page.getByRole('dialog',{name:'メニュー',exact:true}).getByRole('button',{name:'ログアウト',exact:true}).click();await page.waitForURL('**/login');checks++;
    check(errors.length===0,'No browser errors: '+errors.join(','));
  }catch(error){await page.screenshot({path:output+'/'+name+'-failure.png'});throw error;}finally{await browser.close();}
}
console.log('PASS: '+checks+' responsive navigation, menu, default entry, save/return and logout checks; '+output);
