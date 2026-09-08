/**
 * build.mjs — agent-router-ua 双半构建（esbuild）。
 *
 * 产物：
 *   lib/index.js    node half（ESM）：patch 全局 fetch + 注册设置命名空间。
 *   lib/client.js   browser half（ModuleLoader 包裹）：设置面板卡片。
 * @deepseek-ai/* 平台包保持 external（profile 已提供，合同禁止打进依赖声明或产物）；
 * schemastery 由 profile 顶层提供（dsh-mnemon 同款）；react 由 client 宿主 external。
 *
 * 版本号经 define 注入（VERSION），避免运行期再读 package.json。
 */
import { build } from 'esbuild'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
mkdirSync(path.join(root, 'lib'), { recursive: true })

const VERSION = JSON.stringify(pkg.version)

// ── node half ───────────────────────────────────────────────────────
await build({
  entryPoints: [path.join(root, 'src/index.ts')],
  outfile: path.join(root, 'lib/index.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  charset: 'utf8',
  // 平台服务包、Node 内置、schemastery（profile 顶层提供）一律 external。
  external: ['@deepseek-ai/*', 'node:*', 'schemastery'],
  define: { VERSION },
  sourcemap: false,
  logLevel: 'info',
})

// ── client half ─────────────────────────────────────────────────────
await build({
  entryPoints: [path.join(root, 'src/client/index.ts')],
  outfile: path.join(root, 'lib/client.js'),
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  target: 'es2020',
  charset: 'utf8',
  // react / react/jsx-runtime / @deepseek-ai/* 由 DSH client 宿主提供。
  external: ['react', 'react/jsx-runtime', '@deepseek-ai/*'],
  define: { VERSION },
  sourcemap: false,
  logLevel: 'info',
  // 包裹成 DSH client ModuleLoader 期望的格式：
  //   window.__ModuleLoader__.load({ id, factory: (require) => { ... return module.exports } })
  banner: {
    js: `window.__ModuleLoader__.load({
  id: 'agent-router-ua',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    `,
  },
  footer: {
    js: `
    return module.exports;
  }
});`,
  },
})

console.log(`✓ 构建完成：lib/index.js + lib/client.js（v${pkg.version}）`)
