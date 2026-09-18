import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { seedReview } from './monthly-review-fixture.mjs';
import { navigate } from './browser-navigation.mjs';
const base='http://127.0.0.1:3101',output='test-results/monthly-review';
await mkdir(output,{recursive:true});let checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
async function choose(page,scope,label,name){await scope.getByRole('combobox',{name:label,exact:true}).click();await page.getByRole('option',{name,exact:true}).click();}
async function login(page,token){
  await page.goto(base+'/login');await page.waitForLoadState('networkidle');
  await page.getByLabel('メールアドレス').fill('fixture0@example.invalid');await page.getByRole('button',{name:'確認コードを送信',exact:true}).click();await page.getByLabel('確認コード',{exact:true}).fill(token);await page.getByRole('button',{name:'ログイン',exact:true}).click();await page.waitForURL('**/expenses');
  const masters=await(await page.request.get(base+'/api/masters')).json();
  if(masters.parties.find(p=>p.id===masters.selfPartyId)?.profileConfirmed===false)await page.getByRole('button',{name:'確認して始める',exact:true}).click();
  await page.getByRole('dialog',{name:'利用者を確認',exact:true}).waitFor({state:'hidden'});
}
async function fit(page){
  check(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth),'No page horizontal overflow');
  const bad=await page.locator('.monthly-review').evaluate(el=>[...el.querySelectorAll('summary,button,span,strong,small')].filter(e=>e.getClientRects().length).filter(e=>{const r=e.getBoundingClientRect(),p=el.getBoundingClientRect();return r.left<p.left-1||r.right>p.right+1||e.scrollWidth>e.clientWidth+1;}).map(e=>e.textContent));
  check(bad.length===0,'Review text and controls fit: '+bad.join(','));
}
for(const [name,engine,startMonth] of [['chromium',chromium,'2022-07'],['webkit',webkit,'2022-10']]){
  const browser=await engine.launch(),context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  try{
    await login(page,'111111');
    const req=async(path,method='GET',data,status=200)=>{const r=await page.request.fetch(base+path,{method,headers:{origin:base},data});check(r.status()===status,path+': '+await r.text());return r.json();};
    let month=startMonth;
    while((await req('/api/expenses?month='+month)).count>0){month=String(Number(month.slice(0,4))+1)+month.slice(4);assert.ok(month<'2026-01','Use a fresh disposable stack');}
    const f=await seedReview(req,month),total=(await req('/api/expenses?month='+month)).total;
    await page.getByLabel('表示する月').fill(month);
    const review=page.getByRole('region',{name:'この月の確認',exact:true}),root=review.locator(':scope > details > summary');
    await review.getByText('確認待ち 3件',{exact:true}).waitFor();
    check(!await review.getByRole('button',{name:'定期支出 1件',exact:true}).isVisible(),'Review starts collapsed');
    await root.focus();await page.keyboard.press('Enter');
    for(const [width,height] of [[320,568],[390,844],[844,390],[1280,900]]){
      await page.setViewportSize({width,height});await review.scrollIntoViewIfNeeded();await fit(page);
      check((await review.innerText()).includes('確認日前・延期中 2件'),'Future and snoozed entries remain neutral');
      check((await root.innerText()).includes('任意の整理 1件'),'Unallocated summary is optional, not in badge');
      const payments=review.locator('.review-group').filter({has:page.locator('summary',{hasText:'支払情報の確認'})});
      if(!await payments.evaluate(e=>e.open))await payments.locator(':scope > summary').click();
      await payments.getByRole('button',{name:/支払方法を確認する買い物/}).click();
      let dialog=page.getByRole('dialog',{name:'支出を編集',exact:true});await dialog.waitFor();
      check(await dialog.getByLabel('金額（円）').inputValue()==='2300','Opens exact payment record');
      check(await dialog.getByLabel('支出月',{exact:true}).inputValue()===month,'Month precision remains intact');
      await dialog.getByRole('button',{name:'キャンセル',exact:true}).click();
      const summaries=review.locator('.review-optional');if(!await summaries.evaluate(e=>e.open))await summaries.locator(':scope > summary').click();
      await page.getByRole('button',{name:'カレンダー',exact:true}).click();
      await summaries.getByRole('button',{name:/後から整理するカード分/}).click();
      dialog=page.getByRole('dialog',{name:f.summary.name,exact:true});await dialog.waitFor();
      check((await dialog.locator('.summary-amounts').innerText()).includes('9,000'),'Linked detail deducted from summary remainder');
      await dialog.getByRole('button',{name:'Close',exact:true}).click();
      check(await page.getByRole('button',{name:'一覧',exact:true}).getAttribute('aria-pressed')==='true','Summary shortcut returns from calendar to list');
      await review.getByRole('button',{name:'定期支出 1件',exact:true}).first().click();
      check(await page.getByLabel('定期支出の表示月').inputValue()===month,'Recurring shortcut preserves period');
      await page.locator('.recurring-list > li').filter({hasText:f.rule.name}).getByRole('button',{name:'この月を登録',exact:true}).waitFor();
      await navigate(page,'支出');await review.getByRole('button',{name:'単発の予定 1件',exact:true}).first().click();
      await page.getByRole('checkbox',{name:'この月の予定のみ',exact:true}).waitFor();
      check(await page.getByRole('checkbox',{name:'この月の予定のみ',exact:true}).isChecked(),'Plan shortcut scopes selected month');
      check(await page.locator('.plans-workspace .recurring-list').getByText(f.oldPlan.name,{exact:true}).count()===0,'Other month plan excluded');
      await page.getByRole('checkbox',{name:'この月の予定のみ',exact:true}).uncheck();await page.locator('.plans-workspace').getByText(f.oldPlan.name,{exact:true}).first().waitFor();
      await navigate(page,'支出');
      const others=review.locator('.review-group').filter({has:page.locator('summary',{hasText:'別の月の確認待ち'})});
      if(!await others.evaluate(e=>e.open))await others.locator(':scope > summary').click();
      const previous=others.locator('.review-other-period').filter({hasText:`${Number(f.previous.slice(0,4))}年${Number(f.previous.slice(5))}月`});
      await previous.getByRole('button',{name:'定期支出 1件',exact:true}).click();
      check(await page.getByLabel('定期支出の表示月').inputValue()===f.previous,'Older shortcut does not open wrong month');
      await navigate(page,'支出');check(await page.getByLabel('表示する月').inputValue()===month,'Ledger month retained after checking old period');
      await review.scrollIntoViewIfNeeded();await fit(page);await page.screenshot({path:`${output}/${name}-${width}.png`,animations:'disabled'});
    }
    check((await req('/api/expenses?month='+month)).total===total,'Navigation never changes totals or posts expenses');
    await page.route('**/api/attention?*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'確認データを取得できません'})}));
    await page.getByRole('button',{name:'一覧を更新',exact:true}).click();await review.getByRole('button',{name:'確認事項を再読み込み',exact:true}).waitFor();
    check(!(await review.innerText()).includes('確認待ちなし'),'Request failure is not presented as all-clear');
    await page.unroute('**/api/attention?*');await review.getByRole('button',{name:'確認事項を再読み込み',exact:true}).click();await review.getByText('確認待ち 3件',{exact:true}).waitFor();await root.click();
    const payments=review.locator('.review-group').filter({has:page.locator('summary',{hasText:'支払情報の確認'})});await payments.locator(':scope > summary').click();await payments.getByRole('button',{name:/支払方法を確認する買い物/}).click();
    const dialog=page.getByRole('dialog',{name:'支出を編集',exact:true});await choose(page,dialog,'支払いの扱い','共通資金で支払い');
    await dialog.getByRole('button',{name:'保存',exact:true}).click();await dialog.waitFor({state:'hidden'});await review.getByText('確認待ち 2件',{exact:true}).waitFor();
    check((await req('/api/attention?month='+month)).review.payments.length===0,'Saving resolves review through API and DB');
    check((await req('/api/expenses?month='+month)).total===total,'Resolving payment does not change total');
    await page.getByLabel('表示する月').fill('2098-11');await review.getByText('確認待ちなし',{exact:true}).waitFor();
    check(await review.getByText('支払情報の確認',{exact:false}).count()===0,'No stale payment review after month switch');
    check(errors.length===0,'No browser exceptions: '+errors.join(','));
  }catch(error){await page.screenshot({path:`${output}/${name}-failure.png`,fullPage:true});throw error;}finally{await browser.close();}
}
console.log(`PASS: ${checks} monthly review browser/API/data checks; ${output}`);
