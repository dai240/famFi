// Browser -> unchanged APIs -> disposable loopback PostgreSQL only.
import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {navigate} from './browser-navigation.mjs';
const base='http://127.0.0.1:3101',output='test-results/compact-entry';
await mkdir(output,{recursive:true});let checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
async function choose(page,scope,label,name){await scope.getByRole('combobox',{name:label,exact:true}).click();await page.getByRole('option',{name,exact:true}).click();}
async function login(page,code){
  await page.goto(base+'/login');await page.getByLabel('メールアドレス').fill('fixture0@example.invalid');await page.getByRole('button',{name:'確認コードを送信',exact:true}).click();await page.getByLabel('確認コード',{exact:true}).fill(code);await page.getByRole('button',{name:'ログイン',exact:true}).click();await page.waitForURL('**/expenses');
  const masters=await(await page.request.get(base+'/api/masters')).json();
  if(masters.parties.find(p=>p.id===masters.selfPartyId)?.profileConfirmed===false)await page.getByRole('button',{name:'確認して始める',exact:true}).click();
  await page.getByRole('dialog',{name:'利用者を確認',exact:true}).waitFor({state:'hidden'});return masters;
}
async function fit(page,dialog){
  check(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth),'No dialog horizontal overflow');
  check(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth),'No page horizontal overflow');
  const box=await dialog.getByRole('button',{name:'保存',exact:true}).boundingBox();
  check(box.y>=0&&box.y+box.height<=page.viewportSize().height,'Save remains visible');
  const overflow=await dialog.evaluate(el=>[...el.querySelectorAll('input,textarea,button,[role=combobox],dd')].filter(e=>e.getClientRects().length).filter(e=>{const box=e.getBoundingClientRect(),parent=el.getBoundingClientRect();return box.left<parent.left||box.right>parent.right||(!e.matches('input,textarea')&&e.scrollWidth>e.clientWidth+1);}).map(e=>e.outerHTML.slice(0,250)));
  check(overflow.length===0,'Long labels and controls fit: '+overflow.join(', '));
}
for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch(),context=await browser.newContext({locale:'ja-JP',timezoneId:'Asia/Tokyo'}),page=await context.newPage(),errors=[];
  page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  try{
    const masters=await login(page,'111111'),self=masters.parties.find(p=>p.id===masters.selfPartyId),wife=masters.parties.find(p=>p.systemKey==='partner'),fund=masters.parties.find(p=>p.systemKey==='shared');
    const shared=masters.paymentSources.find(s=>s.isDefault),personal=masters.paymentSources.find(s=>s.fundingPartyId===wife.id&&s.method==='card');
    const post=async(path,data)=>{const r=await page.request.post(base+path,{headers:{origin:base},data});check(r.ok(),path+': '+await r.text());return r.json();};
    const expense=(amount,date,description)=>({amount,date,description,costClass:'fixed',categoryId:'utilities',memo:'金額確認用',paymentSourceId:personal.id,paidByPartyId:wife.id,paymentTreatment:'advance',usedByPartyId:self.id,usedByText:'',beneficiaryKind:'family',beneficiaryPartyId:null,beneficiaryText:'',reimbursementStatus:'required',reimbursementAmount:amount,reimbursementFromPartyId:fund.id,reimbursementToPartyId:wife.id});
    let index=0;
    for(const [width,height] of [[320,568],[390,844],[844,390],[1280,800]]){
      await page.setViewportSize({width,height});const label=`compact-${engineName}-${width}-${randomUUID().slice(0,6)}`;
      console.log('Checking '+label);
      await navigate(page,'支出');await page.getByLabel('表示する月').fill('2039-06');await page.locator('.desktop-add:visible,.mobile-add button:visible').click();
      let dialog=page.getByRole('dialog',{name:'支出を記録',exact:true});await dialog.waitFor();
      const summary=dialog.locator('.compact-payment-summary');
      check((await summary.innerText()).includes(shared.name)&&(await summary.innerText()).includes(self.name),'Defaults visible without opening controls');
      check(await dialog.getByRole('combobox',{name:'支払元',exact:true}).count()===0,'Payment controls start collapsed');
      check((await dialog.locator('.compact-date-summary').innerText()).includes('今日'),'Today shown regardless of selected ledger month');
      await dialog.getByLabel('金額（円）').fill('1234');await dialog.getByLabel('内容',{exact:false}).fill(label+' default');
      await fit(page,dialog);await page.screenshot({path:`${output}/${engineName}-${width}-daily.png`,animations:'disabled'});
      await dialog.getByRole('button',{name:'保存',exact:true}).click();await dialog.waitFor({state:'hidden'});
      const daily=(await(await page.request.get(base+'/api/expenses?month='+today.slice(0,7)+'&search='+encodeURIComponent(label))).json()).expenses[0];
      check(daily?.amount===1234&&daily.date===today&&daily.paymentSourceId===shared.id&&daily.usedByPartyId===self.id&&daily.beneficiaryKind==='family','Compact save persists all required defaults');
      await page.locator('.desktop-add:visible,.mobile-add button:visible').click();await dialog.waitFor();await dialog.getByLabel('金額（円）').fill('2500');await dialog.getByLabel('内容',{exact:false}).fill(label+' changed');
      await dialog.getByRole('button',{name:'支払情報を変更',exact:true}).click();await choose(page,dialog,'支払元',personal.name);
      await choose(page,dialog,'購入・支払いをした人','その他');await dialog.getByLabel('購入・支払いをした人の名前').fill('とても長い名前の購入した人');
      await choose(page,dialog,'誰のため','その他');await dialog.getByLabel('誰のための支出か',{exact:true}).fill('家族と一緒に出かけた親戚のみなさん');
      await dialog.getByRole('button',{name:'支払情報を折りたたむ',exact:true}).click();
      check((await dialog.locator('.payment-outcome').innerText()).includes(wife.name),'Compact advance shows funding recipient, not buyer');
      await dialog.getByLabel('金額（円）').fill('4000');check((await dialog.locator('.payment-outcome').innerText()).includes('4,000'),'Collapsed full advance follows amount');
      await dialog.getByRole('button',{name:'支出日を変更',exact:true}).click();await dialog.getByRole('radio',{name:'月のみ',exact:true}).check();await dialog.getByLabel('支出月',{exact:true}).fill('2039-04');
      await dialog.getByRole('radio',{name:'日付指定',exact:true}).check();check(await dialog.getByLabel('支出日',{exact:true}).inputValue()==='','Unknown day is not invented');
      await dialog.getByRole('radio',{name:'月のみ',exact:true}).check();await dialog.getByLabel('支出月',{exact:true}).fill('2039-04');await dialog.getByRole('button',{name:'支出日を折りたたむ',exact:true}).click();
      check((await dialog.locator('.compact-date-summary').innerText()).includes('月のみ'),'Month precision remains explicit while collapsed');await fit(page,dialog);
      await page.screenshot({path:`${output}/${engineName}-${width}-changed.png`,animations:'disabled'});
      const attempts=[];await page.route('**/api/expenses',async route=>{if(route.request().method()!=='POST')return route.continue();attempts.push(route.request().postDataJSON());if(attempts.length===1)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'テスト用の通信エラー'})});return route.continue();});
      await dialog.getByRole('button',{name:'保存',exact:true}).click();await dialog.getByRole('alert').waitFor();check(await dialog.getByLabel('金額（円）').inputValue()==='4000','Failed save keeps draft');
      await dialog.getByRole('button',{name:'保存',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.unroute('**/api/expenses');
      check(attempts.length===2&&JSON.stringify(attempts[0])===JSON.stringify(attempts[1]),'Retry keeps ID and payload');
      const changed=await(await page.request.get(base+'/api/expenses/'+attempts[1].id)).json();
      check(changed.date==='2039-04'&&changed.usedByPartyId===null&&changed.usedByText==='とても長い名前の購入した人'&&changed.beneficiaryText==='家族と一緒に出かけた親戚のみなさん'&&changed.reimbursementAmount===4000&&changed.reimbursementToPartyId===wife.id,'Collapsed custom text, month and advance persist');
      const mode=['fixed','previous','variable','previous'][index++],ruleName='電気代 '+label;
      const rule=await post('/api/recurring',{id:randomUUID(),name:ruleName,amountMode:mode,amount:mode==='fixed'?3600:null,frequency:'monthly',startMonth:'2039-05',endMonth:null,dueDay:31,reviewDay:null,reviewMonthOffset:0,costClass:'fixed',categoryId:'utilities',paymentSourceId:personal.id,paymentTreatment:'advance',usedByPartyId:self.id,usedByText:'',beneficiaryKind:'family',beneficiaryPartyId:null,beneficiaryText:'',memo:'金額確認用',archived:false});
      if(mode==='previous'&&width===390)await post('/api/recurring/'+rule.id+'/occurrences',{action:'post',period:'2039-05',ruleVersion:rule.version,occurrenceVersion:0,expenseId:randomUUID(),expense:expense(4200,'2039-05-31',ruleName)});
      await navigate(page,'予定・定期');await page.getByLabel('定期支出の表示月').fill('2039-06');
      const item=page.locator('.recurring-list > li').filter({hasText:ruleName});await item.getByRole('button',{name:'この月を登録',exact:true}).click();dialog=page.getByRole('dialog',{name:ruleName+'を登録',exact:true});await dialog.waitFor();
      check(await dialog.getByRole('combobox',{name:'カテゴリ',exact:true}).count()===0,'Recurring category controls start closed');
      check((await dialog.locator('.recurring-confirmation-summary').innerText()).includes('2039-06'),'Occurrence period stays visible');
      check(await dialog.getByLabel('金額（円）').inputValue()===(mode==='fixed'?'3600':width===390?'4200':''),'Fixed, previous and missing amounts initialized correctly');
      check(await dialog.getByLabel('支出日',{exact:true}).inputValue()==='2039-06-30','Recurring month end clamped');
      await dialog.getByLabel('金額（円）').fill('4800');await fit(page,dialog);await page.screenshot({path:`${output}/${engineName}-${width}-recurring.png`,animations:'disabled'});
      await dialog.getByRole('button',{name:'詳細を編集',exact:true}).click();await dialog.getByLabel('内容',{exact:false}).fill(ruleName+' 今月分');await choose(page,dialog,'費用の区分','特別費');await dialog.getByLabel('メモ',{exact:false}).fill('当月だけ変更');
      await dialog.getByRole('button',{name:'詳細を閉じる',exact:true}).click();check(await dialog.getByLabel('金額（円）').inputValue()==='4800','Details switch preserves amount');check((await dialog.locator('.recurring-confirmation-summary').innerText()).includes('特別費'),'Changed cost remains visible');
      await dialog.getByRole('button',{name:'保存',exact:true}).click();await dialog.waitFor({state:'hidden'});await item.getByRole('button',{name:'登録済みの支出',exact:true}).waitFor();
      const recurring=await(await page.request.get(base+'/api/recurring?month=2039-06')).json(),posted=recurring.occurrences.filter(o=>o.ruleId===rule.id);
      check(posted.length===1&&posted[0].state==='posted','One manual confirmation per period');
      const actual=await(await page.request.get(base+'/api/expenses/'+posted[0].expenseId)).json();check(actual.amount===4800&&actual.reimbursementAmount===4800&&actual.costClass==='special'&&actual.memo==='当月だけ変更'&&actual.description===ruleName+' 今月分','Detailed overrides preserved by quick confirmation');
      const unchanged=recurring.rules.find(r=>r.id===rule.id);check(unchanged.name===ruleName&&unchanged.costClass==='fixed'&&unchanged.memo==='金額確認用'&&unchanged.version===rule.version,'Monthly confirmation does not change template');
      await navigate(page,'支出');await page.getByLabel('表示する月').fill(today.slice(0,7));const comparison=page.getByRole('region',{name:'前月比較'});await comparison.waitFor();
      check(await comparison.getByText('今月ここまでの記録と前月全体の比較',{exact:true}).isVisible(),'Current comparison basis always visible');check(!(await comparison.locator('summary').innerText()).includes('%'),'No misleading partial-month percentage');
      await page.request.delete(base+'/api/expenses/'+daily.id,{headers:{origin:base},data:{version:daily.version}});
      await page.request.delete(base+'/api/expenses/'+changed.id,{headers:{origin:base},data:{version:changed.version}});
    }
    const spouse=await context.newPage();await login(spouse,'777777');await spouse.locator('.desktop-add:visible,.mobile-add button:visible').click();
    const spouseDialog=spouse.getByRole('dialog',{name:'支出を記録',exact:true});check((await spouseDialog.locator('.compact-payment-summary').innerText()).includes('自分（'+wife.name+'）'),'Spouse compact default uses own linked identity');await spouseDialog.getByRole('button',{name:'キャンセル',exact:true}).click();await spouse.close();
    check(errors.length===0,'No browser exceptions: '+errors.join(','));
  }catch(error){await page.screenshot({path:`${output}/${engineName}-failure.png`,fullPage:true});throw error;}finally{await browser.close();}
}
console.log(`PASS: ${checks} compact daily entry, recurring confirmation, retry and comparison checks; ${output}`);
