/**
 * dsh-header-injection — 请求头注入插件（node half）。
 *
 * 功能：按 host 规则改写出站 HTTP 请求头——多条规则、每条规则绑定一组
 * host 后缀与一组请求头；注入采用 Headers.set 语义，同名头覆盖原请求头
 * （大小写不敏感），规则未提及的头保持不变；未命中任何规则的请求原样
 * 透传，零影响。
 *
 * 典型用例（默认预设）：AgentRouter（https://agentrouter.org）前端是
 * 阿里云 WAF，按「TLS 指纹 + SDK 请求头 + 请求结构」校验客户端身份；
 * DSH 的 pi-ai OpenAI 通路（Node fetch/openai SDK）默认 User-Agent 为
 * deepseek-harness/<version>，被 401 unauthorized client detected 拦截。
 * 实测（2026-08-27）：仅把 User-Agent 改写为 RooCode/0.15.0，WAF 即放行
 * 进入 token 校验阶段（fake key 返回「无效的令牌」而非 unauthorized
 * client detected）。默认规则即预设了该场景，装好即可直接使用。
 *
 * 实现原理（不改 DSH 源码）：
 *   pi-ai 的 openai-completions 通路每次请求都 new 一个 OpenAI client，
 *   SDK 构造时经 Shims.getDefaultFetch() 捕获全局 fetch 引用；pi-ai 的
 *   anthropic-messages 通路直接调用全局 fetch。因此本插件在 apply 时
 *   patch 一次全局 fetch：仅对 host 命中规则的请求按该规则的头列表逐项
 *   覆盖，其余请求原样透传，后续所有新建 client 天然生效。
 *
 * 配置来源（设置面板优先）：
 *   通过 DSH 设置服务（ctx.settings）注册命名空间 `dsh-header-injection`，
 *   配置在「设置 → 插件 → 请求头注入」面板编辑并即时生效；当
 *   settings 服务不可用时（降级），回退读取环境变量：
 *     AR_UA_RULES   JSON 数组 [{ "hosts": "a.org,b.org", "headers": "User-Agent: X\nX-Foo: bar" }, ...]（可选，多规则）
 *     AR_UA_HEADERS 多行「头名: 值」文本（单条规则降级形态，优先于 UA 形态）
 *     AR_UA_HOSTS   逗号分隔的 host 后缀列表（默认 agentrouter.org）
 *     AR_UA_VALUE   UA 值（默认 RooCode/0.15.0，与 AR_UA_HOSTS 构成单条 User-Agent 规则）
 *     AR_UA_ENABLED 1/0（默认 1）
 */

import z from "schemastery"
import { settingsNamespace } from "@deepseek-ai/dsh-settings"

/**
 * 携带原始 fetch 引用的 patch 函数。
 * `__dshHeaderInjectionOriginal` 兼作已 patch 标记：HMR 重载时若上一实例
 * 未及时 dispose（崩溃/热替换），新实例直接复用其原始引用，避免二次包装。
 */
interface PatchedFetch extends typeof fetch {
  __dshHeaderInjectionOriginal?: typeof fetch
}

/** 插件名：合同要求与包名一致。 */
export const name = 'dsh-header-injection'

/** 严格注入：本插件通过 ctx 访问的全部服务。 */
export const inject = ['settings', 'webServer']

/** 设置命名空间：设置面板与 node half 的 join key。 */
const NS = 'dsh-header-injection'

/** 常量默认值（设置 schema 默认 + 环境变量 fallback + 兜底规则）。 */
const DEFAULT_HOSTS = 'agentrouter.org'
const DEFAULT_UA = 'RooCode/0.15.0'
const DEFAULT_HEADERS = `User-Agent: ${DEFAULT_UA}`

/** 注入头键值对。 */
type HeaderPair = Readonly<{ name: string; value: string }>

/** 单条规则：hosts 为逗号分隔的 host 后缀列表（子域自动匹配），headers 为该组 host 注入的头集合（同名覆盖）。 */
type Rule = Readonly<{ hosts: string[]; headers: HeaderPair[] }>

/**
 * 设置命名空间 schema（schemastery）。DSH 设置服务要求 schema 可被调用
 * 解析（`schema(value)`）且提供 `toJSON()`（供设置面板 describe），
 * schemastery 的 z 均满足（dsh-mnemon / dsh-context 同款用法）。
 * rules 内 headers 仍存多行「头名: 值」文本，与面板 textarea 编辑形态对齐。
 */
const Schema = z.object({
  enabled: z.boolean().default(true),
  rules: z.array(
    z.object({
      hosts: z.string().default(DEFAULT_HOSTS),
      headers: z.string().default(DEFAULT_HEADERS),
    }),
  ).default([{ hosts: DEFAULT_HOSTS, headers: DEFAULT_HEADERS }]),
})

/** 包版本号，构建时由 scripts/build.mjs 注入（esbuild define）。 */
declare const VERSION: string

/** 生效中的可变配置：patch 每次请求读取最新值，设置变化即时生效。 */
type RuntimeCfg = Readonly<{ rules: Rule[]; enabled: boolean }>

