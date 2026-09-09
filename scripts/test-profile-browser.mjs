// Only loopback fixtures. Real invitations and production profiles are never changed.
import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const base='http://127.0.0.1:3101',output=path.resolve('test-results/profiles');
await mkdir(output,{recursive:true});
let checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
const combo=(scope,name)=>scope.getByRole('combobox',{name,exact:true});
async function choose(page,scope,label,name){await combo(scope,label).click();await page.getByRole('option',{name,exact:true}).click();}
async function login(page,token){
  await page.goto(base+'/login');await page.getByLabel('メールアドレス').fill('fixture0@example.invalid');
  await page.getByRole('button',{name:'確認コードを送信',exact:true}).click();await page.getByLabel('確認コード',{exact:true}).fill(token);
  await page.getByRole('button',{name:'ログイン',exact:true}).click();await page.waitForURL('**/expenses');await page.locator('[aria-label="カテゴリで絞り込み"]').waitFor();
}
async function ready(page){await page.reload();await combo(page,'カテゴリで絞り込み').waitFor();}
async function fits(page,scope){
  check(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),'Page fits horizontally');
  check(await scope.evaluate(el=>el.scrollWidth<=el.clientWidth),'Surface fits horizontally');
  const box=await scope.boundingBox(),size=page.viewportSize();check(box&&box.x>=0&&box.y>=0&&box.x+box.width<=size.width+1&&box.y+box.height<=size.height+1,'Surface stays inside viewport');
}
async function submitProfile(page,dialog,name){
  await dialog.getByLabel('表示名',{exact:true}).fill(name);await dialog.getByRole('button',{name:/^(確認して始める|保存)$/}).click();await dialog.waitFor({state:'hidden'});
  check(await page.locator('.profile-header').innerText().then(t=>t.includes(name)),'Header identifies signed-in person');
}
for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch();const errors=[];
  const context=await browser.newContext({locale:'ja-JP',timezoneId:'Asia/Tokyo',hasTouch:true});
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  let partnerContext;
  try{
    // The second engine uses the other fresh household for its real first-login test.
    await login(page,engineName==='chromium'?'111111':'222222');
    let profile=page.getByRole('dialog',{name:'利用者を確認',exact:true});await profile.waitFor();
    check((await profile.locator('.profile-identity').innerText()).includes('夫'),'Pre-linked role is read-only');
    await page.keyboard.press('Escape');check(await profile.isVisible(),'First confirmation cannot be accidentally dismissed');
    await profile.getByRole('button',{name:'本人が違う',exact:true}).click();check(await profile.getByRole('button',{name:'確認して始める'}).isDisabled(),'Mismatch never claims another person');
    await profile.getByRole('button',{name:'本人の確認に戻る'}).click();
    await profile.getByLabel('表示名',{exact:true}).fill('あ'.repeat(11));check(await profile.getByRole('button',{name:'確認して始める'}).isDisabled(),'Eleven characters cannot submit');
    await profile.getByLabel('表示名',{exact:true}).fill('あいうえおかきくけこ');
    for(const [width,height] of [[320,700],[390,844],[390,600],[844,390],[1280,900]]){
      console.log(`Checking first profile ${engineName} ${width}x${height}`);await page.setViewportSize({width,height});await fits(page,profile);
      await profile.getByRole('button',{name:'確認して始める'}).scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(output,`${engineName}-${width}-first.png`),animations:'disabled'});
    }
    await submitProfile(page,profile,'あいうえおかきくけこ');await ready(page);check(await page.getByRole('dialog',{name:'利用者を確認',exact:true}).count()===0,'Confirmation persists across reload');
    if(engineName==='webkit'){
      await page.getByRole('button',{name:'表示名の設定',exact:true}).click();await submitProfile(page,page.getByRole('dialog',{name:'表示名の設定',exact:true}),'夫');
      await page.getByRole('button',{name:'ログアウト',exact:true}).click();await page.waitForURL('**/login');await login(page,'111111');
      await page.getByRole('button',{name:'表示名の設定',exact:true}).click();await submitProfile(page,page.getByRole('dialog',{name:'表示名の設定',exact:true}),'あいうえおかきくけこ');
    }
    partnerContext=await browser.newContext({locale:'ja-JP',timezoneId:'Asia/Tokyo',viewport:{width:390,height:844}});
    const wife=await partnerContext.newPage();wife.setDefaultTimeout(15000);wife.on('pageerror',e=>errors.push(e.message));
    await login(wife,'777777');
    if(engineName==='chromium'){const initial=wife.getByRole('dialog',{name:'利用者を確認',exact:true});await initial.waitFor();check((await initial.locator('.profile-identity').innerText()).includes('妻'),'Spouse first login is linked to wife');await submitProfile(wife,initial,'配偶者テスト');}
    else {await wife.getByRole('button',{name:'表示名の設定',exact:true}).click();await submitProfile(wife,wife.getByRole('dialog',{name:'表示名の設定',exact:true}),'配偶者テスト');}
    await ready(page);
    for(const [width,height] of [[320,700],[390,844],[390,600],[844,390],[1280,900]]){
      await page.setViewportSize({width,height});await fits(page,page.locator('.expense-header-inner'));
      await page.locator('.desktop-add:visible,.mobile-add button:visible').click();
      const editor=page.getByRole('dialog',{name:'支出を記録',exact:true});await editor.waitFor();
      check((await combo(editor,'支払元').innerText()).includes('家族カード'),'Shared card remains default');
      check((await combo(editor,'購入・支払いをした人').innerText()).includes('自分（あいうえおかきくけこ）'),'Buyer defaults to linked signed-in person');
      check((await combo(editor,'誰のため').innerText()).includes('家族'),'Family remains beneficiary default');
      await combo(editor,'支払元').click();const list=page.getByRole('listbox');await fits(page,list);
      check((await list.locator('.reference-group-label').allTextContents()).join('|').startsWith('共通|あいうえおかきくけこ（自分）|配偶者テスト'),'Groups shared then self then spouse');
      await page.screenshot({path:path.join(output,`${engineName}-${width}-sources.png`),animations:'disabled'});
      await page.getByRole('option',{name:'配偶者テストのカード',exact:true}).click();
      check((await editor.locator('.payment-outcome').innerText()).includes('家計の共用資金 → 配偶者テスト'),'Spouse is reimbursement recipient regardless of buyer');
      check((await combo(editor,'購入・支払いをした人').innerText()).includes('あいうえおかきくけこ'),'Choosing source does not change buyer');
      await choose(page,editor,'誰のため','その他');await editor.getByRole('textbox',{name:'誰のための支出か',exact:true}).fill('友人');
      await editor.getByRole('button',{name:'キャンセル',exact:true}).click();await editor.waitFor({state:'hidden'});
    }
    // Header profile save failure and conflict preserve the draft; retry is explicit.
    await page.getByRole('button',{name:'表示名の設定',exact:true}).click();profile=page.getByRole('dialog',{name:'表示名の設定',exact:true});
    await profile.getByLabel('表示名',{exact:true}).fill('変更後');
    const response=await wife.request.get(base+'/api/masters');const otherView=await response.json();
    const version=otherView.parties.find(p=>p.id===otherView.parties.find(p=>p.systemKey==='owner').id).version;
    await page.request.put(base+'/api/profile',{headers:{origin:base},data:{name:'別端末',version}});
    await profile.getByRole('button',{name:'保存',exact:true}).click();await profile.getByRole('alert').waitFor();check(await profile.getByLabel('表示名',{exact:true}).inputValue()==='変更後','Conflict retains input');
    await profile.getByRole('button',{name:'最新の設定を読み込む'}).click();await profile.getByRole('button',{name:'保存',exact:true}).click();await profile.waitFor({state:'hidden'});
    await ready(wife);await wife.locator('.desktop-add:visible,.mobile-add button:visible').click();const wifeEditor=wife.getByRole('dialog',{name:'支出を記録',exact:true});
    check((await combo(wifeEditor,'購入・支払いをした人').innerText()).includes('自分（配偶者テスト）'),'Wife sees self, not husband');
    await combo(wifeEditor,'支払元').click();check((await wife.getByRole('listbox').innerText()).includes('変更後のカード'),'Rename reaches spouse sources');await wife.keyboard.press('Escape');
    await wifeEditor.getByRole('button',{name:'キャンセル',exact:true}).click();
    await page.getByRole('button',{name:'マスタ管理',exact:true}).click();const manager=page.getByRole('dialog',{name:'マスタ管理',exact:true});
    await manager.getByRole('tab',{name:'人物・共用資金',exact:true}).click();check(await manager.getByRole('button',{name:'配偶者テストを編集',exact:true}).isDisabled(),'Cannot rename spouse in masters');
    await manager.getByRole('button',{name:'変更後を編集',exact:true}).click();profile=page.getByRole('dialog',{name:'表示名の設定',exact:true});await submitProfile(page,profile,'夫');
    await manager.getByRole('button',{name:'閉じる',exact:true}).click();
    await wife.getByRole('button',{name:'表示名の設定',exact:true}).click();await submitProfile(wife,wife.getByRole('dialog',{name:'表示名の設定',exact:true}),'妻');
    check(errors.length===0,'No browser JavaScript errors: '+errors.join(';'));
  } catch(error){await page.screenshot({path:path.join(output,`${engineName}-failure.png`)}).catch(()=>{});throw error;}
  finally{await partnerContext?.close();await context.close();await browser.close();}
}
console.log(`PASS: ${checks} first-login/profile/grouping/mobile/spouse/browser checks`);
