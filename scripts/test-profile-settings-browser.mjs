// Rerunnable against the disposable stack after profile confirmation tests.
import { chromium,webkit } from 'playwright';
import assert from 'node:assert/strict';
import {openMasters} from './browser-navigation.mjs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const base='http://127.0.0.1:3101',output=path.resolve('test-results/profiles');await mkdir(output,{recursive:true});let checks=0;
const check=(v,m)=>{assert.ok(v,m);checks++;};
async function choose(page,scope,label,name){await scope.getByRole('combobox',{name:label,exact:true}).click();await page.getByRole('option',{name,exact:true}).click();}
for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch();const context=await browser.newContext({locale:'ja-JP',timezoneId:'Asia/Tokyo'});const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',dialog=>dialog.accept());
  try{
    await page.goto(base+'/login');await page.getByLabel('メールアドレス').fill('fixture0@example.invalid');await page.getByRole('button',{name:'確認コードを送信',exact:true}).click();await page.getByLabel('確認コード',{exact:true}).fill('111111');await page.getByRole('button',{name:'ログイン',exact:true}).click();await page.waitForURL('**/expenses');await page.getByRole('combobox',{name:'カテゴリで絞り込み',exact:true}).waitFor();
    await page.getByRole('button',{name:'表示名の設定',exact:true}).click();let profile=page.getByRole('dialog',{name:'表示名の設定',exact:true});await profile.getByLabel('表示名',{exact:true}).fill('あいうえおかきくけこ');await profile.getByRole('button',{name:'保存',exact:true}).click();await profile.waitFor({state:'hidden'});
    for(const [width,height] of [[320,700],[390,600],[1280,900]]){
      await page.setViewportSize({width,height});await page.screenshot({path:path.join(output,`${engineName}-${width}-header.png`),animations:'disabled'});
      const header=page.locator('.expense-header-inner');check(await header.evaluate(el=>el.scrollWidth<=el.clientWidth),'Long name fits header');
      check(await header.evaluate(el=>{const box=el.getBoundingClientRect();return [...el.querySelectorAll('.profile-header span,.profile-header strong')].every(child=>{const r=child.getBoundingClientRect();return r.top>=box.top&&r.bottom<=box.bottom;});}),'Header text is not clipped vertically');
      const boxes=await header.locator(':scope > *').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,end:r.right};}));
      for(let i=1;i<boxes.length;i++)check(boxes[i-1].end<=boxes[i].x+1,'Header controls do not overlap');
    }
    await page.setViewportSize({width:390,height:844});await openMasters(page);const manager=page.getByRole('dialog',{name:'マスタ管理',exact:true});await manager.getByRole('tab',{name:'支払元',exact:true}).click();await manager.getByRole('button',{name:'追加',exact:true}).click();
    await choose(page,manager,'資金の持ち主','あいうえおかきくけこ');
    check(await manager.getByLabel('持ち主の名前を付ける',{exact:true}).isChecked(),'Personal names link by default');
    const label=('識別名'+engineName+Date.now()+'長い名前のカード').padEnd(40,'あ').slice(0,40),display='あいうえおかきくけこの'+label;
    await manager.getByLabel('識別名',{exact:true}).fill(label);check(await manager.getByLabel('支払元の表示名').innerText()===display,'Live preview shows current owner plus identifier');
    await manager.getByRole('button',{name:'保存',exact:true}).click();await manager.getByRole('button',{name:display+'を編集',exact:true}).waitFor();await manager.getByRole('button',{name:display+'を編集',exact:true}).click();
    check(await manager.getByLabel('識別名',{exact:true}).inputValue()===label,'Edit shows identifier without duplicating owner name');
    await page.screenshot({path:path.join(output,`${engineName}-linked-master.png`),animations:'disabled'});
    await manager.getByRole('button',{name:'キャンセル',exact:true}).click();await manager.getByRole('button',{name:'閉じる',exact:true}).click();await manager.waitFor({state:'hidden'});
    const masters=await(await page.request.get(base+'/api/masters')).json(),source=masters.paymentSources.find(s=>s.name===display);check(Boolean(source)&&source.ownerLabel===label&&source.storedName===label,'Stored label and display name stay distinct');
    await page.locator('.desktop-add:visible,.mobile-add button:visible').click();const editor=page.getByRole('dialog',{name:'支出を記録',exact:true});await choose(page,editor,'支払元',display);check((await editor.locator('.payment-outcome').innerText()).includes('家計の共用資金 → あいうえおかきくけこ'),'New source uses correct funding and advance defaults');await editor.getByRole('button',{name:'キャンセル',exact:true}).click();await editor.waitFor({state:'hidden'});
    await page.getByRole('button',{name:'表示名の設定',exact:true}).click();profile=page.getByRole('dialog',{name:'表示名の設定',exact:true});await profile.getByLabel('表示名',{exact:true}).fill('夫');await profile.getByRole('button',{name:'保存',exact:true}).click();await profile.waitFor({state:'hidden'});
    const renamed=(await(await page.request.get(base+'/api/masters')).json()).paymentSources.find(s=>s.id===source.id);check(renamed.name==='夫の'+label&&renamed.fundingPartyId===source.fundingPartyId,'Rename updates new source without reassignment');
    const response=await page.request.put(base+'/api/masters/payment-sources/'+source.id,{headers:{origin:base},data:{name:source.storedName,ownerLabel:label,fundingPartyId:source.fundingPartyId,method:source.method,archived:true,defaultTreatment:source.defaultTreatment,isDefault:false,version:source.version}});check(response.ok(),'Fixture source archived');check(errors.length===0,'No browser JavaScript errors');
  }catch(error){await page.screenshot({path:path.join(output,`${engineName}-settings-failure.png`),animations:'disabled'}).catch(()=>{});throw error;}
  finally{await context.close();await browser.close();}
}
console.log(`PASS: ${checks} linked-source master, profile rename and header layout checks`);
