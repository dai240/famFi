import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { navigate } from './browser-navigation.mjs';
const base='http://127.0.0.1:3101',output='test-results/expense-improvements';await mkdir(output,{recursive:true});let checks=0;
const check=(v,m)=>{assert.ok(v,m);checks++;};
for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch(),context=await browser.newContext({locale:'ja-JP',timezoneId:'Asia/Tokyo'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);page.on('dialog',d=>d.accept());
  try{
    await page.goto(base+'/login');await page.getByLabel('メールアドレス').fill('fixture0@example.invalid');await page.getByRole('button',{name:'確認コードを送信',exact:true}).click();await page.getByLabel('確認コード',{exact:true}).fill('111111');await page.getByRole('button',{name:'ログイン',exact:true}).click();await page.waitForURL('**/expenses');
    const masters=await(await page.request.get(base+'/api/masters')).json();if(masters.parties.find(p=>p.id===masters.selfPartyId)?.profileConfirmed===false)await page.getByRole('button',{name:'確認して始める',exact:true}).click();await page.getByRole('dialog',{name:'利用者を確認',exact:true}).waitFor({state:'hidden'});
    const self=masters.parties.find(p=>p.id===masters.selfPartyId),shared=masters.parties.find(p=>p.systemKey==='shared'),source=masters.paymentSources.find(s=>s.fundingPartyId===self.id&&s.method==='card');
    const request=async(path,body)=>{const r=await page.request.post(base+path,{data:body,headers:{origin:base}});check(r.ok(),path+': '+await r.text());return r.json();};
    for(const [width,height] of [[320,568],[390,844],[844,390],[1280,800]]){
      await page.setViewportSize({width,height});await navigate(page,'支出');await page.getByLabel('表示する月').fill('2038-08');await page.getByRole('region',{name:'前月比較'}).waitFor();
      const comparison=page.getByRole('region',{name:'前月比較'});await comparison.locator('summary').click();await comparison.getByRole('heading',{name:'増加したカテゴリ'}).waitFor();check(await comparison.getByText(/サンプルを含みます/).isVisible(),'Comparison identifies samples');
      check(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth),'No comparison overflow');await page.screenshot({path:`${output}/${engineName}-${width}-comparison.png`,animations:'disabled'});
      const token=engineName+width+randomUUID().slice(0,4),prefix='家族の食材まとめ買いと日用品 '+token;
      const fields={amount:1234,date:'2039-08-10',categoryId:'food',costClass:'variable',description:prefix,memo:'',paymentSourceId:source.id,paidByPartyId:self.id,usedByPartyId:self.id,usedByText:'',beneficiaryKind:'family',beneficiaryPartyId:null,beneficiaryText:'',paymentTreatment:'advance',reimbursementStatus:'required',reimbursementFromPartyId:shared.id,reimbursementToPartyId:self.id,reimbursementAmount:1234};
      const a=await request('/api/expenses',{...fields,id:randomUUID()}),b=await request('/api/expenses',{...fields,description:prefix+' 2',id:randomUUID()});
      await navigate(page,'立替・精算');await page.getByRole('checkbox',{name:prefix+'を一括精算に選択',exact:true}).check();await page.getByRole('checkbox',{name:prefix+' 2を一括精算に選択',exact:true}).check();
      await page.getByRole('button',{name:'まとめて精算',exact:true}).click();let dialog=page.getByRole('dialog',{name:'まとめて精算を記録',exact:true});await dialog.waitFor();
      check((await dialog.locator('.batch-total strong').innerText()).replace(/[^0-9]/g,'')==='2468','Combined remaining total');check(await dialog.getByRole('button',{name:'精算を保存',exact:true}).isDisabled(),'Requires repayment acknowledgement');
      await dialog.getByLabel('精算日',{exact:true}).fill('2039-08-31');await dialog.getByLabel('対象と金額を確認し、返金済みです').check();
      const box=await dialog.getByRole('button',{name:'精算を保存',exact:true}).boundingBox();check(box.y>=0&&box.y+box.height<=height,'Batch save stays visible');check(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth),'Batch dialog has no horizontal overflow');
      await page.screenshot({path:`${output}/${engineName}-${width}-batch.png`,animations:'disabled'});
      await dialog.getByRole('button',{name:'精算を保存',exact:true}).click();await dialog.waitFor({state:'hidden'});
      for(const e of [a,b]){const saved=await(await page.request.get(base+'/api/expenses/'+e.id)).json();check(saved.settledAmount===1234&&saved.settlements.length===1,'Batch saves actual allocation');}
      const provisional={name:'【仮】公共料金 '+token,amountMode:'previous',amount:null,frequency:'monthly',startMonth:'2039-08',endMonth:null,dueDay:20,categoryId:'utilities',paymentSourceId:source.id,paymentTreatment:'advance',usedByPartyId:self.id,usedByText:'',beneficiaryKind:'family',beneficiaryPartyId:null,beneficiaryText:'',memo:'famfi-sample-summer-2026-v1: 動作確認用の架空データです。実際の請求・支払・送金ではありません。',archived:false,costClass:'fixed',reviewDay:20,reviewMonthOffset:0};
      await request('/api/recurring',{...provisional,id:randomUUID()});await navigate(page,'予定・定期');await page.getByLabel('定期支出の表示月').fill('2039-08');
      let item=page.locator('.recurring-list>li').filter({has:page.locator('strong',{hasText:provisional.name})});await item.getByRole('button',{name:'仮設定を確認',exact:true}).click();dialog=page.getByRole('dialog',{name:'定期支出を編集',exact:true});await dialog.waitFor();
      await dialog.getByLabel('実際の金額・支払元・確認日を確認済み').check();await dialog.getByRole('button',{name:'保存',exact:true}).click();await dialog.waitFor({state:'hidden'});
      item=page.locator('.recurring-list>li').filter({has:page.locator('strong',{hasText:'公共料金 '+token})});await item.getByRole('button',{name:'この月を登録',exact:true}).click();dialog=page.getByRole('dialog',{name:'公共料金 '+token+'を登録',exact:true});await dialog.waitFor();check(await dialog.getByLabel('金額（円）').inputValue()==='','No fictitious previous amount');await dialog.getByRole('button',{name:'キャンセル',exact:true}).click();await dialog.waitFor({state:'hidden'});
      check(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth),'Recurring no overflow');await page.screenshot({path:`${output}/${engineName}-${width}-recurring.png`,fullPage:true,animations:'disabled'});
    }
    check(errors.length===0,'No browser exceptions: '+errors.join(','));
  }catch(error){await page.screenshot({path:`${output}/${engineName}-failure.png`,fullPage:true});throw error;}finally{await browser.close();}
}
console.log(`PASS: ${checks} comparison, batch repayment and provisional-rule browser checks across Chromium/WebKit; ${output}`);
