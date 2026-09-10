// Operational scripts only; excluded from all application deployments.
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
const ref='fpptihhtyhehpjvmtuqt';
async function accessToken(){
  if(process.env.SUPABASE_ACCESS_TOKEN)return process.env.SUPABASE_ACCESS_TOKEN;
  for(const account of ['supabase','access-token'])try{return execFileSync('security',['find-generic-password','-s','Supabase CLI','-a',account,'-w'],{stdio:['ignore','pipe','pipe'],encoding:'utf8'}).trim();}catch{}
  return (await readFile(homedir()+'/.supabase/access-token','utf8')).trim();
}
export async function adminQuery(query){
  const headers={Authorization:'Bearer '+await accessToken(),'Content-Type':'application/json'};
  const r=await fetch('https://api.supabase.com/v1/projects/'+ref,{headers});const project=await r.json();
  if(!r.ok||project.id!==ref||project.name!=='personal-apps')throw new Error('Project verification failed');
  const response=await fetch('https://api.supabase.com/v1/projects/'+ref+'/database/query',{method:'POST',headers,body:JSON.stringify({query})});
  if(!response.ok)throw new Error('Management query failed; details suppressed');
  return response.json();
}