/** 逗号分隔字符串 → 小写 host 数组（去空）。 */
function splitHosts(raw: unknown): string[] {
  return typeof raw === 'string'
    ? raw.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)
    : []
}

/** RFC 7230 token 字符集：头名合法性校验（非法名丢弃，避免 Headers.set 运行时抛错炸掉整次请求）。 */
const HEADER_NAME_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

/** 解析多行「头名: 值」文本为键值对；空行 / 无冒号 / 非法名 / 空值行丢弃。值可含冒号（取首个冒号分割）。 */
function parseHeaders(raw: unknown): HeaderPair[] {
  if (typeof raw !== 'string') return []
  const pairs: HeaderPair[] = []
  for (const line of raw.split('\n')) {
    const text = line.trim()
    if (!text) continue
    const idx = text.indexOf(':')
    if (idx <= 0) continue
    const name = text.slice(0, idx).trim()
    const value = text.slice(idx + 1).trim()
    if (!HEADER_NAME_RE.test(name) || !value) continue
    pairs.push({ name, value })
  }
  return pairs
}

/**
 * 规整任意来源（设置面板 / 环境变量）的配置为运行时形状。
 * 规则内优先级：headers 多行文本 → ua 简写（等价一条 User-Agent 头）。
 * 整体优先级：rules 数组 → 顶层 hosts+ua 简写（单条规则）→ 默认规则。
 * hosts 为空或头集合为空的规则直接丢弃（与面板保存逻辑一致）。
 */
function normalizeCfg(raw: any): RuntimeCfg {
  const rules: Rule[] = []
  const addRule = (hostsRaw: unknown, headersRaw: unknown, uaRaw: unknown): void => {
    const hosts = splitHosts(hostsRaw)
    if (hosts.length === 0) return
    let headers = parseHeaders(headersRaw)
    if (headers.length === 0) {
      // ua 简写：等价于一条 User-Agent 头。
      const ua = typeof uaRaw === 'string' ? uaRaw.trim() : ''
      if (ua) headers = [{ name: 'User-Agent', value: ua }]
    }
    if (headers.length > 0) rules.push({ hosts, headers })
  }
  if (Array.isArray(raw?.rules)) {
    for (const item of raw.rules) {
      if (item == null || typeof item !== 'object') continue
      addRule(item.hosts, item.headers, item.ua)
    }
  }
  if (rules.length === 0) addRule(raw?.hosts, raw?.headers, raw?.ua)
  if (rules.length === 0) {
    rules.push({ hosts: splitHosts(DEFAULT_HOSTS), headers: [{ name: 'User-Agent', value: DEFAULT_UA }] })
  }
  return { rules, enabled: raw?.enabled !== false }
}

/** 从环境变量读取配置（settings 服务不可用时的降级来源）。 */
function readCfgFromEnv(): RuntimeCfg {
  const enabled = (process.env.AR_UA_ENABLED ?? '1') !== '0'
  // AR_UA_RULES：JSON 数组形态的多规则降级（与设置面板能力对等）。
  const rulesJson = process.env.AR_UA_RULES
  if (rulesJson && rulesJson.trim()) {
    try {
      return normalizeCfg({ enabled, rules: JSON.parse(rulesJson) })
    } catch (error) {
      console.error(`[dsh-header-injection] AR_UA_RULES 解析失败，回退单条规则：${String(error instanceof Error ? error.message : error)}`)
    }
  }
  // 单条规则降级：AR_UA_HEADERS 多行头文本优先；否则 AR_UA_HOSTS + AR_UA_VALUE 构成 User-Agent 规则。
  return normalizeCfg({
    enabled,
    hosts: process.env.AR_UA_HOSTS ?? DEFAULT_HOSTS,
    headers: process.env.AR_UA_HEADERS ?? '',
    ua: process.env.AR_UA_VALUE || DEFAULT_UA,
  })
}

/** 返回第一条 host 命中的规则；全部未命中返回 null（原样透传）。 */
function matchRule(hostname: string, rules: readonly Rule[]): Rule | null {
  const h = hostname.toLowerCase()
  for (const rule of rules) {
    if (rule.hosts.some((host) => h === host || h.endsWith(`.${host}`))) return rule
  }
  return null
}

/** 头集合的可读格式（日志 / 命令输出共用）。 */
function formatHeaders(headers: readonly HeaderPair[]): string {
  return headers.map((h) => `${h.name}: ${h.value}`).join('；')
}

/** 规则列表的可读格式。 */
function formatRules(rules: readonly Rule[]): string {
  return rules.map((r) => `${r.hosts.join(',')} → ${formatHeaders(r.headers)}`).join('｜')
}

/** 从 fetch 输入解析 URL；解析失败视为不匹配，原样透传。 */
function urlOf(input: RequestInfo | URL): URL | null {
  try {
    if (typeof input === 'string') return new URL(input)
    if (input instanceof URL) return input
    return new URL((input as Request).url)
  } catch {
    return null
  }
}

