// Secrets are inherited by the CLI, never placed in argv or project-wide Preview settings.
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync,spawn} from 'node:child_process';
import {parseEnv} from 'node:util';

const branch=execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim();
if(branch!=='preview'||execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim())throw new Error('Commit the trusted preview branch first');
const linked=JSON.parse(await readFile('.vercel/project.json','utf8'));
if(linked.projectId!=='prj_1DseLjbVii7stYvxv0LQK0IqOjEf'||linked.orgId!=='team_4dr9D9zm9PKm846RLNoC3TV8')throw new Error('Unexpected Vercel project');
if(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==execFileSync('git',['rev-parse','origin/preview'],{encoding:'utf8'}).trim())throw new Error('Push preview before deployment');
const settings=parseEnv(await readFile('.env.preview.local','utf8'));
const required=['DATABASE_URL','FAMFI_DB_SCHEMA','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','FAMFI_ALLOWED_EMAIL','APP_ORIGIN'];
if(required.some(key=>!settings[key])||settings.FAMFI_DB_SCHEMA!=='famfi_preview'||new URL(settings.DATABASE_URL).username!=='famfi_preview_app.fpptihhtyhehpjvmtuqt')throw new Error('Dedicated preview settings required');
if(settings.APP_ORIGIN!=='https://famfi-preview-day56s-projects.vercel.app')throw new Error('Unexpected preview origin');
const runtimeKeys=[...required,'VERCEL_GIT_COMMIT_REF'];
const buildKeys=['FAMFI_DB_SCHEMA','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','VERCEL_GIT_COMMIT_REF'];
const args=['vercel@59.14.0','deploy','--yes','--target','preview','--scope','day56s-projects',...runtimeKeys.flatMap(key=>['--env',key]),...buildKeys.flatMap(key=>['--build-env',key])];
const secrets=[settings.DATABASE_URL,settings.FAMFI_ALLOWED_EMAIL];
const output=await new Promise((resolve,reject)=>{
  let stdout='',stderr='';const child=spawn('npx',args,{env:{...process.env,...settings,VERCEL_GIT_COMMIT_REF:'preview'},stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);
  child.on('error',reject);child.on('close',code=>{
    let safe=stderr;for(const secret of secrets)safe=safe.replaceAll(secret,'[redacted]');
    console.log(safe);if(code!==0)reject(new Error('Preview deployment failed'));else resolve(stdout+'\n'+stderr);
  });
});
const url=String(output).match(/https:\/\/famfi-[a-z0-9]+-day56s-projects\.vercel\.app/g)?.at(-1);
if(!url)throw new Error('Inspect deployment before assigning the stable alias');
await writeFile('.private/preview-deployment-url',url+'\n',{mode:0o600});
console.log('Built preview: '+url);
console.log('Production was not promoted. Assign the dedicated preview alias after READY verification.');
