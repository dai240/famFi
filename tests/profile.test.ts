import test from 'node:test';
import assert from 'node:assert/strict';
import { profileFields, sourceDisplayName, Masters } from '../lib/ledger';
import { paymentSourceGroups, personRole, personLabel, newExpense } from '../lib/household';

test('profile accepts ten Unicode code points, trims names and rejects identity fields',()=>{
  for(const name of ['夫','妻','  ニックネーム  ','あ'.repeat(10),'😀'.repeat(10)])assert.ok(profileFields.safeParse({name,version:1}).success);
  for(const name of ['', ' ', 'あ'.repeat(11), 'a\nb', 'a\u200bb', '家族','自分','その他','共通'])assert.equal(profileFields.safeParse({name,version:1}).success,false);
  for(const key of ['id','partyId','userId','ledgerId','systemKey','profileConfirmed'])assert.equal(profileFields.safeParse({name:'本人',version:1,[key]:'forged'}).success,false);
  assert.equal(profileFields.parse({name:' 本人 ',version:1}).name,'本人');
});
const masters: Masters = {selfPartyId:'wife',categories:[],parties:[
  {id:'husband',name:'だい',kind:'person',systemKey:'owner',archived:false,version:2},
  {id:'wife',name:'配偶者の名前',kind:'person',systemKey:'partner',archived:false,version:2},
  {id:'fund',name:'家計の共用資金',kind:'shared',systemKey:'shared',archived:false,version:1}],
  paymentSources:[
    {id:'his',name:'だいの現金',ownerLabel:'現金',fundingPartyId:'husband',method:'cash',isDefault:false,defaultTreatment:'advance',archived:false,version:1},
    {id:'her',name:'配偶者の名前のカード',ownerLabel:'カード',fundingPartyId:'wife',method:'card',isDefault:false,defaultTreatment:'advance',archived:false,version:1},
    {id:'shared',name:'家族カード',fundingPartyId:'fund',method:'card',isDefault:true,defaultTreatment:'shared',archived:false,version:1},
    {id:'old',name:'昔のカード',fundingPartyId:'wife',method:'card',isDefault:false,defaultTreatment:'advance',archived:true,version:1}]};
test('source names follow the stable funding person, not the viewer or a text replacement',()=>{
  assert.equal(sourceDisplayName(masters.paymentSources[0],masters.parties),'だいの現金');
  assert.equal(sourceDisplayName(masters.paymentSources[0],masters.parties.map(p=>p.id==='husband'?{...p,name:'新しい名前'}:p)),'新しい名前の現金');
  assert.equal(sourceDisplayName({...masters.paymentSources[0],ownerLabel:null,name:'独自の名称'},masters.parties),'独自の名称');
  assert.equal(personRole(masters.parties[0]),'夫');assert.equal(personRole(masters.parties[1]),'妻');
  assert.equal(personLabel('wife',masters,true),'自分（配偶者の名前）');assert.equal(personLabel('wife',masters),'配偶者の名前');
});
test('source grouping prioritizes shared then self, while keeping selected historical sources',()=>{
  assert.deepEqual(paymentSourceGroups(masters,null).map(g=>g.id),['fund','wife','husband']);
  assert.equal(paymentSourceGroups(masters,null)[1].name,'配偶者の名前（自分）');
  assert.deepEqual(paymentSourceGroups(masters,null)[1].options.map(s=>s.id),['her']);
  assert.equal(paymentSourceGroups(masters,'old')[1].options.length,2);
  assert.equal(paymentSourceGroups(masters,null,true)[1].options.length,2);
  const draft=newExpense(masters,'2026-09');assert.equal(draft.usedByPartyId,'wife');assert.equal(draft.paymentSourceId,'shared');assert.equal(draft.beneficiaryKind,'family');
});
