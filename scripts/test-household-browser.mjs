// Browser, API and DB verification using only disposable local household accounts.
import { chromium,webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import {navigate} from './browser-navigation.mjs';
const base='http://127.0.0.1:3101',output=path.resolve('test-results/household');await mkdir(output,{recursive:true});let checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
async function choose(page,scope,label,name){await scope.getByRole('combobox',{name:label,exact:true}).click();await page.getByRole('option',{name,exact:true}).click();}
async function fit(page,scope){check(await scope.evaluate(el=>el.scrollWidth<=el.clientWidth),'No horizontal overflow');check(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),'Page fits viewport');}
async function login(page,token){await page.goto(base+'/login');await page.getByLabel('メールアドレス').fill('fixture0@example.invalid');await page.getByRole('button',{name:'確認コードを送信',exact:true}).click();await page.getByLabel('確認コード',{exact:true}).fill(token);await page.getByRole('button',{name:'ログイン',exact:true}).click();await page.waitForURL('**/expenses');const masters=await(await page.request.get(base+'/api/masters')).json();if(masters.parties.find(p=>p.id===masters.selfPartyId)?.profileConfirmed===false)await page.getByRole('button',{name:'確認して始める',exact:true}).click();await page.getByRole('button',{name:'マスタ管理',exact:true}).waitFor();}
for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch();let page,spouse;
  try{
    const ownerContext=await browser.newContext({locale:'ja-JP',timezoneId:'Asia/Tokyo',hasTouch:true});const spouseContext=await browser.newContext({locale:'ja-JP',timezoneId:'Asia/Tokyo',hasTouch:true});
    page=await ownerContext.newPage();spouse=await spouseContext.newPage();const errors=[];
    for(const p of [page,spouse]){p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('dialog',d=>d.accept());}
    await login(page,'111111');await login(spouse,'777777');
    const ownerMasters=await(await page.request.get(base+'/api/masters')).json();const wifeMasters=await(await spouse.request.get(base+'/api/masters')).json();
    for(const [width,height] of [[320,700],[390,844],[390,600],[844,390],[1280,900]]){
      await page.setViewportSize({width,height});await spouse.setViewportSize({width,height});const label=engineName+'-'+width+'-'+height+'-'+Date.now();
      console.log('Checking household '+engineName+' '+width+'x'+height);
      await navigate(page,'支出');await page.locator('.desktop-add:visible, .mobile-add button:visible').click();
      let editor=page.getByRole('dialog',{name:'支出を記録',exact:true});await editor.waitFor();
      check((await editor.getByRole('combobox',{name:'支払元',exact:true}).innerText()).includes('家族カード'),'Default family card');
      check((await editor.getByRole('combobox',{name:'購入・支払いをした人',exact:true}).innerText()).includes('自分（夫）'),'Default authenticated buyer');
      check((await editor.getByRole('combobox',{name:'誰のため',exact:true}).innerText()).includes('家族'),'Default family beneficiary');
      const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());check(await editor.getByLabel('支出日',{exact:true}).inputValue()===today,'Default today, regardless of displayed month');
      await editor.getByLabel('金額（円）').fill('5000');await editor.getByLabel('内容',{exact:false}).fill('年パス '+label);
      await choose(page,editor,'支払元','妻のカード');check((await editor.locator('.payment-outcome').innerText()).includes('妻'),'Funding belongs to wife, not current buyer');check(await editor.getByLabel('精算対象額（円）').inputValue()==='5000','Personal card proposes full advance');
      await choose(page,editor,'支払いの扱い','直接負担・返金なし');check(await editor.getByLabel('精算対象額（円）').count()===0,'Direct contribution has no repayment amount');
      await choose(page,editor,'誰のため','その他');await editor.getByLabel('誰のための支出か',{exact:true}).fill('親戚の年パス');
      await editor.getByRole('radio',{name:'月のみ',exact:true}).check();await editor.getByLabel('支出月',{exact:true}).fill('2031-02');
      await fit(page,editor);const saveBox=await editor.getByRole('button',{name:'保存',exact:true}).boundingBox();check(saveBox.y+saveBox.height<=height,'Save remains in viewport while scrolled');
      await page.screenshot({path:path.join(output,label+'-direct.png'),animations:'disabled'});
      await editor.getByRole('button',{name:'保存',exact:true}).click();await editor.waitFor({state:'hidden'});
      let listed=await(await page.request.get(base+'/api/expenses?month=2031-02&search='+encodeURIComponent(label))).json();const saved=listed.expenses[0];check(saved.paymentTreatment==='direct'&&saved.reimbursementAmount===0&&saved.beneficiaryText==='親戚の年パス','Direct and free-text data persisted');
      await spouse.reload();await spouse.getByLabel('表示する月').fill('2031-02');let row=spouse.getByRole('button',{name:'2031年2月（月のみ） 年パス '+label+' 5000円を編集',exact:true});await row.click();
      const wifeEditor=spouse.getByRole('dialog',{name:'支出を編集',exact:true});check((await wifeEditor.getByRole('combobox',{name:'購入・支払いをした人',exact:true}).innerText()).includes('夫'),'Buyer does not turn into wife when viewed by wife');
      await wifeEditor.getByLabel('内容',{exact:false}).fill('年パス訂正 '+label);await wifeEditor.getByRole('button',{name:'保存',exact:true}).click();await wifeEditor.waitFor({state:'hidden'});
      const changed=await(await page.request.get(base+'/api/expenses/'+saved.id)).json();check(changed.recordedByPartyId===ownerMasters.selfPartyId&&changed.updatedByPartyId===wifeMasters.selfPartyId,'Recorder and editor are distinct');
      await spouse.getByRole('button',{name:'2031年2月（月のみ） 年パス訂正 '+label+' 5000円を編集',exact:true}).click();await wifeEditor.getByRole('button',{name:'この支出の変更履歴',exact:true}).click();
      const history=spouse.getByRole('dialog',{name:'支出の変更履歴',exact:true});await history.locator('summary').first().waitFor();check((await history.innerText()).includes('妻')&&(await history.innerText()).includes('夫'),'Both actors visible in history');await fit(spouse,history);await spouse.screenshot({path:path.join(output,label+'-history.png'),animations:'disabled'});await history.getByRole('button',{name:'Close',exact:true}).click();await wifeEditor.getByRole('button',{name:'キャンセル',exact:true}).click();
      // A period-confirmation flow through the recurring UI, with no automatic actuals.
      await navigate(page,'予定・定期');const workspace=page.locator('.recurring-workspace');await workspace.getByRole('tab',{name:'定期・この月',exact:true}).click();await workspace.getByLabel('定期支出の表示月').fill('2031-02');await workspace.getByRole('button',{name:'定期支出',exact:true}).click();
      const ruleEditor=page.getByRole('dialog',{name:'定期支出を追加',exact:true});await ruleEditor.getByLabel('名称',{exact:true}).fill('電気 '+label);await choose(page,ruleEditor,'定期支出の金額の種類','毎回入力');
      await choose(page,ruleEditor,'支払元','妻のカード');await ruleEditor.getByRole('button',{name:'保存',exact:true}).click();await ruleEditor.waitFor({state:'hidden'});
      const item=workspace.locator('.recurring-list > li').filter({hasText:'電気 '+label});await item.getByRole('button',{name:'この月を登録',exact:true}).waitFor();
      let occurrences=await(await page.request.get(base+'/api/recurring?month=2031-02')).json();const rule=occurrences.rules.find(r=>r.name==='電気 '+label);check(!occurrences.occurrences.some(o=>o.ruleId===rule.id),'Saving a recurring rule does not create an expense');
      await item.getByRole('button',{name:'電気 '+label+'をこの月はスキップ',exact:true}).click();await item.getByRole('button',{name:'スキップ取消',exact:true}).click();await item.getByRole('button',{name:'この月を登録',exact:true}).click();
      const confirmation=page.getByRole('dialog',{name:'電気 '+label+'を登録',exact:true});check(await confirmation.getByLabel('金額（円）').inputValue()==='','Variable amount starts blank');await confirmation.getByLabel('金額（円）').fill('6800');check(await confirmation.getByLabel('精算対象額（円）').inputValue()==='6800','Variable reimbursement follows entered amount');
      await fit(page,confirmation);await page.screenshot({path:path.join(output,label+'-recurring.png'),animations:'disabled'});await confirmation.getByRole('button',{name:'保存',exact:true}).click();await confirmation.waitFor({state:'hidden'});await item.getByRole('button',{name:'登録済みの支出',exact:true}).waitFor();
      occurrences=await(await page.request.get(base+'/api/recurring?month=2031-02')).json();const occurrence=occurrences.occurrences.find(o=>o.ruleId===rule.id);const posted=await(await spouse.request.get(base+'/api/expenses/'+occurrence.expenseId)).json();check(posted.amount===6800&&posted.reimbursementToPartyId===wifeMasters.selfPartyId,'Generated expense shared with spouse, advance to funding owner');
      await item.getByRole('button',{name:'登録済みの支出',exact:true}).click();const postedEditor=page.getByRole('dialog',{name:'支出を編集',exact:true});await postedEditor.getByRole('button',{name:'削除',exact:true}).click();const deletion=page.getByRole('dialog',{name:'支出を削除しますか？',exact:true});await deletion.getByRole('button',{name:'削除する',exact:true}).click();await deletion.waitFor({state:'hidden'});await item.getByRole('button',{name:'この月を登録',exact:true}).waitFor();
      await item.getByRole('button',{name:'電気 '+label+'の設定を編集',exact:true}).click();const editRule=page.getByRole('dialog',{name:'定期支出を編集',exact:true});await editRule.getByLabel('停止する',{exact:true}).check();await editRule.getByRole('button',{name:'保存',exact:true}).click();await editRule.waitFor({state:'hidden'});await item.waitFor({state:'hidden'});await workspace.getByRole('tab',{name:'定期の設定',exact:true}).click();await item.waitFor();check((await item.innerText()).includes('停止中'),'Paused rules remain editable in all settings');await fit(page,workspace);await page.screenshot({path:path.join(output,label+'-rules.png'),fullPage:true,animations:'disabled'});
      await page.request.delete(base+'/api/expenses/'+saved.id,{headers:{origin:base},data:{version:changed.version}});
    }
    check(errors.length===0,'No browser errors: '+errors.join(', '));await ownerContext.close();await spouseContext.close();
  }catch(error){await page?.screenshot({path:path.join(output,engineName+'-failure.png'),animations:'disabled'});throw error;}finally{await browser.close();}
}
console.log('PASS: '+checks+' household browser defaults/sharing/direct/history/recurring/skip/reopen/mobile checks; '+output);
