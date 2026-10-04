import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { validCashFields, cashQuery } from '../lib/cash-movements';
import { parseRakutenBank, cashImportId } from '../scripts/rakuten-bank-csv.mjs';
const header='取引日,入出金(円),取引後残高(円),入出金内容\r\n';
const csv=(rows:string)=>Buffer.from(header+rows);
test('cash movements permit unknown people and purpose without inventing a purchase',()=>{
  const row={paymentSourceId:randomUUID(),date:'2025-07-01',amount:-1234,description:'不明'};
  assert.deepEqual(validCashFields.parse(row),{...row,kind:'unknown',memo:'',partyId:null});
  for(const bad of [{amount:0},{amount:0.1},{amount:1e10},{amount:-1,kind:'benefit'},{amount:1,kind:'card_payment'},{date:'2025-02-29'},{userId:randomUUID()},{importKey:'x'}])assert.equal(validCashFields.safeParse({...row,...bad}).success,false);
  assert.equal(cashQuery.safeParse({month:'2025-13'}).success,false);
  assert.equal(cashQuery.safeParse({ledgerId:randomUUID()}).success,false);
});
test('Rakuten bank CSV parses signed yen, classifies only known labels and strips identities',()=>{
  const result=parseRakutenBank(csv('20250101,10000,10100,テスト タロウ\r\n20250127,-1000,9100,ラクテンカ－ト゛サ－ヒ゛ス\r\n20250128,-50,9050,"銀行 普通預金 1234567 氏名（振込予定日：2025年01月28日）"\r\n20250131,10,9060,預金利息\r\n'));
  assert.deepEqual(result.summary,{count:4,from:'2025-01-01',to:'2025-01-31',incoming:10010,outgoing:1050});
  assert.deepEqual(result.rows.map(r=>r.kind),['unknown','card_payment','unknown','interest']);
  assert.ok(result.rows.every(r=>r.partyId===null&&r.memo===''));
  assert.ok(!JSON.stringify(result).includes('1234567'));
  assert.ok(!JSON.stringify(result).includes('テスト タロウ'));
  assert.ok(result.rows.every(r=>!('balance' in r)));
  const replay=parseRakutenBank(csv('20250127,-1000,9100,ラクテンカ－ト゛サ－ヒ゛ス\n20250128,-50,9050,"銀行 普通預金 1234567 氏名（振込予定日：2025年01月28日）"\n'));
  assert.equal(replay.rows[0].key,result.rows[1].key);
  assert.equal(replay.rows[1].key,result.rows[2].key);
  assert.equal(cashImportId('ledger','source',replay.rows[0].key),cashImportId('ledger','source',result.rows[1].key));
  assert.notEqual(cashImportId('ledger','source',replay.rows[0].key),cashImportId('other','source',replay.rows[0].key));
});
test('CSV rejects malformed, incomplete, ambiguous or inconsistent rows',()=>{
  for(const body of ['','20250230,1,1,x','20250101,0,1,x','20250101,1e3,1,x','20250101,-1,0,x\n20250102,1,5,y','20250102,1,1,x\n20250101,1,2,y','20250101,1,1,x,extra','20250101,1,1,"unterminated','20250101,1,1,x\n20250101,-1,0,y\n20250101,1,1,x'])assert.throws(()=>parseRakutenBank(csv(body)));
  assert.throws(()=>parseRakutenBank(Buffer.from('date,amount\n1,2')));
});
test('descriptions with quoted commas and newlines do not become extra transactions',()=>{
  const parsed=parseRakutenBank(csv('20250101,10,10,"someone,\nunknown"'));
  assert.equal(parsed.rows.length,1);assert.equal(parsed.rows[0].description,'入金（名義・用途不明）');
});
