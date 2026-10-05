import { chromium,webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { navigate,expandExpenseFields } from './browser-navigation.mjs';
const base='http://127.0.0.1:3101',output='test-results/finance';await mkdir(output,{recursive:true});let checks=0,index=0;
function check(value,message){assert.ok(value,message);checks++;}
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch(),page=await browser.newPage({locale:'ja-JP',timezoneId:'Asia/Tokyo'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.setDefaultTimeout(20000);
  try{
    check((await page.request.post(base+'/api/auth/verify',{headers:{origin:base},data:{email:'fixture0@example.invalid',token:'111111'}})).ok(),'Fixture login');
    await page.goto(base+'/expenses');const masters=await(await page.request.get(base+'/api/masters')).json();
    if(!masters.parties.find(p=>p.id===masters.selfPartyId).profileConfirmed)await page.getByRole('button',{name:'確認して始める',exact:true}).click();
    await page.getByRole('dialog',{name:'利用者を確認',exact:true}).waitFor({state:'hidden'});
    for(const [width,height] of [[320,568],[390,844],[844,390],[1280,800]]){
      index++;const year=Number(process.env.FAMFI_TEST_YEAR??2040)+index,month=`${year}-01`;await page.setViewportSize({width,height});
      await navigate(page,'入出金');await page.getByRole('button',{name:'楽天銀行CSV取込',exact:true}).click();
      let dialog=page.getByRole('dialog',{name:'楽天銀行CSVを取り込む',exact:true});await dialog.waitFor();
      const bank=masters.paymentSources.find(s=>s.method==='bank'&&masters.parties.some(p=>p.id===s.fundingPartyId&&p.systemKey==='shared'));
      await dialog.getByLabel('取込先の口座').selectOption(bank.id);
      const csv=Buffer.from(`取引日,入出金(円),取引後残高(円),入出金内容\n${year}0201,10000,20000,Synthetic transfer\n${year}0227,-1234,18766,ラクテンカ－ト゛サ－ヒ゛ス`);
      await dialog.getByLabel('楽天銀行の取引明細CSV').setInputFiles({name:'synthetic-bank.csv',mimeType:'text/csv',buffer:csv});
      await dialog.getByRole('button',{name:'内容を確認',exact:true}).click();await dialog.getByRole('checkbox').waitFor();
      check(await dialog.getByRole('button',{name:'取り込む',exact:true}).isDisabled(),'Import requires source and period acknowledgement');
      await dialog.getByRole('checkbox').check();check(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),'Import dialog fits');
      await page.screenshot({path:`${output}/${name}-${width}-import.png`,animations:'disabled'});
      await dialog.getByRole('button',{name:'取り込む',exact:true}).click();await dialog.waitFor({state:'hidden'});
      const pending=page.locator('.bank-posting details').first();if(await pending.getAttribute('open')===null)await pending.locator('summary').click();
      await pending.getByLabel('計上月',{exact:true}).fill(month);await pending.locator('.bank-pending-list input').first().check();
      await pending.getByRole('button',{name:'選択分を支出に計上',exact:true}).click();await pending.locator('.bank-pending-list input').waitFor({state:'hidden'});
      const ledger=await(await page.request.get(base+'/api/expenses?month='+month)).json();check(ledger.total===1234,'Bank debit is prior month spending');check(ledger.count===0,'Unknown purchaser not fabricated');
      const summary=(await(await page.request.get(base+'/api/summaries?month='+month)).json())[0],card=masters.paymentSources.find(s=>s.id===summary.paymentSourceId),detailName=`Optional detail ${name} ${width}`;
      const result=await page.request.post(base+'/api/summaries/'+summary.id,{headers:{origin:base},data:{action:'create-detail',version:summary.version,expenseId:randomUUID(),expense:{amount:100,date:`${year}-02-02`,categoryId:'food',costClass:'variable',description:detailName,memo:'',paymentSourceId:card.id,paidByPartyId:card.fundingPartyId,usedByPartyId:masters.selfPartyId,usedByText:'',beneficiaryKind:'family',beneficiaryPartyId:null,beneficiaryText:'',paymentTreatment:'shared',reimbursementStatus:'not_required',reimbursementFromPartyId:null,reimbursementToPartyId:null,reimbursementAmount:0}}});check(result.ok(),'Create optional detail with actual date outside accounting month');
      await navigate(page,'支出');await page.getByLabel('表示する月').fill(month);await page.locator('.expense-row').filter({hasText:detailName}).click();
      const detailEditor=page.getByRole('dialog',{name:'支出を編集',exact:true});await expandExpenseFields(detailEditor);await detailEditor.getByLabel('支出日',{exact:true}).fill(`${year}-03-03`);await detailEditor.getByRole('button',{name:'保存',exact:true}).click();await detailEditor.waitFor({state:'hidden'});
      check(await page.getByLabel('表示する月').inputValue()===month,'Editing purchase date keeps the accounting month visible');check((await(await page.request.get(base+'/api/expenses?month='+month)).json()).total===1234,'Optional detail edits keep the household total unchanged');
      const nav=page.getByRole('navigation',{name:'メインメニュー',exact:true});
      if(await nav.isVisible()){await nav.getByRole('button',{name:'メニュー',exact:true}).click();await page.getByRole('dialog',{name:'メニュー',exact:true}).getByRole('button',{name:'負担・個人の貸し借り',exact:true}).click();}
      else await page.getByRole('tab',{name:'負担・貸し借り',exact:true}).click();
      await page.getByRole('heading',{name:'家計への負担',exact:true}).waitFor();await page.getByRole('tab',{name:'個人の貸し借り',exact:true}).click();await page.getByRole('heading',{name:'個人の貸し借り',exact:true}).waitFor();
      await page.getByRole('button',{name:'記録',exact:true}).click();dialog=page.getByRole('dialog',{name:'個人の貸し借り',exact:true});
      const title=`Private ${name} ${width} ${randomUUID().slice(0,6)}`;
      await dialog.getByLabel('内容',{exact:true}).fill(title);await dialog.getByLabel('金額（円）',{exact:true}).fill('5000');await dialog.getByLabel('日付',{exact:true}).fill(`${year}-02-15`);
      check(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),'Debt editor fits');const save=await dialog.getByRole('button',{name:'保存',exact:true}).boundingBox();check(save.y>=0&&save.y+save.height<=height,'Debt save stays visible');
      await page.screenshot({path:`${output}/${name}-${width}-debt.png`,animations:'disabled'});
      await dialog.getByRole('button',{name:'保存',exact:true}).click();await dialog.waitFor({state:'hidden'});
      const debtButton=page.locator('.finance-debt-row').filter({hasText:title});await debtButton.click();dialog=page.getByRole('dialog',{name:'個人の貸し借り',exact:true});
      await dialog.locator('.debt-repayment summary').click();const cash=masters.paymentSources.find(s=>s.method==='cash'&&s.fundingPartyId===masters.selfPartyId);
      await dialog.getByLabel('実際の返済元').selectOption(cash.id);await dialog.getByLabel('返した金額（円）').fill('1200');await dialog.getByLabel('返済日',{exact:true}).fill(`${year}-02-20`);
      await dialog.getByRole('button',{name:'返済を保存',exact:true}).click();await dialog.waitFor({state:'hidden'});await debtButton.waitFor();check((await debtButton.innerText()).includes('3,800'),'Partial private repayment is retained');
      check((await(await page.request.get(base+'/api/expenses?month='+month)).json()).total===1234,'Private repayment never affects household spending');
      check(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),'Finance page has no horizontal overflow');await page.screenshot({path:`${output}/${name}-${width}-list.png`,animations:'disabled',fullPage:true});
      const download=page.waitForEvent('download');await page.getByRole('button',{name:'負担・貸し借りのCSV出力',exact:true}).click();check((await download).suggestedFilename()==='famfi-debts.csv','Private records export');
      await navigate(page,'支出');
    }
    check(!errors.length,'No page errors: '+errors.join(','));
  }catch(e){await page.screenshot({path:`${output}/${name}-failure.png`});throw e;}finally{await browser.close();}
}
console.log(`PASS: ${checks} finance browser checks, Chromium/WebKit, mobile/landscape/desktop; ${output}`);
