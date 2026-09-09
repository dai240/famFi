// Disposable loopback API only. Does not use real Auth or Supabase.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base='http://127.0.0.1:3101';let checks=0;
function session(){const cookies=new Map();return async(path,method='GET',body,origin=base)=>{
  const response=await fetch(base+path,{method,headers:{cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),origin,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  for(const value of response.headers.getSetCookie()){const [part]=value.split(';');const index=part.indexOf('=');cookies.set(part.slice(0,index),part.slice(index+1));}return response;
};}
const owner=session(),wife=session(),other=session(),anon=session(),outsider=session();
async function result(request,path,method='GET',body,status=200){const response=await request(path,method,body);assert.equal(response.status,status,path+': '+await response.clone().text());assert.match(response.headers.get('cache-control'),/no-store/);checks+=2;return response;}
const equal=(a,b)=>{assert.deepEqual(a,b);checks++;};
const masters=async(request)=>(await result(request,'/api/masters')).json();
const self=m=>m.parties.find(p=>p.id===m.selfPartyId);
for(const [request,token] of [[owner,'111111'],[wife,'777777'],[other,'222222']])await result(request,'/api/auth/verify','POST',{email:'fixture0@example.invalid',token});
await result(outsider,'/api/auth/verify','POST',{email:'fixture0@example.invalid',token:'333333'},403);
await result(anon,'/api/profile','PUT',{name:'未認証',version:1},401);
equal((await owner('/api/profile','PUT',{name:'攻撃',version:1},'https://evil.example')).status,403);
let before=await masters(owner),m=before;
for(const patch of [{name:''},{name:'あ'.repeat(11)},{name:'a\nb'},{partyId:randomUUID()},{userId:randomUUID()},{ledgerId:randomUUID()},{systemKey:'partner'},{profileConfirmed:false}])await result(owner,'/api/profile','PUT',{name:'テスト本人',version:self(m).version,...patch},400);
m=await(await result(owner,'/api/profile','PUT',{name:'API本人',version:self(m).version})).json();
equal(self(m).name,'API本人');equal(self(m).profileConfirmed,true);equal(m.selfPartyId,before.selfPartyId);
equal(m.paymentSources.filter(s=>s.fundingPartyId===m.selfPartyId&&['カード','口座','現金'].includes(s.ownerLabel)).map(s=>s.name).sort(),['API本人のカード','API本人の口座','API本人の現金']);
for(const source of m.paymentSources){const old=before.paymentSources.find(s=>s.id===source.id);equal(source.fundingPartyId,old.fundingPartyId);equal(source.version,old.version);}
await result(owner,'/api/profile','PUT',{name:'古い変更',version:self(before).version},409);
await result(owner,'/api/profile','PUT',{name:'妻',version:self(m).version},400);
let w=await masters(wife);equal(w.parties.find(p=>p.id===m.selfPartyId).name,'API本人');
w=await(await result(wife,'/api/profile','PUT',{name:'API配偶者',version:self(w).version})).json();
equal(self(w).name,'API配偶者');equal(self(w).systemKey,'partner');
await result(owner,'/api/profile','PUT',{name:'API配偶者',version:self(m).version},409);
const concurrent=await Promise.all([owner,owner].map(request=>request('/api/profile','PUT',{name:'API本人',version:self(m).version})));
equal(concurrent.map(r=>r.status).sort(),[200,409]);m=await masters(owner);
equal((await masters(other)).parties.some(p=>p.id===m.selfPartyId),false);
const collisionName='重複確認';
const customSource={name:collisionName+'のカード',ownerLabel:null,method:'card',fundingPartyId:m.selfPartyId,defaultTreatment:'advance',isDefault:false,archived:false};
await result(owner,'/api/masters/payment-sources','POST',{id:randomUUID(),...customSource},201);
await result(owner,'/api/profile','PUT',{name:collisionName,version:self(m).version},409);
let collisionMasters=await masters(owner);equal(self(collisionMasters).version,self(m).version);equal(self(collisionMasters).name,'API本人');
const custom=collisionMasters.paymentSources.find(s=>s.name===customSource.name);equal(custom.ownerLabel,null);
await result(owner,'/api/masters/payment-sources/'+custom.id,'PUT',{...customSource,name:'検証済み-'+custom.id,archived:true,version:custom.version});
await result(owner,'/api/masters/parties','POST',{id:randomUUID(),name:'API本人',kind:'person',archived:false},409);
const guestId=randomUUID(),guestName='検証人物-'+guestId.slice(0,8);
await result(owner,'/api/masters/parties','POST',{id:guestId,name:guestName,kind:'person',archived:false},201);
await result(owner,'/api/masters/payment-sources','POST',{id:randomUUID(),...customSource,name:'識別',ownerLabel:'識別',fundingPartyId:guestId},201);
const guestCollision={...customSource,name:'検証変更先の識別'};
const guestBlocker=await(await result(owner,'/api/masters/payment-sources','POST',{id:randomUUID(),...guestCollision},201)).json();
await result(owner,'/api/masters/parties/'+guestId,'PUT',{name:'検証変更先',kind:'person',archived:false,version:1},409);
await result(owner,'/api/masters/parties/'+guestId,'PUT',{name:'API本人',kind:'person',archived:false,version:1},409);
await result(owner,'/api/masters/payment-sources/'+guestBlocker.id,'PUT',{...guestCollision,name:'検証済み-'+guestBlocker.id,archived:true,version:guestBlocker.version});
await result(owner,'/api/masters/parties/'+guestId,'PUT',{name:guestName,kind:'person',archived:true,version:1});
const wifeCard=w.paymentSources.find(s=>s.ownerLabel==='カード'&&s.fundingPartyId===w.selfPartyId),fund=w.parties.find(p=>p.systemKey==='shared');
const expense={id:randomUUID(),amount:1500,date:'2035-08',categoryId:'food',description:'Profile API fixture',memo:'',usedByPartyId:m.selfPartyId,usedByText:'',beneficiaryKind:'family',beneficiaryPartyId:null,beneficiaryText:'',paymentSourceId:wifeCard.id,paidByPartyId:w.selfPartyId,paymentTreatment:'advance',reimbursementStatus:'required',reimbursementAmount:1500,reimbursementFromPartyId:fund.id,reimbursementToPartyId:w.selfPartyId};
const saved=await(await result(owner,'/api/expenses','POST',expense,201)).json();
w=await(await result(wife,'/api/profile','PUT',{name:'変更後の妻',version:self(w).version})).json();
const after=await(await result(owner,'/api/expenses/'+saved.id)).json();equal(after,saved);
const csv=await(await result(owner,'/api/expenses/export?month=2035-08')).text();assert.ok(csv.includes('API本人')&&csv.includes('変更後の妻のカード'));checks++;
const history=await(await result(owner,'/api/history?entityType=parties&entityId='+w.selfPartyId)).json();assert.ok(history.events.some(e=>e.afterData?.nickname==='変更後の妻'&&e.actorPartyId===w.selfPartyId));checks++;
await result(owner,'/api/expenses/'+saved.id,'DELETE',{version:saved.version});
// Leave familiar names for existing regression tests, without clearing confirmation.
for(const [request,name] of [[owner,'夫'],[wife,'妻'],[other,'夫']]){const current=await masters(request);await result(request,'/api/profile','PUT',{name,version:self(current).version});}
console.log(`PASS: ${checks} profile API validation, names, stable IDs, CSV, audit and isolation checks`);
