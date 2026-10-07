// Synthetic records on the disposable local stack only.
import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { navigate, openMasters } from './browser-navigation.mjs';

const base='http://127.0.0.1:3101',output='test-results/ui-review';
await mkdir(output,{recursive:true});
let checks=0;
function check(value,message){assert.ok(value,message);checks++;}
for(const [name,engine,year] of [['chromium',chromium,2006],['webkit',webkit,2007]]){
  const browser=await engine.launch(),page=await browser.newPage({locale:'ja-JP',timezoneId:'Asia/Tokyo'}),errors=[];
  page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  async function json(path,data){const r=data?await page.request.post(base+path,{headers:{origin:base},data}):await page.request.get(base+path);check(r.ok(),path+' succeeds');return r.json();}
  try{
    await json('/api/auth/verify',{email:'fixture0@example.invalid',token:'111111'});
    await page.goto(base+'/expenses');const masters=await json('/api/masters');
    if(!masters.parties.find(p=>p.id===masters.selfPartyId).profileConfirmed)await page.getByRole('button',{name:'確認して始める',exact:true}).click();
    await page.getByRole('dialog',{name:'利用者を確認',exact:true}).waitFor({state:'hidden'});
    const source=masters.paymentSources.find(s=>s.isDefault),month=`${year}-06`,emptyMonth=`${year}-07`;
    const existing=await json('/api/summaries?month='+month);
    if(!existing.some(row=>row.name==='Synthetic monthly card'))await json('/api/summaries',{id:randomUUID(),month,name:'Synthetic monthly card',amount:12000,paymentSourceId:source.id,memo:'Synthetic UI verification',complete:true});
    for(const [width,height] of [[320,568],[390,680],[844,390],[1280,800]]){
      await page.setViewportSize({width,height});await navigate(page,'支出');
      await page.getByLabel('表示する月').fill(emptyMonth);await page.getByTestId('monthly-total').filter({hasText:/[￥¥]0/}).waitFor();
      await page.getByLabel('楽天カード分の確認').getByText('楽天カード分 未反映',{exact:true}).waitFor();
      check(!await page.getByText('確認待ちなし',{exact:true}).isVisible(),'No contradictory all-clear beside missing card data');
      const insights=page.getByRole('button',{name:'内訳・比較',exact:true});
      if(await insights.getAttribute('aria-expanded')==='true')await insights.click();
      check(!await page.getByLabel('費用の区分別集計').isVisible(),'Secondary totals start collapsed');
      await insights.click();await page.getByLabel('前月比較').getByText('この月は未反映',{exact:true}).waitFor();
      check(!(await page.getByLabel('前月比較').innerText()).includes('-100'),'Missing month never looks like a spending reduction');
      await insights.click();
      await page.getByLabel('表示する月').fill(month);await page.getByTestId('monthly-total').filter({hasText:'12,000'}).waitFor();
      await page.getByRole('button',{name:/Synthetic monthly card/}).waitFor();await page.evaluate(()=>window.scrollTo(0,0));
      check((await page.locator('.expense-record-count').innerText()).includes('まとめ 1件'),'Summary-only month has a record count');
      check(await page.getByText('月まとめを記録済み · 個別明細の追加は任意です',{exact:true}).isVisible(),'Optional details are not presented as missing work');
      check(!await page.locator('.empty-ledger').isVisible(),'No giant empty state for a recorded month');
      check(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),'Expense page fits viewport');
      const switchBox=await page.getByRole('group',{name:'支出の表示方法'}).boundingBox();
      if(width===390)check(switchBox.y+switchBox.height<height-74,'List/calendar switch fits first phone viewport');
      await page.screenshot({path:`${output}/${name}-${width}-expenses.png`,animations:'disabled'});
      await page.getByRole('button',{name:'カレンダー',exact:true}).click();
      const undated=page.getByRole('button',{name:/月まとめ・日付未定/});await undated.waitFor();
      const grid=await page.locator('.calendar-grid').boundingBox(),monthBox=await undated.boundingBox();
      check(monthBox.y<grid.y,'Month-only records are visible above daily cells');
      await undated.click();await page.locator('.calendar-entry').filter({hasText:'Synthetic monthly card'}).waitFor();
      check((await undated.innerText()).includes('12,000'),'Month-only amount remains accurate');
      await page.getByRole('button',{name:'一覧',exact:true}).click();
      const add=width<768?page.getByRole('navigation',{name:'メインメニュー'}).getByRole('button',{name:'支出を記録',exact:true}):page.locator('.desktop-add');
      await add.click();let dialog=page.getByRole('dialog',{name:'支出を記録',exact:true});
      check(await dialog.getByRole('button',{name:'支払情報を変更',exact:true}).isVisible(),'Required payment defaults stay inspectable');
      check(!await dialog.getByLabel('メモ 任意',{exact:true}).isVisible(),'Optional memo starts collapsed');
      await dialog.getByLabel('金額（円）',{exact:true}).fill('1234');await dialog.getByLabel('内容 任意',{exact:true}).fill(`UI entry ${name} ${width}`);
      await dialog.locator('.entry-extras summary').click();await dialog.getByLabel('メモ 任意',{exact:true}).fill('Retain collapsed memo');
      await dialog.locator('.entry-extras summary').click();
      const save=await dialog.getByRole('button',{name:'保存',exact:true}).boundingBox();
      check(save.y>=0&&save.y+save.height<=height,'Save stays visible in short screens');
      await page.screenshot({path:`${output}/${name}-${width}-entry.png`,animations:'disabled'});
      await dialog.getByRole('button',{name:'保存',exact:true}).click();await dialog.waitFor({state:'hidden'});
      const savedMonth=await page.getByLabel('表示する月').inputValue();
      const rows=await json('/api/expenses?month='+savedMonth),entry=rows.expenses.find(e=>e.description===`UI entry ${name} ${width}`);
      check(entry?.memo==='Retain collapsed memo','Collapsing optional fields preserves their saved values');
      check(entry.paymentSourceId===source.id&&entry.usedByPartyId===masters.selfPartyId&&entry.beneficiaryKind==='family','Household, person and source defaults are unchanged');
      await navigate(page,'家計サマリー');await page.getByLabel('サマリーの期間').selectOption('month');await page.getByLabel('サマリーの対象月').fill(month);
      await page.getByTestId('summary-expenses').filter({hasText:'12,000'}).waitFor();await page.evaluate(()=>window.scrollTo(0,0));
      if(width===390){const amount=await page.getByTestId('summary-expenses').boundingBox();check(amount.y+amount.height<height-74,'Summary amount fits first phone viewport');}
      check(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),'Summary has no horizontal overflow');
      await page.screenshot({path:`${output}/${name}-${width}-summary.png`,animations:'disabled'});
      if(width<768)check(await page.getByRole('navigation',{name:'メインメニュー'}).getByRole('button',{name:'家計サマリー',exact:true}).getAttribute('aria-current')==='page','Summary has a direct active bottom-nav destination');
      await navigate(page,'立替・精算');check(await page.getByRole('heading',{name:'立替・精算',exact:true}).isVisible(),'Reimbursement remains reachable from menu');
      await openMasters(page);dialog=page.getByRole('dialog',{name:'家計の設定',exact:true});
      await dialog.getByRole('button',{name:'食費の詳細カテゴリ',exact:true}).click();
      check(await dialog.getByRole('button',{name:'食材を編集',exact:true}).isVisible(),'Parent expands its child categories');
      await dialog.getByRole('button',{name:'食費の詳細カテゴリ',exact:true}).click();
      check(!await dialog.getByRole('button',{name:'食材を編集',exact:true}).isVisible(),'Parent collapses child categories');
      check(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),'Master dialog fits');
      await dialog.getByRole('button',{name:'Close',exact:true}).click();
      await navigate(page,'入出金');check(await page.getByRole('button',{name:'楽天銀行CSV取込',exact:true}).isVisible(),'Bank import remains a direct action');
      await navigate(page,'予定・定期');check(await page.getByRole('tab',{name:'定期の設定',exact:true}).isVisible(),'Recurring settings remain distinct from monthly confirmation');
    }
    await navigate(page,'支出');await page.getByLabel('表示する月').fill(emptyMonth);
    await page.getByTestId('monthly-total').filter({hasText:/[￥¥]0/}).waitFor();
    await page.route('**/api/finance/bank?month=**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic bank unavailable'})}));
    await page.getByRole('button',{name:'一覧を更新',exact:true}).click();
    await page.getByLabel('楽天カード分の確認').getByRole('alert').waitFor();
    check((await page.getByLabel('楽天カード分の確認').innerText()).includes('取得できません'),'A failed status read is not mistaken for zero or confirmed');
    await page.unroute('**/api/finance/bank?month=**');await page.getByRole('button',{name:'カード分を再読み込み',exact:true}).click();
    await page.getByLabel('楽天カード分の確認').getByText('楽天カード分 未反映',{exact:true}).waitFor();
    check(!errors.length,'No browser errors: '+errors.join(','));
  }catch(e){await page.screenshot({path:`${output}/${name}-failure.png`});throw e;}finally{await browser.close();}
}
console.log(`PASS: ${checks} UI checks, Chromium/WebKit, 320/390/844/1280px; ${output}`);
