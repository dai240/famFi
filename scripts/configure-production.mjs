// Writes generated secrets privately and supplies them to the Vercel CLI over stdin.
import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
const url = (await readFile(new URL('../.private/database-url', import.meta.url), 'utf8')).trim();
const key = (await readFile(new URL('../.private/auth-public-key', import.meta.url), 'utf8')).trim();
const settings = {
  DATABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_URL: 'https://fpptihhtyhehpjvmtuqt.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
  APP_ORIGIN: 'https://famfi-nu.vercel.app',
};
let existing = {};
try { existing = parseEnv(await readFile('.env.production.local', 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
await writeFile('.env.production.local', Object.entries({ ...existing, ...settings }).map(([name,value]) => `${name}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600 });
if (process.argv.includes('--vercel')) {
  for (const [name, value] of Object.entries(settings)) {
    const result = spawnSync('npx', ['vercel', 'env', 'add', name, 'production', '--scope', 'day56s-projects', '--project', 'prj_1DseLjbVii7stYvxv0LQK0IqOjEf', '--yes', '--force', name === 'DATABASE_URL' ? '--sensitive' : '--no-sensitive'], { input: value, encoding: 'utf8', timeout: 45000 });
    if (result.status !== 0) { console.error(`Failed setting ${name}; values and CLI output suppressed.`); process.exit(1); }
    console.log(`Configured production ${name}`);
  }
} else console.log('Production configuration written to ignored .env.production.local. Values not displayed.');
