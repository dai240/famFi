import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { navigate } from './browser-navigation.mjs';
const base='http://127.0.0.1:3101',output='test-results/notes';await mkdir(output,{recursive:true});let checks=0;
const check=(v,message)=>{assert.ok(v,message);checks++;};
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch(),context=await browser.newContext({locale:'ja-JP',timezoneId:'Asia/Tokyo'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);page.on('dialog',d=>d.accept());
  try{
    await page.goto(base+'/login');await page.getByLabel('メールアドレス').fill('fixture0@example.invalid');await page.getByRole('button',{name:'確認コードを送信',exact:true}).click();await page.getByLabel('確認コード',{exact:true}).fill('111111');await page.getByRole('button',{name:'ログイン',exact:true}).click();await page.waitForURL('**/expenses');
    const masters=await(await page.request.get(base+'/api/masters')).json();if(masters.parties.find(p=>p.id===masters.selfPartyId)?.profileConfirmed===false)await page.getByRole('button',{name:'確認して始める',exact:true}).click();await page.getByRole('dialog',{name:'利用者を確認',exact:true}).waitFor({state:'hidden'});
    for(const [width,height] of [[320,568],[390,844],[667,375],[1280,800]]){
      await page.setViewportSize({width,height});await navigate(page,'家計の共有');await page.getByText('招待制・非公開',{exact:true}).waitFor();check(await page.getByText('参加中',{exact:true}).count()===2,'Both household members visible without Auth IDs');
      await page.screenshot({path:`${output}/${name}-${width}-household.png`,animations:'disabled'});
      await navigate(page,'共有メモ');await page.getByRole('button',{name:'追加',exact:true}).click();let dialog=page.getByRole('dialog',{name:'共有メモを追加',exact:true});await dialog.waitFor();
      const title=`Note ${name} ${width} ${randomUUID().slice(0,8)}`;
      await dialog.getByLabel('件名',{exact:true}).fill(title);await dialog.getByLabel('完了チェックを付ける').check();await dialog.getByLabel('メモ',{exact:true}).fill('食材の注文を確認する\n家族で共有するメモ');
      await dialog.getByRole('radio',{name:'月のみ',exact:true}).check();await dialog.getByLabel('メモの月').fill('2037-09');
      const box=await dialog.getByRole('button',{name:'保存',exact:true}).boundingBox();check(box.y>=0&&box.y+box.height<=height,'Note save fits viewport');
      await page.screenshot({path:`${output}/${name}-${width}-editor.png`,animations:'disabled'});
      await dialog.getByRole('button',{name:'保存',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.getByRole('button',{name:new RegExp(title)}).waitFor();
      await page.getByRole('checkbox',{name:title+'を完了にする',exact:true}).click();await page.getByRole('checkbox',{name:title+'を未完了に戻す',exact:true}).waitFor();check(true,'Task can complete');
      await page.getByRole('button',{name:'完了',exact:true}).click();await page.getByRole('button',{name:new RegExp(title)}).waitFor();
      await page.getByRole('button',{name:new RegExp(title)}).click();dialog=page.getByRole('dialog',{name:'共有メモを編集',exact:true});await dialog.waitFor();check(await dialog.getByLabel('メモの月').inputValue()==='2037-09','Month precision retained');await dialog.getByRole('button',{name:'キャンセル',exact:true}).click();await dialog.waitFor({state:'hidden'});
      await navigate(page,'支出');await page.getByLabel('表示する月').fill('2037-09');await page.getByRole('group',{name:'支出の表示方法'}).getByRole('button',{name:'カレンダー',exact:true}).click();await page.getByRole('group',{name:'2037-09のカレンダー'}).waitFor();
      check(await page.locator('.calendar-day').count()===30,'All month days rendered');check(!await page.locator('.expense-body').isVisible(),'Ledger hidden in calendar mode');
      await page.getByRole('button',{name:/日付未定・月のみ/}).click();await page.locator('.calendar-agenda').getByRole('button',{name:new RegExp(title)}).waitFor();check(true,'Monthly memo appears without invented day');
      check(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),'No horizontal overflow');
      await page.screenshot({path:`${output}/${name}-${width}-calendar.png`,animations:'disabled'});
      await page.getByRole('button',{name:'この日に支出を記録',exact:true}).click();dialog=page.getByRole('dialog',{name:'支出を記録',exact:true});await dialog.waitFor();check(await dialog.getByLabel('支出月').inputValue()==='2037-09','New expense keeps selected month precision');
      await dialog.getByLabel('金額（円）').fill('987');await dialog.getByLabel('保存後も続けて登録').check();await dialog.getByRole('button',{name:'保存',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('#expense-amount')?.value==='');
      check(await dialog.getByLabel('保存後も続けて登録').isChecked(),'Continuous entry remains enabled');check((await dialog.getByRole('combobox',{name:'支払元',exact:true}).innerText()).includes('家族カード'),'Continuous entry uses default source');check(await dialog.getByLabel('支出月').inputValue()==='2037-09','Continuous entry keeps date');
      await dialog.getByRole('button',{name:'キャンセル',exact:true}).click();await dialog.waitFor({state:'hidden'});
      await page.getByRole('group',{name:'支出の表示方法'}).getByRole('button',{name:'一覧',exact:true}).click();await page.locator('.expense-body').waitFor({state:'visible'});
      const rows=page.locator('.expense-row-content').filter({has:page.locator('strong',{hasText:'食費'})});check(await rows.count()>0,'Saved expense appears');
      await navigate(page,'共有メモ');await page.getByRole('button',{name:new RegExp(title)}).click();dialog=page.getByRole('dialog',{name:'共有メモを編集',exact:true});await dialog.getByRole('button',{name:'メモを削除',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.getByRole('button',{name:new RegExp(title)}).waitFor({state:'hidden'});check(true,'Delete refreshes shared list');
    }
    check(errors.length===0,'No page errors: '+errors.join(','));
  }catch(error){await page.screenshot({path:`${output}/${name}-failure.png`});throw error;}finally{await browser.close();}
}
console.log(`PASS: ${checks} notes/calendar/sharing/continuous-entry browser checks; ${output}`);
