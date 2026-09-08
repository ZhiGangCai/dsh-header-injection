/**
 * gates.mjs — dsh-header-injection 轻量一致性门禁。
 *
 * 校验对象（不依赖 tsc 全量编译）：
 *   1. lib/index.js（node half）与 lib/client.js（browser half）产物存在；
 *   2. 包合同：exports 含 "."、"./client"、"./package.json"；禁止 @deepseek-ai
 *      运行时依赖（平台包由 profile 提供），允许 schemastery（profile 顶层提供）；
 *   3. node half 含关键标记：插件名、展示名「请求头注入」、多规则模型
 *      （rules + matchRule）、请求头解析（parseHeaders）、同名头覆盖
 *      （headers.set）、配置规整（normalizeCfg）、agentrouter.org 默认
 *      规则、RooCode UA 默认值、全局 fetch patch、设置命名空间注册；
 *   4. client half 为 DSH ModuleLoader 格式，含「请求头注入」设置卡片、
 *      多规则编辑（添加规则 + textarea）与 settingsScope 读写。
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
let failed = false

function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed = true
}

const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
check('包名 dsh-header-injection', pkg.name === 'dsh-header-injection')
check('版本 0.1.0', pkg.version === '0.1.0')
check('type=module', pkg.type === 'module')
check('main=lib/index.js', pkg.main === 'lib/index.js')
check('exports 含 "."', pkg.exports?.['.'] === './lib/index.js')
check('exports 含 "./client"', pkg.exports?.['./client'] === './lib/client.js')
check('exports 含 "./package.json"', pkg.exports?.['./package.json'] === './package.json')
check('dsh.client.platform=web', pkg.dsh?.client?.platform === 'web')

const deps = { ...(pkg.dependencies ?? {}) }
const banned = Object.keys(deps).filter((d) => d.startsWith('@deepseek-ai/'))
check('无 @deepseek-ai 运行时依赖', banned.length === 0, banned.join(',') || '合规')
check('schemastery 依赖已声明', deps['schemastery'] != null, deps['schemastery'] ?? '缺失')

check('lib/index.js 存在', existsSync(path.join(root, 'lib/index.js')))
check('lib/client.js 存在', existsSync(path.join(root, 'lib/client.js')))

const js = readFileSync(path.join(root, 'lib/index.js'), 'utf8')
check('node half：插件名预埋', js.includes('dsh-header-injection'))
check('node half：展示名 请求头注入', js.includes('请求头注入'))
check('node half：默认规则含 agentrouter.org', js.includes('agentrouter.org'))
check('node half：RooCode UA 默认值', js.includes('RooCode/0.15.0'))
check('node half：多规则模型（rules 数组 + matchRule）', js.includes('rules') && js.includes('matchRule'))
check('node half：请求头解析 parseHeaders', js.includes('parseHeaders'))
check('node half：配置规整 normalizeCfg', js.includes('normalizeCfg'))
check('node half：环境变量多规则降级 AR_UA_RULES', js.includes('AR_UA_RULES'))
check('node half：环境变量头文本降级 AR_UA_HEADERS', js.includes('AR_UA_HEADERS'))
check('node half：patch 全局 fetch', js.includes('globalThis.fetch'))
check('node half：保留原始 fetch 透传', js.includes('original(') && js.includes('original(input'))
check('node half：同名头覆盖语义 headers.set', js.includes('headers.set('))
check('node half：设置命名空间注册', js.includes('settingsNamespace') && js.includes('.register(') && js.includes('scope.watch'))
check('node half：schemastery external', js.includes('from "schemastery"'))

const client = readFileSync(path.join(root, 'lib/client.js'), 'utf8')
check('client half：ModuleLoader 格式', client.includes('window.__ModuleLoader__.load({'))
check('client half：id 正确', client.includes(`id: 'dsh-header-injection'`))
check('client half：设置卡片 请求头注入', client.includes('请求头注入'))
check('client half：多规则编辑（添加规则）', client.includes('添加规则'))
check('client half：头集合多行编辑 textarea', client.includes('textarea'))
check('client half：快照规整 snapshotToForm', client.includes('snapshotToForm'))
check('client half：settings.plugin.item 卡片', client.includes('settings.plugin.item'))
check('client half：settingsScope 绑定', client.includes('settingsScope') && client.includes('.bind({ namespace: NS })'))
check('client half：react external', client.includes('require("react")'))

if (failed) {
  console.error('门禁未通过')
  process.exit(1)
}
console.log('全部门禁通过')
