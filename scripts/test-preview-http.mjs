// Vercel protection remains enabled. CLI authentication is not famFi user authentication.
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const deployment=(await readFile('.private/preview-deployment-url','utf8')).trim();
assert.match(deployment,/^https:\/\/famfi-[a-z0-9]+-day56s-projects\.vercel\.app$/);
let checks=0;
function request(path,status,extra=[]){
  const output=execFileSync('npx',['vercel@59.14.0','curl',path,'--deployment',deployment,'--scope','day56s-projects','--','-sS','-i','-w','\nSTATUS:%{http_code}',...extra],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000});
  assert.match(output,new RegExp('STATUS:'+status+'$'),path+' status');checks++;
  if(path.startsWith('/api/')){assert.match(output,/cache-control:[^\r\n]*no-store/i,path+' no-store');checks++;}
  return output;
}
const login=request('/login',200);
assert.ok(login.includes('検証用の家計簿'),'Preview environment marker');checks++;
assert.ok(login.includes('確認コードを送信')&&!login.includes('disabled=""'),'Login configuration ready');checks++;
for(const path of ['/api/expenses?month=2026-09','/api/masters','/api/attention','/api/plans','/api/summaries?month=2026-09','/api/recurring?month=2026-09','/api/expenses/export?month=2026-09'])request(path,401);
for(const path of ['/api/plans','/api/summaries','/api/auth/request'])request(path,403,['-X','POST','-H','Origin: https://invalid.example','-H','Content-Type: application/json','--data','{}']);
request('/api/plans/11111111-1111-4111-8111-111111111111',401,['-X','POST','-H','Origin: https://famfi-preview-day56s-projects.vercel.app','-H','Content-Type: application/json','--data','{}']);
console.log('PASS: '+checks+' deployed Preview HTTP checks. No email sent and no household rows written.');
