import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';

const headers=['取引日','入出金(円)','取引後残高(円)','入出金内容'];
const digest=value=>createHash('sha256').update(value).digest('hex');
const fold=value=>value.normalize('NFKC').normalize('NFD').replace(/[\p{M}\sー－-]/gu,'');

// Only known statement labels are classified. Names never identify household members.
function describe(raw,amount) {
  const text=fold(raw);
  if(amount<0&&text==='ラクテンカトサヒス')return {kind:'card_payment',description:'楽天カード引落（名義・用途不明）'};
  if(amount<0&&text.startsWith('コフテリ'))return {kind:'direct_debit',description:'コープ引落（内訳不明）'};
  if(amount>0&&text.includes('利息'))return {kind:'interest',description:'利息'};
  if(amount>0&&text.includes('シトウテアテ'))return {kind:'benefit',description:'児童手当'};
  if(amount>0&&text.includes('018サホトキユウフキン'))return {kind:'benefit',description:'018サポート給付金'};
  if(amount>0&&text.includes('コソタテオウエンテアテ'))return {kind:'benefit',description:'子育て応援手当'};
  if(amount<0&&raw.includes('振込予定日'))return {kind:'unknown',description:'振込（用途不明）'};
  return {kind:'unknown',description:amount>0?'入金（名義・用途不明）':'出金（名義・用途不明）'};
}
export function parseRakutenBank(bytes) {
  if(!bytes.length||bytes.length>2*1024*1024)throw new Error('CSVは空ではない2MB以下のファイルを指定してください。');
  let text;
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{
    try{text=new TextDecoder('shift_jis',{fatal:true}).decode(bytes);}catch{throw new Error('CSVの文字コードを確認してください。');}
  }
  let records;
  try{records=parse(text,{bom:true,skip_empty_lines:true,record_delimiter:['\r\n','\n','\r'],max_record_size:16384});}catch{throw new Error('CSVの列・引用符の形式を確認してください。');}
  if(JSON.stringify(records.shift())!==JSON.stringify(headers))throw new Error('楽天銀行CSVの見出しが想定と異なります。');
  if(!records.length||records.length>10000)throw new Error('一度に取り込める明細は1〜10,000件です。');
  const seen=new Set(),rows=[];let previous;
  for(const [i,record] of records.entries()){
    const fail=()=>{throw new Error(`CSVの${i+2}行目の日付・金額・並び順・形式を確認してください。`);};
    if(record.length!==4)fail();
    const [rawDate,rawAmount,rawBalance,rawDescription]=record;
    if(!/^20\d{6}$/.test(rawDate)||!(/^-?\d+$/).test(rawAmount)||!(/^-?\d+$/).test(rawBalance)||!rawDescription.trim())fail();
    const date=`${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}`;
    const parsedDate=new Date(date+'T00:00:00Z');
    if(!Number.isFinite(parsedDate.getTime())||parsedDate.toISOString().slice(0,10)!==date)fail();
    const amount=Number(rawAmount),balance=BigInt(rawBalance);
    if(!Number.isSafeInteger(amount)||!amount||Math.abs(amount)>999999999)fail();
    if(previous&&(date<previous.date||previous.balance+BigInt(amount)!==balance))fail();
    previous={date,balance};
    // Balance and raw bank identifiers are transient only; never returned or stored.
    const key=digest(JSON.stringify(['rakuten-bank/v1',date,amount,String(balance),rawDescription.normalize('NFKC').trim()]));
    if(seen.has(key))throw new Error(`CSVの${i+2}行目は同一明細が重複しています。原本を確認してください。`);
    seen.add(key);
    rows.push({date,amount,...describe(rawDescription,amount),memo:'',partyId:null,key});
  }
  return {batch:digest(bytes),rows,summary:{count:rows.length,from:rows[0].date,to:rows.at(-1).date,
    incoming:rows.filter(r=>r.amount>0).reduce((n,r)=>n+r.amount,0),outgoing:rows.filter(r=>r.amount<0).reduce((n,r)=>n-r.amount,0)}};
}
export function cashImportId(ledgerId,sourceId,key) {
  const hex=digest(JSON.stringify(['famfi-cash/v1',ledgerId,sourceId,key])).slice(0,32).split('');
  hex[12]='5';hex[16]='8';const value=hex.join('');
  return `${value.slice(0,8)}-${value.slice(8,12)}-${value.slice(12,16)}-${value.slice(16,20)}-${value.slice(20)}`;
}
