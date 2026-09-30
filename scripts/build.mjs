import { build } from 'esbuild'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const typecheck = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--emitDeclarationOnly', '--declaration'], { stdio: 'inherit' })
if (typecheck.status !== 0) process.exit(typecheck.status ?? 1)
await mkdir('lib', { recursive: true })
await mkdir('lib/types/ledger', { recursive: true })
for (const file of ['index.d.mts', 'index.d.ts']) await writeFile(`lib/types/ledger/${file}`, await readFile(`src/ledger/${file}`))
await build({ entryPoints: ['src/index.ts'], outfile: 'lib/index.js', bundle: true, platform: 'node', target: 'node22', format: 'esm', packages: 'external', sourcemap: false })
const { name } = JSON.parse(await readFile('package.json', 'utf8'))
const client = await build({
  entryPoints: ['src/client/index.tsx'], bundle: true, platform: 'browser', target: 'es2022',
  format: 'cjs', packages: 'external', write: false, jsx: 'automatic', minify: false,
  loader: { '.css': 'text' },
  define: { 'process.env.NODE_ENV': '"production"' },
})
await writeFile('lib/client.js', `window.__ModuleLoader__.load({id:${JSON.stringify(name)},factory:(require)=>{\nvar module={exports:{}};var exports=module.exports;\n${client.outputFiles[0].text}\nreturn module.exports;}});\n`)
console.log('Built Host and DSH client factory.')
