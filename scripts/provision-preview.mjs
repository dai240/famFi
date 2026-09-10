// One-time admin provisioning. Credentials travel encrypted; no production ledger is copied.
import {readFile,writeFile,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {homedir} from 'node:os';
import {readPrivateKey,readMessage,decrypt} from 'openpgp';
const ref='fpptihhtyhehpjvmtuqt';
async function token(){
  if(process.env.SUPABASE_ACCESS_TOKEN)return process.env.SUPABASE_ACCESS_TOKEN;
  for(const account of ['supabase','access-token'])try{return execFileSync('security',['find-generic-password','-s','Supabase CLI','-a',account,'-w'],{stdio:['ignore','pipe','pipe'],encoding:'utf8'}).trim();}catch{}
  return (await readFile(homedir()+'/.supabase/access-token','utf8')).trim();
}
async function main(){
  try{await access('.private/preview-database-url');throw new Error('Preview already provisioned');}catch(e){if(e.code!=='ENOENT')throw e;}
  if((await readFile('../personal-apps-infra/supabase/.temp/project-ref','utf8')).trim()!==ref)throw new Error('Incorrect linked project');
  const credential=await token();
  const headers={Authorization:'Bearer '+credential,'Content-Type':'application/json'};
  const project=await fetch('https://api.supabase.com/v1/projects/'+ref,{headers});
  const info=await project.json();if(!project.ok||info.id!==ref||info.name!=='personal-apps')throw new Error('Project verification failed');
  const key=(await readFile('.private/transport-public.asc','utf8')).replaceAll("'","''");
  const query=`begin;
select pg_advisory_xact_lock(hashtextextended('personal-apps:migrations',0));
create temporary table preview_transport(ciphertext text,owner_id uuid) on commit drop;
do $provision$
declare password text; owner_id uuid;
begin
  if (select array_agg(version::text order by version) from supabase_migrations.schema_migrations) is distinct from array['20260909090314','20260909090553','20260909095423','20260909105437','20260909122110','20260909133732','20260909151716','20260909231314','20260910001416','20260910001647']::text[] then raise exception 'History changed'; end if;
  if exists(select 1 from famfi_preview.memberships) then raise exception 'Preview already has members';end if;
  select m.user_id into strict owner_id from famfi.household_members m join famfi.parties p on p.user_id=m.ledger_id and p.id=m.party_id join famfi.memberships a on a.user_id=m.user_id and a.active join auth.users u on u.id=m.user_id and u.email_confirmed_at is not null where p.system_key='owner';
  insert into famfi_preview.memberships(user_id) values(owner_id);
  perform famfi_preview.provision_household(owner_id,'検証用家計');
  password:=encode(extensions.gen_random_bytes(32),'hex');
  execute format('alter role famfi_preview_app password %L',password);
  insert into preview_transport values(extensions.armor(extensions.pgp_pub_encrypt(password,extensions.dearmor('${key}'))),owner_id);
end;
$provision$;
select ciphertext,owner_id from preview_transport;
commit;`;
  const response=await fetch('https://api.supabase.com/v1/projects/'+ref+'/database/query',{method:'POST',headers,body:JSON.stringify({query})});
  if(!response.ok)throw new Error('Provision request failed; inspect state before retrying');
  const rows=await response.json();const row=rows.find(r=>r.ciphertext);
  if(!row)throw new Error('Missing encrypted response; inspect state before retrying');
  await writeFile('.private/preview-credential.asc',row.ciphertext,{mode:0o600,flag:'wx'});
  const privateKey=await readPrivateKey({armoredKey:await readFile('.private/transport-private.asc','utf8')});
  const {data}=await decrypt({message:await readMessage({armoredMessage:row.ciphertext}),decryptionKeys:privateKey});
  if(typeof data!=='string'||!/^[a-f0-9]{64}$/.test(data))throw new Error('Invalid credential payload');
  const url=new URL((await readFile('.private/database-url','utf8')).trim());
  if(url.hostname!=='aws-1-ap-southeast-1.pooler.supabase.com')throw new Error('Unexpected pooler');
  url.username='famfi_preview_app.'+ref;url.password=data;url.searchParams.set('schema','famfi_preview');
  await writeFile('.private/preview-database-url',url.toString(),{mode:0o600,flag:'wx'});
  await writeFile('.private/preview-owner-id',row.owner_id,{mode:0o600,flag:'wx'});
  console.log('Preview-only credential received privately; existing verified owner joined the empty preview household. No Auth changes or invitations.');
}
main().catch(()=>{console.error('Preview provisioning did not complete locally. No secret or SQL output displayed. Inspect remote state before retrying.');process.exitCode=1;});
