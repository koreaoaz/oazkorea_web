import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports = {};
const source = readFileSync(new URL('../src/lib/supabaseConfig.ts', import.meta.url), 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, URL, atob });
const issues = exports.inspectSupabaseConfig(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_KEY, process.env.MAIN_EXPECTED_SUPABASE_ORIGIN);
for (const issue of issues) console.log(`${issue.severity}: ${issue.code}`);
process.exitCode = issues.some(issue => issue.severity === 'error') ? 1 : 0;
