import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const base='http://127.0.0.1:3101',cookies=new Map();let checks=0;
async function req(path,method='GET',body,status=200){const r=await fetch(base+path,{method,headers:{cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),origin:base,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});for(const raw of r.headers.getSetCookie()){const cookie=raw.split(';')[0],i=cookie.indexOf('=');cookies.set(cookie.slice(0,i),cookie.slice(i+1));}assert.equal(r.status,status);checks++;return r.json();}
await req('/api/auth/verify','POST',{email:'fixture0@example.invalid',token:'111111'});
let masters=await req('/api/masters'),food=masters.categories.find(c=>c.id==='food');
food=await req('/api/categories/food','PUT',{name:'食費',color:food.color,sortOrder:food.sortOrder,parentId:null,archived:false,costClass:'unknown',version:food.version});
const source=masters.paymentSources.find(s=>s.isDefault),data={id:randomUUID(),amount:100,date:'2047-09',categoryId:'food',costClass:'unknown',paymentSourceId:source.id,paidByPartyId:source.fundingPartyId,usedByPartyId:masters.selfPartyId,beneficiaryKind:'family',paymentTreatment:'shared',reimbursementStatus:'not_required'};
const expense=await req('/api/expenses','POST',data,201);
masters=await req('/api/categories/default-costs','POST',{entries:[{id:'food',version:food.version}]});assert.equal(masters.categories.find(c=>c.id==='food').costClass,'variable');checks++;
assert.equal((await req('/api/expenses/'+expense.id)).costClass,'unknown');checks++;
await req('/api/categories/default-costs','POST',{entries:[{id:'food',version:food.version}]},409);
await req('/api/categories/default-costs','POST',{entries:[{id:'food',version:food.version},{id:'food',version:food.version}]},400);
await req('/api/categories/default-costs','POST',{entries:[{id:'other',version:1}]},409);
await req('/api/categories/default-costs','POST',{entries:[{id:'food',version:1}],userId:randomUUID()},400);
console.log('PASS: '+checks+' explicit category defaults, version conflicts and historic expense preservation checks');
