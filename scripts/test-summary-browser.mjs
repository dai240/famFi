import { chromium,webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { navigate } from './browser-navigation.mjs';
const base='http://127.0.0.1:3101',output='test-results/summary';await mkdir(output,{recursive:true});let checks=0;
function check(value,message){assert.ok(value,message);checks++;}
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch(),page=await browser.newPage({locale:'ja-JP',timezoneId:'Asia/Tokyo'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.setDefaultTimeout(20000);
  try{
    check((await page.request.post(base+'/api/auth/verify',{headers:{origin:base},data:{email:'fixture0@example.invalid',token:'111111'}})).ok(),'Fixture login');
    await page.goto(base+'/expenses');const masters=await(await page.request.get(base+'/api/masters')).json();
    if(!masters.parties.find(p=>p.id===masters.selfPartyId).profileConfirmed)await page.getByRole('button',{name:'確認して始める',exact:true}).click();
    await page.getByRole('dialog',{name:'利用者を確認',exact:true}).waitFor({state:'hidden'});
    const bank=masters.paymentSources.find(s=>s.method==='bank'&&masters.parties.some(p=>p.id===s.fundingPartyId&&p.systemKey==='shared'));
    for(const [width,height] of [[320,568],[390,844],[844,390],[1280,800]]){
      await page.setViewportSize({width,height});await navigate(page,'支出');await page.getByRole('button',{name:'サマリー',exact:true}).click();
      await page.getByRole('heading',{name:'家計サマリー',exact:true}).waitFor();await page.getByLabel('サマリーの期間').selectOption('month');await page.getByLabel('サマリーの対象月').fill('2024-02');
      await page.getByTestId('summary-expenses').filter({hasText:'14,100'}).waitFor();
      check(await page.getByLabel('サマリーの共通口座').inputValue()===bank.id,'Selected common bank');
      check(await page.getByTestId('summary-range').innerText().then(t=>t.includes('2024/02/01')&&t.includes('2024/02/29')),'Leap-year range');
      check(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),'Summary fits viewport');
      check(await page.locator('.summary-controls').evaluate(el=>[...el.querySelectorAll('input,select')].every(n=>n.getBoundingClientRect().right<=innerWidth&&n.getBoundingClientRect().left>=0)),'Controls stay inside viewport');
      check(await page.locator('.summary-controls').evaluate(el=>[...el.querySelectorAll('input,select')].every(n=>n.getBoundingClientRect().height>=40)),'Controls have usable tap targets');
      await page.screenshot({path:`${output}/${name}-${width}-overview.png`,animations:'disabled',fullPage:true});
      await page.getByRole('button',{name:'口座入金の明細を開く',exact:true}).click();let dialog=page.getByRole('dialog',{name:'口座入金の明細',exact:true});
      await dialog.locator('.summary-detail-list button').filter({hasText:'50,000'}).click();let editor=page.getByRole('dialog',{name:'入出金を編集',exact:true});
      check(await editor.getByLabel('金額（円）',{exact:true}).isDisabled(),'Imported amount stays immutable');check(await editor.getByLabel('取引日',{exact:true}).isDisabled(),'Imported date stays immutable');
      check(await editor.evaluate(el=>el.scrollWidth<=el.clientWidth),'Nested bank editor fits');
      await editor.getByRole('button',{name:'キャンセル',exact:true}).click();await editor.waitFor({state:'hidden'});await dialog.getByRole('button',{name:'Close',exact:true}).click();
      await page.getByLabel('サマリーの期間').selectOption('three');await page.getByLabel('サマリーの対象月').fill('2024-03');await page.getByTestId('summary-expenses').filter({hasText:'19,800'}).waitFor();
      await page.getByLabel('サマリーの期間').selectOption('six');await page.getByLabel('サマリーの対象月').fill('2024-06');await page.getByTestId('summary-range').filter({hasText:'2024/06/30'}).waitFor();
      check((await page.getByTestId('summary-expenses').innerText()).includes('19,800'),'Six month totals match');
      await page.getByRole('tab',{name:'口座入出金',exact:true}).click();await page.locator('.summary-chart .recharts-bar-rectangle path').first().waitFor();
      check(await page.locator('.summary-chart .recharts-bar-rectangle path').count()>0,'Nonblank cash chart');
      check(await page.locator('.summary-chart').evaluate(el=>el.getBoundingClientRect().height>=200&&el.getBoundingClientRect().width>200),'Stable chart dimensions');
      await page.locator('.summary-trend').scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/${name}-${width}-chart.png`,animations:'disabled'});
      await page.getByRole('button',{name:'2024年2月のサマリー',exact:true}).click();await page.getByTestId('summary-expenses').filter({hasText:'14,100'}).waitFor();check(await page.getByLabel('サマリーの期間').inputValue()==='month','Trend drills into month');
      await page.getByLabel('サマリーの期間').selectOption('year');await page.getByLabel('サマリーの対象年').selectOption('2024');await page.getByTestId('summary-range').filter({hasText:'2024/12/31'}).waitFor();
      await page.getByLabel('サマリーの期間').selectOption('all');await page.getByTestId('summary-range').filter({hasText:'2024/01/01'}).waitFor();
      const exported=page.waitForEvent('download');await page.getByRole('button',{name:'サマリーをCSV出力',exact:true}).click();check((await exported).suggestedFilename()==='famfi-household-summary.csv','Summary CSV export');
      await page.getByLabel('サマリーの期間').selectOption('deposit');await page.getByTestId('summary-range').filter({hasText:'口座は入金日を含む'}).waitFor();
      check((await page.getByTestId('summary-range').innerText()).includes('2024/'),'Last-deposit period uses confirmed family deposit');
      await page.getByLabel('サマリーの期間').selectOption('month');await page.getByLabel('サマリーの対象月').fill('2024-04');
      await page.getByRole('button',{name:/入金の人物・用途を確認/}).click();dialog=page.getByRole('dialog',{name:'未確認の入金',exact:true});
      await dialog.locator('.summary-detail-list button').first().click();editor=page.getByRole('dialog',{name:'入出金を編集',exact:true});
      await editor.getByLabel('種類',{exact:true}).selectOption('contribution');await editor.getByLabel('関係者',{exact:true}).selectOption(masters.selfPartyId);
      await editor.getByRole('button',{name:'保存',exact:true}).click();await editor.waitFor({state:'hidden'});await dialog.locator('.summary-detail-list button').first().waitFor();
      await dialog.getByRole('button',{name:'Close',exact:true}).click();
      const current=await(await page.request.get(base+'/api/finance/summary?period=month&month=2024-04&source='+bank.id)).json();
      check(current.totals.deposits>0&&current.totals.incoming===52,'Metadata review retains amount and updates contribution');
      check((await page.locator('.summary-people').innerText()).includes('2024/04/'),'Latest person deposit is refreshed');
      check(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),'Review keeps page inside viewport');
      await page.getByRole('tab',{name:'負担明細',exact:true}).click();await page.getByRole('heading',{name:'家計への負担',exact:true}).waitFor();
      check(await page.getByRole('tab',{name:'全期間',exact:true}).isVisible(),'Existing contribution view remains available');
      await page.getByRole('tab',{name:'個人の貸し借り',exact:true}).click();await page.getByRole('heading',{name:'個人の貸し借り',exact:true}).waitFor();
    }
    await navigate(page,'支出');await page.getByRole('button',{name:'サマリー',exact:true}).click();
    await page.route('**/api/finance/summary?**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic unavailable'})}));
    await page.getByRole('button',{name:'負担・貸し借りを更新',exact:true}).click();await page.getByRole('alert').filter({hasText:'Synthetic unavailable'}).waitFor();
    check(!await page.getByTestId('summary-expenses').isVisible(),'Failures never display zero totals');await page.unroute('**/api/finance/summary?**');
    await page.getByRole('button',{name:'再読み込み',exact:true}).click();await page.getByTestId('summary-expenses').waitFor();
    await page.getByLabel('サマリーの期間').selectOption('month');await page.getByLabel('サマリーの対象月').fill('2024-01');
    await page.getByTestId('summary-expenses').filter({hasText:'5,000'}).waitFor();await page.getByRole('button',{name:'家計支出の明細を開く',exact:true}).click();
    await page.getByRole('dialog',{name:'家計支出の明細',exact:true}).locator('.summary-detail-list button').filter({hasText:'Card detail'}).click();
    await page.getByRole('heading',{name:'支出',exact:true}).waitFor();check(await page.getByLabel('表示する月').inputValue()==='2024-01','Detail opens accounting month instead of actual purchase month');
    check(!errors.length,'No page errors: '+errors.join(','));
  }catch(e){await page.screenshot({path:`${output}/${name}-failure.png`});throw e;}finally{await browser.close();}
}
console.log(`PASS: ${checks} summary browser checks across Chromium/WebKit and 320/390/844/1280px; ${output}`);
