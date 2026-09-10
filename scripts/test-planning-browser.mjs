// Browser -> API -> disposable PostgreSQL. Never targets a live household.
import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {navigate,openMasters} from './browser-navigation.mjs';
const base='http://127.0.0.1:3101',output='test-results/planning';
await mkdir(output,{recursive:true});let checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
async function choose(page,scope,label,name){await scope.getByRole('combobox',{name:label,exact:true}).click();await page.getByRole('option',{name,exact:true}).click();}
async function fit(page,scope){
  check(await scope.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Dialog has no horizontal overflow');
  check(await scope.evaluate(el=>{const b=el.getBoundingClientRect();return [...el.querySelectorAll('button,input,textarea,[role=combobox]')].filter(e=>e.getClientRects().length).every(e=>{const r=e.getBoundingClientRect();return r.left>=b.left-1&&r.right<=b.right+1;});}),'Controls are not clipped horizontally');
  check(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+1),'Page fits width');
  const bounds=await scope.boundingBox();const viewport=page.viewportSize();
  if(await scope.getAttribute('role')==='dialog'){
    check(bounds.x>=-1&&bounds.y>=-1&&bounds.x+bounds.width<=viewport.width+1&&bounds.y+bounds.height<=viewport.height+1,'Dialog fits viewport');
    const heading=await scope.getByRole('heading').first().boundingBox();check(heading.y>=bounds.y&&heading.y+heading.height<=bounds.y+bounds.height,'Dialog title remains visible');
  }
  const save=scope.getByRole('button',{name:'保存',exact:true});
  if(await save.count()){const b=await save.boundingBox();check(b.y>=0&&b.y+b.height<=viewport.height,'Save is always visible');}
}
for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch();const context=await browser.newContext({locale:'ja-JP',timezoneId:'Asia/Tokyo',hasTouch:true});const page=await context.newPage();const errors=[];
  page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('dialog',d=>d.accept());
  try{
    await page.goto(base+'/login');await page.getByLabel('メールアドレス').fill('fixture0@example.invalid');await page.getByRole('button',{name:'確認コードを送信',exact:true}).click();await page.getByLabel('確認コード',{exact:true}).fill('111111');await page.getByRole('button',{name:'ログイン',exact:true}).click();await page.waitForURL('**/expenses');const initialMasters=await(await page.request.get(base+'/api/masters')).json();if(initialMasters.parties.find(p=>p.id===initialMasters.selfPartyId)?.profileConfirmed===false)await page.getByRole('button',{name:'確認して始める',exact:true}).click();await page.getByRole('button',{name:'マスタ管理',exact:true}).waitFor();
    check((await page.locator('body').innerText()).includes('検証用の家計簿')===(process.env.FAMFI_TEST_SCHEMA!=='famfi'),'Environment is correctly identified');
    for(const [index,[width,height]] of [[320,568],[390,844],[844,390],[1280,800]].entries()){
      await page.setViewportSize({width,height});const name=engineName+'-'+width+'-'+Date.now(),month='2036-'+String(index+1+(engineName==='webkit'?4:0)).padStart(2,'0');
      console.log('Checking planning '+engineName+' '+width+'x'+height);
      await navigate(page,'支出');await page.getByLabel('表示する月',{exact:true}).fill(month);
      const masters=await(await page.request.get(base+'/api/masters')).json();
      const source=await(await page.request.post(base+'/api/masters/payment-sources',{headers:{origin:base},data:{id:crypto.randomUUID(),name:'集計用 '+name,method:'card',fundingPartyId:masters.paymentSources.find(s=>s.isDefault).fundingPartyId,defaultTreatment:'shared'}})).json();
      check(Boolean(source.id),'Fixture payment source created');
      const baseline=await(await page.request.get(base+'/api/expenses?month='+month)).json();
      await openMasters(page);await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
      // Reload masters after creating a disposable source through the API.
      await page.reload();await page.getByLabel('表示する月',{exact:true}).fill(month);
      await page.getByRole('button',{name:'まとめて登録',exact:true}).click();let editor=page.getByRole('dialog',{name:'まとめて登録',exact:true});
      await editor.getByLabel('名称',{exact:true}).fill('請求 '+name);await choose(page,editor,'まとめ記録の支払元','集計用 '+name);await editor.getByLabel('家計の支出額（円）').fill('10000');await editor.getByLabel('今回はまとめ記録で完了').uncheck();await fit(page,editor);await page.screenshot({path:output+'/'+name+'-summary-editor.png',animations:'disabled'});await editor.getByRole('button',{name:'保存',exact:true}).click();await editor.waitFor({state:'hidden'});
      await page.locator('.summary-row').filter({hasText:'請求 '+name}).click();let detail=page.getByRole('dialog',{name:'請求 '+name,exact:true});await detail.getByRole('button',{name:'明細を追加',exact:true}).click();
      editor=page.getByRole('dialog',{name:'まとめ記録の明細を追加',exact:true});await editor.getByLabel('金額（円）').fill('3000');await editor.getByLabel('内容',{exact:false}).fill('明細 '+name);await choose(page,editor,'費用の区分','変動費');await fit(page,editor);await editor.getByRole('button',{name:'保存',exact:true}).click();await editor.waitFor({state:'hidden'});
      await detail.locator('.summary-amounts dd').filter({hasText:'7,000'}).waitFor();await fit(page,detail);await page.screenshot({path:output+'/'+name+'-summary.png',animations:'disabled'});await detail.getByRole('button',{name:'Close',exact:true}).click();
      let result=await(await page.request.get(base+'/api/expenses?month='+month)).json();check(result.total===baseline.total+10000,'Adding detail keeps total unchanged');check(result.expenses.find(e=>e.description==='明細 '+name)?.costClass==='variable','Cost classification persisted');
      // A month-only plan is a forecast until explicitly confirmed.
      await navigate(page,'予定・定期');const workspace=page.locator('.recurring-workspace');await workspace.getByLabel('定期支出の表示月').fill(month);await workspace.getByRole('tab',{name:'単発の予定',exact:true}).click();await workspace.getByRole('button',{name:'予定を追加',exact:true}).click();
      editor=page.getByRole('dialog',{name:'予定を追加',exact:true});await editor.getByLabel('名称',{exact:true}).fill('誕生日 '+name);await editor.getByLabel('予定額（円）',{exact:false}).fill('5000');await choose(page,editor,'予定の支払元','妻のカード');await editor.getByLabel('確認開始日',{exact:false}).fill('2036-12-31');await fit(page,editor);await page.screenshot({path:output+'/'+name+'-plan-editor.png',animations:'disabled'});await editor.getByRole('button',{name:'保存',exact:true}).click();await editor.waitFor({state:'hidden'});
      const planItem=workspace.locator('.recurring-list > li').filter({hasText:'誕生日 '+name});await planItem.getByRole('button',{name:'支出を確定',exact:true}).waitFor();result=await(await page.request.get(base+'/api/expenses?month='+month)).json();check(result.total===baseline.total+10000,'Saving plan does not change actual total');
      await planItem.getByRole('button',{name:'誕生日 '+name+'の確認を後日にする',exact:true}).click();let snooze=page.getByRole('dialog',{name:'確認を後日にする',exact:true});await snooze.getByLabel('次に確認する日').fill('2037-01-01');await fit(page,snooze);await snooze.getByRole('button',{name:'変更',exact:true}).click();await snooze.waitFor({state:'hidden'});await planItem.getByText('確認開始 2037-01-01').waitFor();
      await planItem.getByRole('button',{name:'支出を確定',exact:true}).click();editor=page.getByRole('dialog',{name:'誕生日 '+name+'を確定',exact:true});check(await editor.getByLabel('精算対象額（円）').inputValue()==='5000','Planned amount initializes personal advance');await editor.getByLabel('金額（円）').fill('4800');await choose(page,editor,'費用の区分','特別費');await fit(page,editor);await editor.getByRole('button',{name:'保存',exact:true}).click();await editor.waitFor({state:'hidden'});await planItem.waitFor({state:'hidden'});await workspace.getByLabel('確定・中止済みも表示').check();await planItem.getByRole('button',{name:'登録済みの支出',exact:true}).waitFor();
      result=await(await page.request.get(base+'/api/expenses?month='+month)).json();check(result.total===baseline.total+14800,'Confirming plan adds actual once');
      // Recurring baseline/previous amount and notification date are separate choices.
      await workspace.getByRole('tab',{name:'定期・この月',exact:true}).click();await workspace.getByRole('button',{name:'定期支出',exact:true}).click();editor=page.getByRole('dialog',{name:'定期支出を追加',exact:true});await editor.getByLabel('名称',{exact:true}).fill('水道 '+name);await choose(page,editor,'定期支出の金額の種類','前回の確定額');await choose(page,editor,'費用の区分','固定費');await editor.getByRole('radio',{name:'2か月ごと',exact:true}).check();await editor.getByLabel('確認開始日を指定').check();await choose(page,editor,'確認開始の月','翌月');await editor.getByLabel('日（31は月末）',{exact:true}).fill('31');await fit(page,editor);await page.screenshot({path:output+'/'+name+'-recurring-editor.png',animations:'disabled'});await editor.getByRole('button',{name:'保存',exact:true}).click();await editor.waitFor({state:'hidden'});
      const ruleItem=workspace.locator('.recurring-list > li').filter({hasText:'水道 '+name});await ruleItem.getByRole('button',{name:'この月を登録',exact:true}).click();editor=page.getByRole('dialog',{name:'水道 '+name+'を登録',exact:true});check(await editor.getByLabel('金額（円）').inputValue()==='','No previous actual means amount must be entered');await editor.getByLabel('金額（円）').fill('4200');await editor.getByRole('button',{name:'保存',exact:true}).click();await editor.waitFor({state:'hidden'});await ruleItem.getByRole('button',{name:'登録済みの支出',exact:true}).waitFor();
      const nextMonth=month.slice(0,5)+String(Number(month.slice(5))+2).padStart(2,'0');await workspace.getByLabel('定期支出の表示月').fill(nextMonth);await ruleItem.getByRole('button',{name:'この月を登録',exact:true}).click();editor=page.getByRole('dialog',{name:'水道 '+name+'を登録',exact:true});check(await editor.getByLabel('金額（円）').inputValue()==='4200','Previous confirmation amount is carried forward');await editor.getByRole('button',{name:'キャンセル',exact:true}).click();await fit(page,workspace);await page.screenshot({path:output+'/'+name+'-recurring.png',fullPage:true,animations:'disabled'});
    }
    check(errors.length===0,'No browser errors: '+errors.join(', '));
  }catch(error){await page.screenshot({path:output+'/'+engineName+'-failure.png',animations:'disabled'});throw error;}finally{await browser.close();}
}
console.log('PASS: '+checks+' planning browser checks; '+output);
