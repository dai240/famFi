import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const walk = directory => readdirSync(directory, { withFileTypes: true })
  .flatMap(entry => entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]);
const traces = walk('.next/server/app').filter(file => file.endsWith('.nft.json'));
if (!traces.length) throw new Error('Run the production build first');
let apiCount = 0;
for (const file of traces) {
  const { files } = JSON.parse(readFileSync(file, 'utf8'));
  if (files.some(path => path.includes('.private/') || /(?:^|\/)\.env(?:\.|$)/.test(path))) {
    throw new Error(`Private configuration in artifact: ${file}`);
  }
  if (file.includes('/api/')) {
    if (!files.some(path => path.endsWith('certs/supabase-ca.crt'))) throw new Error(`Missing public CA: ${file}`);
    apiCount++;
  }
}
console.log(`PASS: ${traces.length} app traces exclude private configuration; ${apiCount} APIs include the public CA`);
