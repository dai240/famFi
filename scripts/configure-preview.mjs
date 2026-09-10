import {readFile,writeFile} from 'node:fs/promises';
import {adminQuery} from './supabase-admin.mjs';
const owner=(await readFile('.private/preview-owner-id','utf8')).trim();
if(!/^[a-f0-9-]{36}$/.test(owner))throw new Error('Invalid verified owner');
const accounts=await adminQuery(`select u.email from auth.users u join famfi_preview.household_members m on m.user_id=u.id where u.id='${owner}'::uuid and u.email_confirmed_at is not null`);
if(accounts.length!==1||!accounts[0].email?.includes('@'))throw new Error('Verified preview owner required');
const settings={
  DATABASE_URL:(await readFile('.private/preview-database-url','utf8')).trim(),
  FAMFI_DB_SCHEMA:'famfi_preview',
  NEXT_PUBLIC_SUPABASE_URL:'https://fpptihhtyhehpjvmtuqt.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:(await readFile('.private/auth-public-key','utf8')).trim(),
  FAMFI_ALLOWED_EMAIL:accounts[0].email,
  APP_ORIGIN:'https://famfi-preview-day56s-projects.vercel.app',
};
if(!settings.FAMFI_ALLOWED_EMAIL||new URL(settings.DATABASE_URL).username!=='famfi_preview_app.fpptihhtyhehpjvmtuqt')throw new Error('Preview settings are incomplete');
await writeFile('.env.preview.local',Object.entries(settings).map(([key,value])=>key+'='+JSON.stringify(value)).join('\n')+'\n',{mode:0o600,flag:'wx'});
console.log('Wrote protected local Preview settings. Use deploy-preview.mjs for deployment-scoped configuration.');
