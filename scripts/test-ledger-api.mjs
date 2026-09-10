// Local-only integration fixtures. Never use a production URL or Auth session.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base='http://127.0.0.1:3101';let checks=0;
function session(){const cookies=new Map();return async(path,method='GET',body,origin=base)=>{const response=await fetch(base+path,{method,headers:{cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),origin,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});for(const value of response.headers.getSetCookie()){const part=value.split(';')[0],index=part.indexOf('=');cookies.set(part.slice(0,index),part.slice(index+1));}return response;};}
async function result(request,path,method='GET',body,status=200){const response=await request(path,method,body);assert.equal(response.status,status,`${method} ${path}: ${await response.clone().text()}`);assert.match(response.headers.get('cache-control'),/no-store/);checks+=2;return response;}
const owner=session(),other=session(),anon=session();
await result(owner,'/api/auth/verify','POST',{email:'fixture0@example.invalid',token:'222222'});
await result(other,'/api/auth/verify','POST',{email:'fixture0@example.invalid',token:'111111'});
for(const path of ['/api/masters','/api/categories','/api/settlements','/api/settlements/export'])await result(anon,path,'GET',undefined,401);
const before=await(await result(owner,'/api/expenses?month=2026-08')).json();
const parent={id:randomUUID(),name:'API parent '+randomUUID().slice(0,8),color:'#112233',sortOrder:110,parentId:null,archived:false};
await result(owner,'/api/categories','POST',parent,201);await result(owner,'/api/categories','POST',parent,201);
await result(owner,'/api/categories','POST',{...parent,name:'Different'},409);
await result(owner,'/api/categories','POST',{...parent,id:randomUUID(),userId:'other'},400);
await result(other,`/api/categories/${parent.id}`,'PUT',{...withoutId(parent),version:1},404);
const child={...parent,id:randomUUID(),name:'API child',parentId:parent.id,sortOrder:10};
await result(owner,'/api/categories','POST',child,201);
await result(owner,'/api/categories','POST',{...child,id:randomUUID(),name:'Grandchild',parentId:child.id},400);
await result(owner,`/api/categories/${parent.id}`,'PUT',{...withoutId(parent),parentId:child.id,version:1},400);
await result(owner,'/api/categories','POST',{...child,id:randomUUID()},409);
const childEdit={...withoutId(child),name:'API child changed',color:'#B35F79',version:1};
await result(owner,`/api/categories/${child.id}`,'PUT',childEdit);
await result(owner,`/api/categories/${child.id}`,'PUT',childEdit,409);
const masters=await(await result(owner,'/api/masters')).json();
assert.ok(!('userId' in masters.categories[0]));checks++;
const roots=masters.categories.filter(c=>!c.parentId).reverse().map(({id,version})=>({id,version}));
await result(owner,'/api/categories/order','PUT',{entries:roots});
await result(owner,'/api/categories/order','PUT',{entries:roots},409);
assert.ok(!(await(await result(other,'/api/masters')).json()).categories.some(c=>c.id===parent.id));checks++;
const person={id:randomUUID(),name:'API person '+randomUUID().slice(0,8),kind:'person',archived:false};
const fund={id:randomUUID(),name:'API shared '+randomUUID().slice(0,8),kind:'shared',archived:false};
for(const party of [person,fund])await result(owner,'/api/masters/parties','POST',party,201);
await result(owner,'/api/masters/parties','POST',person,201);
await result(owner,'/api/masters/parties','POST',{...person,id:randomUUID()},409);
await result(owner,`/api/masters/parties/${person.id}`,'PUT',{...withoutId(person),kind:'shared',version:1},400);
await result(other,`/api/masters/parties/${person.id}`,'PUT',{...withoutId(person),version:1},404);
const source={id:randomUUID(),name:'API card '+randomUUID().slice(0,8),method:'card',fundingPartyId:person.id,archived:false,defaultTreatment:'review',isDefault:false};
await result(other,'/api/masters/payment-sources','POST',source,400);
await result(owner,'/api/masters/payment-sources','POST',source,201);
await result(owner,'/api/masters/payment-sources','POST',source,201);
await result(owner,'/api/masters/payment-sources','POST',{...source,id:randomUUID()},409);
await result(owner,'/api/masters/payment-sources','POST',{...source,id:randomUUID(),name:'Invalid method',method:'unsupported'},400);
const expense={id:randomUUID(),amount:3000,date:'2026-08',categoryId:child.id,description:'API advance '+randomUUID(),memo:'find ledger memo',usedByPartyId:person.id,beneficiaryPartyId:fund.id,paidByPartyId:person.id,paymentSourceId:source.id,reimbursementStatus:'required',reimbursementFromPartyId:fund.id,reimbursementToPartyId:person.id,reimbursementAmount:2500,paymentTreatment:'custom',beneficiaryKind:'party'};
await result(owner,'/api/expenses','POST',{...expense,usedByPartyId:fund.id},400);
await result(other,'/api/expenses','POST',expense,400);
await result(owner,'/api/expenses','POST',{...expense,reimbursementAmount:3001},400);
await result(owner,'/api/expenses','POST',{...expense,reimbursementToPartyId:fund.id},400);
await result(owner,'/api/expenses','POST',expense,201);
await result(owner,'/api/expenses','POST',expense);
const updatedMaster=await(await result(owner,'/api/masters')).json();
for(const [param,value] of [['category',parent.id],['person',person.id],['paymentSource',source.id],['settlement','unsettled'],['search','find ledger memo']]){
  const list=await(await result(owner,`/api/expenses?month=2026-08&${param}=${encodeURIComponent(value)}`)).json();
  assert.ok(list.expenses.some(e=>e.id===expense.id));checks++;
}
const list=await(await result(owner,`/api/expenses?month=2026-08&category=${parent.id}`)).json();
assert.equal(list.total,before.total+3000);assert.equal(list.breakdown.find(g=>g.categoryId===parent.id).amount,3000);checks+=2;
await result(owner,`/api/expenses/${expense.id}`,'PUT',{amount:3000,date:'2026-08',categoryId:child.id,version:1},400);
const currentChild=updatedMaster.categories.find(c=>c.id===child.id);
await result(owner,`/api/categories/${child.id}`,'PUT',{...withoutId(currentChild),archived:true});
await result(owner,'/api/expenses','POST',{...expense,id:randomUUID()},400);
await result(owner,`/api/expenses/${expense.id}`,'PUT',{...withoutId(expense),memo:'find ledger memo edited',version:1});
await result(owner,`/api/masters/payment-sources/${source.id}`,'PUT',{...withoutId(source),archived:true,version:1});
await result(owner,'/api/expenses','POST',{...expense,id:randomUUID(),categoryId:'food'},400);
const pay={id:randomUUID(),expenseId:expense.id,expenseVersion:2,amount:1000,date:'2026-09-09',memo:'=repayment'};
await result(other,'/api/settlements','POST',pay,404);
await result(owner,'/api/settlements','POST',{...pay,expenseVersion:1},409);
await result(owner,'/api/settlements','POST',{...pay,amount:2501},409);
await result(owner,'/api/settlements','POST',pay,201);
await result(owner,'/api/settlements','POST',pay,201);
await result(owner,'/api/settlements','POST',{...pay,amount:500},409);
let saved=await(await result(owner,`/api/expenses/${expense.id}`)).json();
assert.equal(saved.settledAmount,1000);assert.equal(saved.settlements.length,1);assert.equal(saved.version,3);checks+=3;
await result(owner,`/api/expenses/${expense.id}`,'PUT',{...expenseFields(saved),amount:4000,version:saved.version},409);
await result(owner,`/api/expenses/${expense.id}`,'DELETE',{version:saved.version},409);
await result(owner,`/api/expenses/${expense.id}`,'PUT',{...expenseFields(saved),description:expense.description+' corrected',version:saved.version});
saved=await(await result(owner,`/api/expenses/${expense.id}`)).json();
const partial=await(await result(owner,'/api/expenses?month=2026-08&settlement=partial')).json();assert.ok(partial.expenses.some(e=>e.id===expense.id));checks++;
const outstanding=await(await result(owner,'/api/settlements')).json();assert.ok(outstanding.groups.some(g=>g.fromPartyId===fund.id&&g.amount===1500));checks++;
const concurrent=await Promise.all([1,2].map(()=>owner('/api/settlements','POST',{...pay,id:randomUUID(),expenseVersion:saved.version,amount:1500})));
assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,409]);checks++;
saved=await(await result(owner,`/api/expenses/${expense.id}`)).json();assert.equal(saved.settledAmount,2500);checks++;
const settled=await(await result(owner,'/api/expenses?month=2026-08&settlement=settled')).json();assert.ok(settled.expenses.some(e=>e.id===expense.id));assert.equal(settled.total,before.total+3000);checks+=2;
assert.ok(!(await(await result(owner,'/api/settlements')).json()).expenses.some(e=>e.id===expense.id));checks++;
assert.ok((await(await result(owner,'/api/settlements?view=all')).json()).expenses.some(e=>e.id===expense.id));checks++;
const csv=await(await result(owner,`/api/expenses/export?month=2026-08&category=${parent.id}`)).text();
for(const value of [person.name,source.name,'精算済み','2500',parent.name+' / '+childEdit.name]){assert.ok(csv.includes(value));checks++;}
const paymentsCsv=await(await result(owner,'/api/settlements/export')).text();assert.ok(paymentsCsv.includes("'=repayment"));assert.ok(paymentsCsv.includes(expense.id));checks+=2;
await result(other,`/api/settlements/${pay.id}`,'DELETE',{},404);
for(const payment of saved.settlements){await result(owner,`/api/settlements/${payment.id}`,'DELETE',{});await result(owner,`/api/settlements/${payment.id}`,'DELETE',{});}
await result(owner,'/api/settlements','POST',pay,409);
saved=await(await result(owner,`/api/expenses/${expense.id}`)).json();assert.equal(saved.settledAmount,0);assert.ok(saved.settlements.every(s=>s.cancelledAt));checks+=2;
await result(owner,`/api/expenses/${expense.id}`,'PUT',{...expenseFields(saved),reimbursementStatus:'not_required',reimbursementAmount:0,reimbursementFromPartyId:null,reimbursementToPartyId:null,version:saved.version});
const forbidden=await owner('/api/settlements','POST',pay,'https://evil.example');assert.equal(forbidden.status,403);checks++;
console.log(`PASS: ${checks} ledger HTTP master/ownership/filter/CSV/settlement/conflict/cancellation checks`);
function withoutId(row){const {id,...rest}=row;return rest;}
function expenseFields(row){const {id,version,createdAt,updatedAt,settlements,settledAmount,recordedByPartyId,updatedByPartyId,summaryId,...rest}=row;return rest;}
