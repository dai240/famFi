import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
const base='http://127.0.0.1:3101';let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
function session(){const cookies=new Map();return async(path,method='GET',body,origin=base)=>{const r=await fetch(base+path,{method,headers:{cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),origin,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});for(const cookie of r.headers.getSetCookie()){const p=cookie.split(';')[0],i=p.indexOf('=');cookies.set(p.slice(0,i),p.slice(i+1));}return r;};}
const owner=session(),wife=session(),other=session(),anon=session(),uninvited=session();
async function req(who,path,method='GET',body,status=200){const r=await who(path,method,body);assert.equal(r.status,status,method+' '+path+' '+(r.status===status?'':await r.text()));checks++;return r.headers.get('content-type')?.includes('application/json')?r.json():r.text();}
for(const [who,token] of [[owner,'111111'],[wife,'777777'],[other,'222222']])await req(who,'/api/auth/verify','POST',{email:'fixture0@example.invalid',token});
await req(uninvited,'/api/auth/verify','POST',{email:'fixture0@example.invalid',token:'333333'},403);
for(const path of ['/api/calendar?month=2037-09','/api/notes','/api/household','/api/notes/export'])await req(anon,path,'GET',undefined,401);
eq((await owner('/api/notes','POST',{},'https://evil.example')).status,403);
const home=await req(owner,'/api/household');eq(home.members.length,2);eq(home.members.filter(m=>m.status==='active').length,2);eq(home.members.filter(m=>m.self).length,1);eq(Object.keys(home.members[0]).sort(),['name','self','status']);
eq((await req(other,'/api/household')).members.filter(m=>m.status==='active').length,1);
await req(owner,'/api/household','POST',{},405);
const input={id:randomUUID(),name:'Shared notes '+randomUUID(),kind:'task',date:'2037-09',memo:'=SUM(1,2)\n家計で共有'};
const row=await req(owner,'/api/notes','POST',input,201);eq(row.date,'2037-09');eq(row.completed,false);
eq((await req(owner,'/api/notes','POST',input,201)).id,row.id);
await req(owner,'/api/notes','POST',{...input,name:'different'},409);
await req(owner,'/api/notes','POST',{...input,id:randomUUID(),userId:randomUUID()},400);
await req(owner,'/api/notes','POST',{...input,id:randomUUID(),completed:true},400);
await req(owner,'/api/notes','POST',{...input,id:randomUUID(),date:'2037-02-29'},400);
await req(owner,'/api/notes','POST',{...input,id:randomUUID(),memo:'x'.repeat(4001)},400);
eq((await req(wife,'/api/notes/'+row.id)).id,row.id);
for(const method of ['GET','PUT','DELETE'])await req(other,'/api/notes/'+row.id,method,method==='GET'?undefined:method==='DELETE'?{version:1}:{...input,id:undefined,version:1,completed:false},404);
eq((await req(other,'/api/notes?search='+encodeURIComponent(input.name))).count,0);
const body={name:row.name,memo:row.memo,kind:'task',date:row.date,completed:true,version:row.version};
const concurrent=[];for(const who of [owner,wife])concurrent.push(who('/api/notes/'+row.id,'PUT',body));
const results=[];for(const promise of concurrent)results.push((await promise).status);eq(results.sort(),[200,409]);
let latest=await req(wife,'/api/notes/'+row.id);eq(latest.completed,true);
eq((await req(owner,'/api/notes?filter=completed&search='+encodeURIComponent(input.name))).count,1);
eq((await req(owner,'/api/notes?filter=open&search='+encodeURIComponent(input.name))).count,0);
await req(owner,'/api/notes/'+row.id,'PUT',{...body,kind:'note',version:latest.version},400);
latest=await req(wife,'/api/notes/'+row.id,'PUT',{...body,completed:false,date:'2037-09-21',version:latest.version});
const undated=await req(owner,'/api/notes','POST',{id:randomUUID(),name:'No date',kind:'note'},201);eq(undated.date,null);
const monthNote=await req(owner,'/api/notes','POST',{id:randomUUID(),name:'Month note',kind:'note',date:'2037-09'},201);
const csv=await req(owner,'/api/notes/export');assert.ok(csv.includes("'=SUM(1,2)"));checks++;assert.ok(!csv.includes('user_id'));checks++;
const history=await req(owner,'/api/history?entityType=household_notes&entityId='+row.id);eq(history.count,3);eq(new Set(history.events.map(e=>e.actorPartyId)).size,2);
const masters=await req(owner,'/api/expenses?month=2037-09');const source=masters.paymentSources.find(s=>s.isDefault);
const exp={amount:1234,date:'2037-09-21',categoryId:'food',costClass:'variable',description:'Calendar expense',memo:'',paymentSourceId:source.id,paidByPartyId:source.fundingPartyId,usedByPartyId:masters.selfPartyId,usedByText:'',beneficiaryKind:'family',beneficiaryPartyId:null,beneficiaryText:'',paymentTreatment:'shared',reimbursementStatus:'not_required',reimbursementFromPartyId:null,reimbursementToPartyId:null,reimbursementAmount:0};
const actual=await req(owner,'/api/expenses','POST',{...exp,id:randomUUID()},201);
const monthly=await req(owner,'/api/expenses','POST',{...exp,id:randomUUID(),date:'2037-09',amount:500},201);
const plan=await req(owner,'/api/plans','POST',{id:randomUUID(),name:'Calendar plan',date:'2037-09-21',amount:9999},201);
const summary=await req(owner,'/api/summaries','POST',{id:randomUUID(),name:'Calendar summary',month:'2037-09',amount:10000,paymentSourceId:source.id,complete:true},201);
const sumBody={action:'link',version:summary.version,expenseId:actual.id,expenseVersion:actual.version};await req(owner,'/api/summaries/'+summary.id,'POST',sumBody);
const calendar=await req(owner,'/api/calendar?month=2037-09');eq(calendar.total,(await req(owner,'/api/expenses?month=2037-09')).total);
eq(calendar.total,10500);eq(calendar.entries.find(e=>e.id===actual.id).date,'2037-09-21');eq(calendar.entries.find(e=>e.id===monthly.id).date,'2037-09');eq(calendar.entries.find(e=>e.id===summary.id).amount,8766);eq(calendar.entries.find(e=>e.id===monthNote.id).date,'2037-09');eq(calendar.entries.some(e=>e.id===undated.id),false);eq(calendar.entries.find(e=>e.id===plan.id).kind,'plan');
eq((await req(other,'/api/calendar?month=2037-09')).entries.length,0);
await req(owner,'/api/calendar?month=2037-13','GET',undefined,400);await req(owner,'/api/calendar?month=2037-09&userId='+randomUUID(),'GET',undefined,400);
await req(owner,'/api/notes/'+row.id,'DELETE',{version:1},409);await req(wife,'/api/notes/'+row.id,'DELETE',{version:latest.version});await req(owner,'/api/notes/'+row.id,'GET',undefined,404);
eq((await req(owner,'/api/history?entityType=household_notes&entityId='+row.id)).events[0].action,'DELETE');
const db=new pg.Client({host:'127.0.0.1',port:55432,user:'postgres',database:'postgres'});await db.connect();
try{
  for(const schema of ['famfi','famfi_preview']){
    await db.query('begin');await db.query('set local role '+schema+'_app');
    for(const actor of ['',randomUUID()]){await db.query("select set_config('app.user_id',$1,true)",[actor]);eq((await db.query('select * from '+schema+'.household_roster()')).rows.length,0);eq((await db.query('select * from '+schema+'.household_notes')).rows.length,0);}
    await db.query("select set_config('app.user_id',$1,true)",['11111111-1111-4111-8111-111111111111']);eq((await db.query('select * from '+schema+'.household_roster()')).rows.length,2);
    for(const sql of ['select * from '+(schema==='famfi'?'famfi_preview':'famfi')+'.household_notes','insert into '+schema+'.household_members(user_id,ledger_id,party_id) values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid())','update '+schema+'.household_notes set user_id=gen_random_uuid()','insert into '+schema+'.household_notes(id,user_id,name,kind,version) values(gen_random_uuid(),gen_random_uuid(),\'x\',\'note\',9)']){
      await db.query('savepoint deny');await assert.rejects(db.query(sql));checks++;await db.query('rollback to savepoint deny');
    }
    await db.query('rollback');
    await db.query('begin');await db.query('update '+schema+'.memberships set active=false where user_id=$1',['11111111-1111-4111-8111-111111111111']);await db.query('set local role '+schema+'_app');await db.query("select set_config('app.user_id',$1,true)",['11111111-1111-4111-8111-111111111111']);eq((await db.query('select * from '+schema+'.household_roster()')).rows.length,0);eq((await db.query('select * from '+schema+'.household_notes')).rows.length,0);await db.query('rollback');
  }
}finally{await db.end();}
console.log(`PASS: ${checks} notes/calendar/member API, concurrency, history, CSV, totals, RLS and cross-schema checks`);