/**
 * node half 入口：patch 全局 fetch，按规则覆盖注入目标 host 的请求头。
 * 配置经 DSH 设置面板读写；settings 服务不可用时降级到环境变量。
 * @param ctx - Cordis 插件上下文（settings/webServer 已注入）。
 */
export function apply(ctx: any): void {
  ctx.effect(() => {
    const tag = `[dsh-header-injection]`
    // 可变配置：初始取环境变量，settings 可用时被覆盖/实时更新。
    const cfgRef: { value: RuntimeCfg } = { value: readCfgFromEnv() }
    let hits = 0
    let rewrites = 0

    const log = (msg: string): void => {
      console.error(`${tag} ${new Date().toISOString()} ${msg}`)
    }

    // ── 注册设置命名空间（settings 服务可用时）───────────────────
    let stopWatch: (() => void) | undefined
    const settings = ctx.get('settings')
    if (settings != null && typeof settings.register === 'function') {
      try {
        const scope = settings.register(settingsNamespace(NS), Schema)
        cfgRef.value = normalizeCfg(scope.get())
        stopWatch = scope.watch((next: any) => {
          if (next == null) return
          cfgRef.value = normalizeCfg(next)
          log(`配置已更新（设置面板）：${formatRules(cfgRef.value.rules)}（enabled=${cfgRef.value.enabled}）`)
        })
        log(`已注册设置命名空间 ${NS}`)
      } catch (error) {
        log(`设置命名空间注册失败，降级环境变量：${String(error instanceof Error ? error.message : error)}`)
      }
    } else {
      log(`settings 服务不可用，使用环境变量配置`)
    }

    // ── patch 全局 fetch（幂等）─────────────────────────────────────
    const current = globalThis.fetch as PatchedFetch | undefined
    const original: typeof fetch = current?.__dshHeaderInjectionOriginal ?? current
    if (original === undefined) {
      log('全局 fetch 不可用，跳过 patch（环境不支持 fetch）')
      stopWatch?.()
      return () => {}
    }

    const patched = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const cfg = cfgRef.value
      const url = urlOf(input)
      const rule = url !== null ? matchRule(url.hostname, cfg.rules) : null
      if (cfg.enabled && rule !== null) {
        hits += 1
        // 以原请求头为基础，逐条覆盖注入头（Headers.set：同名覆盖、大小写不敏感、其余头保持不变）。
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
        for (const { name, value } of rule.headers) {
          headers.set(name, value)
        }
        rewrites += 1
        const nextInit: RequestInit = { ...(init ?? {}), headers }
        if (input instanceof Request) {
          return original(new Request(input, nextInit))
        }
        return original(input, nextInit)
      }
      return original(input, init)
    }) as PatchedFetch
    patched.__dshHeaderInjectionOriginal = original
    globalThis.fetch = patched
    log(`已 patch 全局 fetch：${formatRules(cfgRef.value.rules)}（enabled=${cfgRef.value.enabled}）`)

    // ── HTTP 状态路由 ───────────────────────────────────────────────
    const json = (res: any, code: number, body: unknown): void => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(body))
    }
    let disposeHealth: (() => void) | undefined
    const webServer = ctx.get('webServer')
    if (webServer != null) {
      disposeHealth = webServer.register({
        kind: 'exact',
        path: '/dsh-header-injection/health',
        handler: (_req: unknown, res: any) => {
          json(res, 200, {
            ok: true,
            plugin: name,
            version: VERSION,
            patched: globalThis.fetch === patched,
            rules: cfgRef.value.rules.map((r) => ({
              hosts: r.hosts,
              headers: r.headers.map((h) => ({ name: h.name, value: h.value })),
            })),
            enabled: cfgRef.value.enabled,
            hits,
            rewrites,
          })
        },
      })
    } else {
      console.error(`${tag} webServer 服务不可用，跳过健康路由`)
    }

    // ── 命令组（commands 可选服务，缺失时跳过）─────────────────────
    let disposeCommand: (() => void) | undefined
    const commands = ctx.get('commands')
    if (commands !== undefined && commands !== null) {
      disposeCommand = commands.register({
        name: 'dsh-header-injection',
        description: '请求头注入：status（默认）',
        recordInput: false,
        handler: async () => {
          const cfg = cfgRef.value
          return {
            kind: 'success' as const,
            text: [
              `dsh-header-injection v${VERSION}（请求头注入）`,
              `已 patch：${globalThis.fetch === patched ? '是' : '否'}`,
              `注入规则（${cfg.rules.length} 条，同名头覆盖原值）：`,
              ...cfg.rules.map((r, i) =>
                `  ${i + 1}. ${r.hosts.join(', ')}\n${r.headers.map((h) => `     ${h.name}: ${h.value}`).join('\n')}`,
              ),
              `命中请求：${hits}｜改写次数：${rewrites}`,
            ].join('\n'),
          }
        },
      })
    }

    return () => {
      stopWatch?.()
      disposeHealth?.()
      disposeCommand?.()
      if (globalThis.fetch === patched) {
        globalThis.fetch = patched.__dshHeaderInjectionOriginal ?? original
        log('已还原全局 fetch')
      }
    }
  })
}
