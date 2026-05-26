import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const root = process.cwd();
const outDir = join(root, '.tmp-ledger-tests');
const files = [
  'lib/ledger/types.ts',
  'lib/ledger/calculations.ts',
  'tests/ledger-calculations.test.ts',
];

rmSync(outDir, { recursive: true, force: true });

for (const file of files) {
  const source = ts.sys.readFile(join(root, file));
  if (!source) throw new Error(`Unable to read ${file}`);
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: file,
  }).outputText;
  const target = join(outDir, file.replace(/\.ts$/, '.js'));
  mkdirSync(dirname(target), { recursive: true });
  ts.sys.writeFile(target, output);
}

const result = spawnSync(process.execPath, ['--test', join(outDir, 'tests/ledger-calculations.test.js')], {
  stdio: 'inherit',
});

rmSync(outDir, { recursive: true, force: true });
process.exit(result.status ?? 1);
