import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { navigate } from './browser-navigation.mjs';

const base='http://127.0.0.1:3101',output='test-results/cash';
await mkdir(output,{recursive:true});
let checks=0;
function check(value,message){assert.ok(value,message);checks++;}
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch(),context=await browser.newContext({locale:'ja-JP',timezoneId:'Asia/Tokyo'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.setDefaultTimeout(15000);
  try{
    const login=await page.request.post(base+'/api/auth/verify',{headers:{origin:base},data:{email:'fixture0@example.invalid',token:'111111'}});
    check(login.status()===200,'Synthetic fixture authentication succeeds');await page.goto(base+'/expenses');
    const masters=await(await page.request.get(base+'/api/masters')).json();
    if(masters.parties.find(p=>p.id===masters.selfPartyId)?.profileConfirmed===false)await page.getByRole('button',{name:'確認して始める',exact:true}).click();
    await page.getByRole('dialog',{name:'利用者を確認',exact:true}).waitFor({state:'hidden'});
    for(const [width,height] of [[320,568],[390,844],[844,390],[1280,800]]){
      await page.setViewportSize({width,height});
      const cashTab=page.getByRole('tab',{name:'入出金',exact:true});
      check(await cashTab.isVisible(),'Cash entry is visible without opening the menu');
      const cashTabBox=await cashTab.boundingBox();check(cashTabBox.y>=0&&cashTabBox.y+cashTabBox.height<=height,'Cash entry is in the first viewport');
      await cashTab.click();await page.getByRole('heading',{name:'入出金',exact:true}).waitFor();
      check(await page.getByRole('tab',{name:'全期間',exact:true}).getAttribute('aria-selected')==='true','Cash opens with all dates selected');
      await page.getByRole('heading',{name:'全期間の入金',exact:true}).waitFor();
      check(await page.locator('.cash-list button').count()>0,'Existing imports are visible without extra filters');
      check(await page.locator('.cash-filter-panel').getAttribute('open')===null,'Detail filters remain collapsed');
      const allDownload=page.waitForEvent('download');await page.getByRole('button',{name:'表示中の入出金をCSV出力',exact:true}).click();check((await allDownload).suggestedFilename()==='famfi-cash-all.csv','Default export includes all dates');
      await page.screenshot({path:`${output}/${name}-${width}-initial.png`,animations:'disabled'});
      await page.getByRole('tab',{name:'月別',exact:true}).click();await page.getByLabel('入出金の表示月').fill('2032-07');
      await page.getByRole('button',{name:'記録',exact:true}).click();let dialog=page.getByRole('dialog',{name:'入出金を記録',exact:true});
      await dialog.waitFor();check(await dialog.getByLabel('関係者',{exact:true}).inputValue()==='','Unknown person is the default');
      for(const label of ['口座','種類','関係者'])check((await dialog.getByLabel(label,{exact:true}).boundingBox()).height>=40,'Select touch target does not shrink');
      const title=`Cash ${name} ${width} ${randomUUID().slice(0,8)}`;
      await dialog.getByLabel('金額（円）').fill('42000');await dialog.getByLabel('内容',{exact:true}).fill(title);await dialog.getByLabel('種類',{exact:true}).selectOption('card_payment');
      await dialog.getByLabel('取引日').fill('2032-07-27');await dialog.getByLabel('メモ',{exact:true}).fill('家族の入出金テスト');
      const save=await dialog.getByRole('button',{name:'保存',exact:true}).boundingBox();
      check(save.y>=0&&save.y+save.height<=height,'Save remains visible');
      check(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),'Editor has no horizontal overflow');
      await page.screenshot({path:`${output}/${name}-${width}-editor.png`,animations:'disabled'});
      await dialog.getByRole('button',{name:'保存',exact:true}).click();await dialog.waitFor({state:'hidden'});
      const row=page.locator('.cash-list button').filter({hasText:title});await row.waitFor();check((await row.innerText()).includes('関係者不明'),'Unknown person is visible');
      await page.screenshot({path:`${output}/${name}-${width}-list.png`,animations:'disabled',fullPage:true});
      check(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),'No page horizontal overflow');
      await row.click();dialog=page.getByRole('dialog',{name:'入出金を編集',exact:true});await dialog.waitFor();
      await dialog.getByRole('radio',{name:'入金',exact:true}).check();check(await dialog.getByLabel('種類',{exact:true}).inputValue()==='unknown','Changing direction resets incompatible kind');
      await dialog.getByLabel('種類',{exact:true}).selectOption('contribution');await dialog.getByLabel('関係者',{exact:true}).selectOption(masters.selfPartyId);
      await dialog.getByRole('button',{name:'保存',exact:true}).click();await dialog.waitFor({state:'hidden'});await row.waitFor();
      await page.locator('.cash-filter-panel summary').click();await page.getByLabel('入出金の方向',{exact:true}).selectOption('in');await row.waitFor();
      await page.getByRole('button',{name:'入出金を更新',exact:true}).click();await row.waitFor();
      const download=page.waitForEvent('download');await page.getByRole('button',{name:'表示中の入出金をCSV出力',exact:true}).click();check((await download).suggestedFilename()==='famfi-cash-2032-07.csv','CSV export downloads selected month');
      await page.getByLabel('入出金を検索',{exact:true}).fill(title);await page.getByRole('button',{name:'入出金を検索する',exact:true}).click();await row.waitFor();
      await page.waitForFunction(()=>document.querySelectorAll('.cash-list button').length===1);check(await page.locator('.cash-list button').count()===1,'Search filters the ledger');
      await row.click();dialog=page.getByRole('dialog',{name:'入出金を編集',exact:true});await dialog.waitFor();
      await dialog.getByRole('button',{name:'入出金の変更履歴',exact:true}).click();const history=page.getByRole('dialog',{name:'入出金の変更履歴',exact:true});await history.waitFor();
      await history.locator('summary').first().click();await history.getByText('家計への入金',{exact:true}).first().waitFor();check(true,'History displays cash kinds');await page.keyboard.press('Escape');await history.waitFor({state:'hidden'});
      await dialog.getByRole('button',{name:'入出金を削除',exact:true}).click();await dialog.waitFor({state:'hidden'});await row.waitFor({state:'hidden'});
      await page.getByRole('button',{name:'解除',exact:true}).click();await page.getByLabel('入出金の方向',{exact:true}).selectOption('all');
      await page.getByRole('tab',{name:'全期間',exact:true}).click();check(!await page.getByLabel('入出金の表示月').isVisible(),'All-time view hides month navigation');
      await page.getByRole('heading',{name:'全期間の入金',exact:true}).waitFor();
      await page.getByRole('tab',{name:'月別',exact:true}).click();check(await page.getByLabel('入出金の表示月').inputValue()==='2032-07','Month survives period changes');
      await navigate(page,'支出');
      check(await page.getByRole('heading',{name:'支出',exact:true}).isVisible(),'Return to purchase expenses');
    }
    // test-cash-api.mjs leaves a synthetic imported inflow for read-only UI verification.
    const rows=await(await page.request.get(base+'/api/cash-movements?month=2031-05')).json();
    const imported=rows.rows.find(row=>row.imported);check(!!imported,'Synthetic imported fixture exists');
    await navigate(page,'入出金');await page.getByRole('tab',{name:'月別',exact:true}).click();await page.getByLabel('入出金の表示月').fill('2031-05');
    await page.locator('.cash-list button').filter({hasText:imported.description}).click();
    const dialog=page.getByRole('dialog',{name:'入出金を編集',exact:true});await dialog.waitFor();
    for(const label of ['金額（円）','取引日','口座'])check(await dialog.getByLabel(label,{exact:true}).isDisabled(),'Imported '+label+' is immutable');
    check(await dialog.getByLabel('関係者',{exact:true}).isEnabled(),'Imported person can be clarified');
    await dialog.getByRole('button',{name:'キャンセル',exact:true}).click();await dialog.waitFor({state:'hidden'});
    check(errors.length===0,'No page errors: '+errors.join(','));
  }catch(error){await page.screenshot({path:`${output}/${name}-failure.png`});throw error;}finally{await browser.close();}
}
console.log(`PASS: ${checks} cash browser checks across Chromium/WebKit and four viewports; ${output}`);
