// No email delivery or household writes: only public pages and rejected requests.
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const deployment=process.argv[2]??'https://famfi-nu.vercel.app';
assert.match(deployment,/^https:\/\/(famfi-nu|famfi-[a-z0-9]+-day56s-projects)\.vercel\.app$/);
let checks=0;
async function request(path,status,method='GET',origin){
  let body,headers;
  if(deployment==='https://famfi-nu.vercel.app'){
    const response=await fetch(deployment+path,{method,redirect:'manual',headers:origin?{origin,'Content-Type':'application/json'}:{},body:method==='POST'?'{}':undefined});
    assert.equal(response.status,status,path);body=await response.text();headers=response.headers.get('cache-control')??'';
  }else{
    const output=execFileSync('npx',['vercel@59.14.0','curl',path,'--deployment',deployment,'--scope','day56s-projects','--','-sS','-i','-w','\nSTATUS:%{http_code}',...(method==='POST'?['-X','POST','-H','Origin: '+origin,'-H','Content-Type: application/json','--data','{}']:[])],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000});
    assert.match(output,new RegExp('STATUS:'+status+'$'),path);body=output;headers=output.match(/cache-control:([^\r\n]*)/i)?.[1]??'';
  }
  checks++;if(path.startsWith('/api/')){assert.match(headers,/no-store/);checks++;}return body;
}
const login=await request('/login',200);assert.ok(!login.includes('検証用の家計簿'));checks++;
assert.ok(login.includes('確認コードを送信')&&!login.includes('disabled=""'));checks++;
for(const path of ['/api/expenses?month=2026-09','/api/masters','/api/attention','/api/plans','/api/summaries?month=2026-09','/api/recurring?month=2026-09','/api/expenses/export?month=2026-09','/api/calendar?month=2026-09','/api/notes','/api/notes/export','/api/household'])await request(path,401);
for(const path of ['/api/plans','/api/summaries','/api/auth/request','/api/notes','/api/categories/default-costs'])await request(path,403,'POST','https://invalid.example');
await request('/api/plans/11111111-1111-4111-8111-111111111111',401,'POST','https://famfi-nu.vercel.app');
console.log('PASS: '+checks+' Production HTTP configuration/auth/origin/no-store checks; no email sent or household rows written.');
