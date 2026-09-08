// src/index.ts
import z from "schemastery";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
var name = "agent-router-ua";
var inject = ["settings", "webServer"];
var NS = "agent-router-ua";
var DEFAULT_HOSTS = "agentrouter.org";
var DEFAULT_UA = "RooCode/0.15.0";
var DEFAULT_HEADERS = `User-Agent: ${DEFAULT_UA}`;
var Schema = z.object({
  enabled: z.boolean().default(true),
  rules: z.array(
    z.object({
      hosts: z.string().default(DEFAULT_HOSTS),
      headers: z.string().default(DEFAULT_HEADERS)
    })
  ).default([{ hosts: DEFAULT_HOSTS, headers: DEFAULT_HEADERS }])
});
function splitHosts(raw) {
  return typeof raw === "string" ? raw.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean) : [];
}
var HEADER_NAME_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
function parseHeaders(raw) {
  if (typeof raw !== "string") return [];
  const pairs = [];
  for (const line of raw.split("\n")) {
    const text = line.trim();
    if (!text) continue;
    const idx = text.indexOf(":");
    if (idx <= 0) continue;
    const name2 = text.slice(0, idx).trim();
    const value = text.slice(idx + 1).trim();
    if (!HEADER_NAME_RE.test(name2) || !value) continue;
    pairs.push({ name: name2, value });
  }
  return pairs;
}
function normalizeCfg(raw) {
  const rules = [];
  const addRule = (hostsRaw, headersRaw, uaRaw) => {
    const hosts = splitHosts(hostsRaw);
    if (hosts.length === 0) return;
    let headers = parseHeaders(headersRaw);
    if (headers.length === 0) {
      const ua = typeof uaRaw === "string" ? uaRaw.trim() : "";
      if (ua) headers = [{ name: "User-Agent", value: ua }];
    }
    if (headers.length > 0) rules.push({ hosts, headers });
  };
  if (Array.isArray(raw?.rules)) {
    for (const item of raw.rules) {
      if (item == null || typeof item !== "object") continue;
      addRule(item.hosts, item.headers, item.ua);
    }
  }
  if (rules.length === 0) addRule(raw?.hosts, raw?.headers, raw?.ua);
  if (rules.length === 0) {
    rules.push({ hosts: splitHosts(DEFAULT_HOSTS), headers: [{ name: "User-Agent", value: DEFAULT_UA }] });
  }
  return { rules, enabled: raw?.enabled !== false };
}
function readCfgFromEnv() {
  const enabled = (process.env.AR_UA_ENABLED ?? "1") !== "0";
  const rulesJson = process.env.AR_UA_RULES;
  if (rulesJson && rulesJson.trim()) {
    try {
      return normalizeCfg({ enabled, rules: JSON.parse(rulesJson) });
    } catch (error) {
      console.error(`[agent-router-ua] AR_UA_RULES 解析失败，回退单条规则：${String(error instanceof Error ? error.message : error)}`);
    }
  }
  return normalizeCfg({
    enabled,
    hosts: process.env.AR_UA_HOSTS ?? DEFAULT_HOSTS,
    headers: process.env.AR_UA_HEADERS ?? "",
    ua: process.env.AR_UA_VALUE || DEFAULT_UA
  });
}
function matchRule(hostname, rules) {
  const h = hostname.toLowerCase();
  for (const rule of rules) {
    if (rule.hosts.some((host) => h === host || h.endsWith(`.${host}`))) return rule;
  }
  return null;
}
function formatHeaders(headers) {
  return headers.map((h) => `${h.name}: ${h.value}`).join("；");
}
function formatRules(rules) {
  return rules.map((r) => `${r.hosts.join(",")} → ${formatHeaders(r.headers)}`).join("｜");
}
function urlOf(input) {
  try {
    if (typeof input === "string") return new URL(input);
    if (input instanceof URL) return input;
    return new URL(input.url);
  } catch {
    return null;
  }
}
function apply(ctx) {
  ctx.effect(() => {
    const tag = `[agent-router-ua]`;
    const cfgRef = { value: readCfgFromEnv() };
    let hits = 0;
    let rewrites = 0;
    const log = (msg) => {
      console.error(`${tag} ${(/* @__PURE__ */ new Date()).toISOString()} ${msg}`);
    };
    let stopWatch;
    const settings = ctx.get("settings");
    if (settings != null && typeof settings.register === "function") {
      try {
        const scope = settings.register(settingsNamespace(NS), Schema);
        cfgRef.value = normalizeCfg(scope.get());
        stopWatch = scope.watch((next) => {
          if (next == null) return;
          cfgRef.value = normalizeCfg(next);
          log(`配置已更新（设置面板）：${formatRules(cfgRef.value.rules)}（enabled=${cfgRef.value.enabled}）`);
        });
        log(`已注册设置命名空间 ${NS}`);
      } catch (error) {
        log(`设置命名空间注册失败，降级环境变量：${String(error instanceof Error ? error.message : error)}`);
      }
    } else {
      log(`settings 服务不可用，使用环境变量配置`);
    }
    const current = globalThis.fetch;
    const original = current?.__agentRouterUaOriginal ?? current;
    if (original === void 0) {
      log("全局 fetch 不可用，跳过 patch（环境不支持 fetch）");
      stopWatch?.();
      return () => {
      };
    }
    const patched = (async (input, init) => {
      const cfg = cfgRef.value;
      const url = urlOf(input);
      const rule = url !== null ? matchRule(url.hostname, cfg.rules) : null;
      if (cfg.enabled && rule !== null) {
        hits += 1;
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : void 0));
        for (const { name: name2, value } of rule.headers) {
          headers.set(name2, value);
        }
        rewrites += 1;
        const nextInit = { ...init ?? {}, headers };
        if (input instanceof Request) {
          return original(new Request(input, nextInit));
        }
        return original(input, nextInit);
      }
      return original(input, init);
    });
    patched.__agentRouterUaOriginal = original;
    globalThis.fetch = patched;
    log(`已 patch 全局 fetch：${formatRules(cfgRef.value.rules)}（enabled=${cfgRef.value.enabled}）`);
    const json = (res, code, body) => {
      res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(body));
    };
    let disposeHealth;
    const webServer = ctx.get("webServer");
    if (webServer != null) {
      disposeHealth = webServer.register({
        kind: "exact",
        path: "/agent-router-ua/health",
        handler: (_req, res) => {
          json(res, 200, {
            ok: true,
            plugin: name,
            version: "0.2.0",
            patched: globalThis.fetch === patched,
            rules: cfgRef.value.rules.map((r) => ({
              hosts: r.hosts,
              headers: r.headers.map((h) => ({ name: h.name, value: h.value }))
            })),
            enabled: cfgRef.value.enabled,
            hits,
            rewrites
          });
        }
      });
    } else {
      console.error(`${tag} webServer 服务不可用，跳过健康路由`);
    }
    let disposeCommand;
    const commands = ctx.get("commands");
    if (commands !== void 0 && commands !== null) {
      disposeCommand = commands.register({
        name: "agentrouter-ua",
        description: "请求头注入：status（默认）",
        recordInput: false,
        handler: async () => {
          const cfg = cfgRef.value;
          return {
            kind: "success",
            text: [
              `agent-router-ua v${"0.2.0"}（请求头注入）`,
              `已 patch：${globalThis.fetch === patched ? "是" : "否"}`,
              `注入规则（${cfg.rules.length} 条，同名头覆盖原值）：`,
              ...cfg.rules.map(
                (r, i) => `  ${i + 1}. ${r.hosts.join(", ")}\n${r.headers.map((h) => `     ${h.name}: ${h.value}`).join("\n")}`
              ),
              `命中请求：${hits}｜改写次数：${rewrites}`
            ].join("\n")
          };
        }
      });
    }
    return () => {
      stopWatch?.();
      disposeHealth?.();
      disposeCommand?.();
      if (globalThis.fetch === patched) {
        globalThis.fetch = patched.__agentRouterUaOriginal ?? original;
        log("已还原全局 fetch");
      }
    };
  });
}
export {
  apply,
  inject,
  name
};
