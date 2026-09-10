// Full UI workflow against the local fixture stack only.
import { chromium,webkit } from 'playwright';
import assert from 'node:assert/strict';
import {navigate,openMasters} from './browser-navigation.mjs';
import { mkdir,readFile } from 'node:fs/promises';
import path from 'node:path';
const base='http://127.0.0.1:3101',output=path.resolve('test-results/expense-management');await mkdir(output,{recursive:true});let checks=0;
function check(value,message){assert.ok(value,message);checks++;}
async function choose(page,scope,label,name){await scope.getByRole('combobox',{name:label,exact:true}).click();await page.getByRole('option',{name,exact:true}).click();}
async function fit(page,scope){check(await scope.evaluate(el=>el.scrollWidth<=el.clientWidth),'No horizontal overflow');check(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),'Page fits viewport');}
for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch();let page;
  try{
    const context=await browser.newContext({locale:'ja-JP',timezoneId:'Asia/Tokyo',hasTouch:true});page=await context.newPage();page.setDefaultTimeout(15000);
    let discard=true;page.on('dialog',dialog=>discard?dialog.accept():dialog.dismiss());
    const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await page.goto(base+'/login');await page.getByLabel('メールアドレス').fill('fixture0@example.invalid');await page.getByRole('button',{name:'確認コードを送信',exact:true}).click();await page.getByLabel('確認コード',{exact:true}).fill('111111');await page.getByRole('button',{name:'ログイン',exact:true}).click();await page.waitForURL('**/expenses');
    for(const [width,height] of [[320,700],[390,844],[430,932],[390,600],[844,390],[1280,900]]){
      await page.setViewportSize({width,height});
      const name=`${engineName}-${width}-${height}-${Date.now().toString().slice(-5)}`,parent=`家族の買物 ${name}`,child=`日用品 ${name}`,person=`本人 ${name}`,fund=`共用資金 ${name}`,source=`個人カード ${name}`,description=`生活用品 ${name}`;
      console.log(`Checking ledger ${engineName} ${width}x${height}`);
      const before=await(await page.request.get(base+'/api/expenses?month=2026-09')).json();
      await openMasters(page);const manager=page.getByRole('dialog',{name:'マスタ管理',exact:true});
      await manager.getByRole('button',{name:'追加',exact:true}).click();await manager.getByLabel('名称',{exact:true}).fill(parent);await manager.getByRole('button',{name:'色 #3C75B5',exact:true}).click();await manager.getByRole('button',{name:'保存',exact:true}).click();await manager.getByRole('button',{name:parent+'を編集',exact:true}).waitFor();
      await manager.getByRole('button',{name:'追加',exact:true}).click();await manager.getByLabel('名称',{exact:true}).fill(child);await choose(page,manager,'親カテゴリ',parent);await manager.getByRole('button',{name:'色 #B35F79',exact:true}).click();await manager.getByRole('button',{name:'保存',exact:true}).click();await manager.getByRole('button',{name:child+'を編集',exact:true}).waitFor();
      await fit(page,manager);await page.screenshot({path:path.join(output,name+'-categories.png'),animations:'disabled'});
      await manager.getByRole('tab',{name:'人物・共用資金',exact:true}).click();
      for(const [name,shared] of [[person,false],[fund,true]]){
        await manager.getByRole('button',{name:'追加',exact:true}).click();await manager.getByLabel('名称',{exact:true}).fill(name);if(shared)await manager.getByLabel('共用資金・家族全体',{exact:true}).check();await manager.getByRole('button',{name:'保存',exact:true}).click();await manager.getByRole('button',{name:name+'を編集',exact:true}).waitFor();
      }
      await manager.getByRole('tab',{name:'支払元',exact:true}).click();await manager.getByRole('button',{name:'追加',exact:true}).click();await choose(page,manager,'資金の持ち主',person);await manager.getByLabel('持ち主の名前を付ける',{exact:true}).uncheck();await manager.getByLabel('名称',{exact:true}).fill(source);await fit(page,manager);await page.screenshot({path:path.join(output,name+'-payment-source.png'),animations:'disabled'});await manager.getByRole('button',{name:'保存',exact:true}).click();await manager.getByRole('button',{name:source+'を編集',exact:true}).waitFor();await manager.getByRole('button',{name:'閉じる',exact:true}).click();await manager.waitFor({state:'hidden'});
      await page.locator('.desktop-add:visible, .mobile-add button:visible').click();const editor=page.getByRole('dialog',{name:'支出を記録',exact:true});
      await editor.getByLabel('金額（円）').fill('3000');await editor.getByLabel('内容',{exact:false}).fill(description);
      await editor.getByRole('button',{name:'カテゴリを管理',exact:true}).click();await manager.getByRole('button',{name:child+'を編集',exact:true}).click();await manager.getByRole('button',{name:'色 #367D91',exact:true}).click();await manager.getByRole('button',{name:'保存',exact:true}).click();await manager.getByRole('button',{name:child+'を編集',exact:true}).waitFor();await manager.getByRole('button',{name:'閉じる',exact:true}).click();await manager.waitFor({state:'hidden'});check(await editor.getByLabel('金額（円）').inputValue()==='3000','Master management preserves amount draft');check(await editor.getByLabel('内容',{exact:false}).inputValue()===description,'Master management preserves description draft');
      await choose(page,editor,'カテゴリ',parent);await choose(page,editor,'詳細カテゴリ',child);
      check(await editor.getByRole('combobox',{name:'詳細カテゴリ',exact:true}).locator('.category-swatch').evaluate(el=>getComputedStyle(el).backgroundColor)==='rgb(54, 125, 145)','Edited color is reflected');
      await choose(page,editor,'購入・支払いをした人',person);await choose(page,editor,'誰のため','家族');await choose(page,editor,'支払元',source);check((await editor.locator('.payment-outcome').innerText()).includes(person),'Funding default is visibly selected');await choose(page,editor,'支払いの扱い','精算内容を指定');await choose(page,editor,'精算の要否','精算が必要');await choose(page,editor,'返す側',fund);await choose(page,editor,'受け取る側（立替者）',person);await editor.getByRole('button',{name:'全額',exact:true}).click();check(await editor.getByLabel('精算対象額（円）').inputValue()==='3000','Full amount remains explicit');
      await fit(page,editor);await page.screenshot({path:path.join(output,name+'-advance.png'),animations:'disabled'});
      discard=false;await editor.getByRole('button',{name:'キャンセル',exact:true}).click();check(await editor.isVisible(),'Declining discard preserves editor');discard=true;
      await editor.getByRole('button',{name:'保存',exact:true}).click();await editor.waitFor({state:'hidden'});await page.reload();
      const records=await(await page.request.get(base+'/api/expenses?month=2026-09')).json();const expense=records.expenses.find(e=>e.description===description);check(!!expense && expense.reimbursementAmount===3000,'Expense persisted with reimbursement fields');check(records.total===before.total+3000,'Purchase counted once');
      await navigate(page,'立替・精算');await page.getByRole('button',{name:description+'の精算',exact:true}).click();const settlement=page.getByRole('dialog',{name:'精算を記録',exact:true});
      await settlement.getByLabel('返した金額（円）').fill('1000');await settlement.getByLabel('精算日',{exact:true}).fill('2026-09-12');await settlement.getByLabel('精算メモ',{exact:false}).fill('一部返金');await settlement.getByRole('button',{name:'精算を保存',exact:true}).click();await settlement.getByRole('status').filter({hasText:'精算を記録しました'}).waitFor();check((await settlement.locator('dl').innerText()).includes('2,000'),'Partial settlement leaves remainder');
      await settlement.getByLabel('返した金額（円）').fill('2001');await settlement.getByRole('button',{name:'精算を保存',exact:true}).click();check((await settlement.getByRole('alert').innerText()).includes('未精算額'),'Overpayment rejected in UI');
      await settlement.getByLabel('返した金額（円）').fill('2000');await settlement.getByRole('button',{name:'精算を保存',exact:true}).click();await settlement.getByLabel('返した金額（円）').waitFor({state:'hidden'});check(await settlement.locator('.settlement-history li').count()===2,'Two repayments in history');
      await settlement.getByRole('button',{name:'1000円の精算を取り消す',exact:true}).click();await settlement.getByRole('status').filter({hasText:'取り消しました'}).waitFor();check(await settlement.getByLabel('返した金額（円）').inputValue()==='1000','Cancellation restores remaining amount');check((await settlement.locator('.settlement-history').innerText()).includes('取消済み'),'Cancelled history retained');
      await fit(page,settlement);await page.screenshot({path:path.join(output,name+'-settlement.png'),animations:'disabled'});
      await settlement.getByRole('button',{name:'精算を保存',exact:true}).click();await settlement.getByLabel('返した金額（円）').waitFor({state:'hidden'});await settlement.getByRole('button',{name:'閉じる',exact:true}).click();await settlement.waitFor({state:'hidden'});
      const stored=await(await page.request.get(base+`/api/expenses/${expense.id}`)).json();check(stored.settledAmount===3000 && stored.settlements.length===3,'Database retains correct payment and cancellation history');
      await page.getByRole('tab',{name:'精算対象すべて',exact:true}).click();await page.getByRole('button',{name:description+'の精算',exact:true}).waitFor();await fit(page,page.locator('.settlement-workspace'));await page.screenshot({path:path.join(output,name+'-settled-list.png'),fullPage:true,animations:'disabled'});
      const downloadPromise=page.waitForEvent('download');await page.locator('.settlement-workspace').getByRole('button',{name:'CSV',exact:true}).click();const csv=await readFile(await(await downloadPromise).path(),'utf8');check(csv.includes('取消済み')&&csv.includes(expense.id),'Settlement CSV includes cancellation and linkage');
      await navigate(page,'支出');
      const after=await(await page.request.get(base+'/api/expenses?month=2026-09')).json();check(after.total===before.total+3000,'Settlements do not increase expenses');
    }
    check(errors.length===0,'No browser errors: '+errors.join(', '));await context.close();
  }catch(error){await page?.screenshot({path:path.join(output,engineName+'-failure.png'),animations:'disabled'});throw error;}finally{await browser.close();}
}
console.log(`PASS: ${checks} new ledger UI/persistence/partial-payment/cancellation/CSV/mobile checks; ${output}`);
