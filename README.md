# dsh-header-injection

请求头注入插件（DSH Plugin）：按 host 规则注入 HTTP 请求头，**同名头覆盖原值**（`Headers.set` 语义），多条规则各自独立头集合；未命中任何规则的请求原样透传，零影响。

## 功能特性

- 多条注入规则，每条 = 逗号分隔 host 后缀列表（子域自动匹配）+ 多行「头名: 值」请求头集合；
- 同名头覆盖原值、头名大小写不敏感；规则未提及的头保持不变；
- 请求按规则顺序匹配，取第一条命中；
- 设置面板可视化增删改，保存即时生效（无需重启）；
- 环境变量降级配置；DSH 命令状态摘要 + HTTP 健康路由。

## 工作原理（不改 DSH 源码）

pi-ai 的 `openai-completions` 通路每次请求都新建一个 OpenAI client，SDK 构造时经 `Shims.getDefaultFetch()` 捕获全局 `fetch` 引用；`anthropic-messages` 通路直接调用全局 `fetch`。因此插件在 apply 时 **patch 一次全局 `fetch`**：

```text
DSH（pi-ai openai / anthropic 通路）
  └─ 全局 fetch（本插件 patch 后的包装）
       ├─ host 命中规则 1 → 逐条覆盖注入规则 1 的头集合，原样转发
       ├─ host 命中规则 2 → 逐条覆盖注入规则 2 的头集合，原样转发
       ├─ …（多条规则按序匹配，取第一条命中）
       └─ 其他 host → 原 fetch 原样透传，零影响
```

后续所有新建 client 拿到的都是被 patch 的 fetch，天然生效。与边车代理方案解耦：无子进程、无编译、无端口、无心跳。

## 安装

```bash
# 本地目录安装（构建产物 lib/ 已入库）
dsh plugin --profile web add /path/to/dsh-header-injection
```

装完重启 DSH web 后端使插件生效。

## 配置

### 设置面板（推荐）

插件默认预设一条规则：对 `agentrouter.org`（含 `co.agentrouter.org` 等子域）注入 `User-Agent: RooCode/0.15.0`。可在 **DSH 设置 → 插件 → 请求头注入** 面板编辑并**即时生效**（无需重启）：

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `enabled`（启用注入） | `true` | 关闭后 patch 保留但不再改写 |
| `rules`（注入规则） | `[{hosts: "agentrouter.org", headers: "User-Agent: RooCode/0.15.0"}]` | 规则数组，每条 = host 列表 + 请求头集合 |

每条规则由两个字段组成：

- **Host**：逗号分隔的 host 后缀列表，子域自动匹配（如 `example.org, foo.com` 会命中 `a.example.org`、`foo.com` 及其子域）；
- **请求头**：多行「头名: 值」文本，每行一条；注入时逐条 `Headers.set` 覆盖同名头。示例：

```text
User-Agent: RooCode/0.15.0
X-Title: my-app
```

面板支持**添加 / 删除任意多条规则**。保存时 Host 或请求头为空的规则会被丢弃（等于删除该条）；非法头名（非 RFC 7230 token）或空值的行会被忽略。

**简写形式**：规则内可用 `ua` 字段替代多行 headers（如 `{hosts: "example.org", ua: "MyUA/1.0"}`），等价于一条 `User-Agent` 头；两者同时存在时 `headers` 优先。

配置经 DSH 设置服务持久化到 `~/.dsh/settings.yaml` 的 `dsh-header-injection:` 段；node half 通过 settings watch 实时接收变更，保存即生效。

### 典型用例：绕过 AgentRouter 客户端 WAF

AgentRouter（https://agentrouter.org）前端是阿里云 WAF，按「TLS 指纹 + SDK 请求头 + 请求结构」三重校验客户端身份。DSH 的 OpenAI 兼容通路默认 `User-Agent` 为 `deepseek-harness/<version> (+...)`，直连会被拒：

```text
HTTP 401 {"error":{"message":"unauthorized client detected, contact support for
assistance at https://discord.gg/aYq5B4RW3"},"type":"unauthorized_client_error"}
```

实测（2026-08-27）：仅把 `User-Agent` 改写为 `RooCode/0.15.0`，WAF 即放行进入令牌校验阶段（假 key 返回 `new_api_error` 而非 `unauthorized_client_error`），无需附加 X-Title / X-Stainless-* 等头。插件默认规则即预设了该场景。

配套 `settings.yaml` 把 provider 指回直连（原边车方案指向本地代理时可恢复直连）：

```yaml
llm-pi-ai:
  providers:
    agent-router:
      displayName: AgentRouter
      apiKeyEnv: AGENT_ROUTER_API_KEY
      api: openai-completions
      baseURL: https://agentrouter.org/v1
      models:
        - id: deepseek-v4-flash
          name: Deepseek V4 Flash
```

### 环境变量降级

当 `settings` 服务不可用时（非标准 DSH 运行环境），回退读取环境变量：

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `AR_UA_RULES` | （未设） | JSON 数组多规则：`[{"hosts":"a.org,b.org","headers":"User-Agent: X\nX-Foo: bar"},{"hosts":"c.org","headers":"User-Agent: Y"}]` |
| `AR_UA_HEADERS` | （未设） | 多行「头名: 值」文本（单条规则头集合形态，优先于 UA 形态） |
| `AR_UA_HOSTS` | `agentrouter.org` | 逗号分隔的 host 后缀列表（`AR_UA_RULES`/`AR_UA_HEADERS` 未设时生效） |
| `AR_UA_VALUE` | `RooCode/0.15.0` | UA 值，与 `AR_UA_HOSTS` 构成单条 User-Agent 规则 |
| `AR_UA_ENABLED` | `1` | `0` 时 patch 保留但不再改写 |

## 使用

- 状态摘要：DSH 命令 `dsh-header-injection`（输出当前规则列表与命中/改写计数）
- 健康路由：`GET /dsh-header-injection/health`（含规则数组、命中/改写计数）

## 开发

```bash
npm install          # 安装构建依赖（esbuild/typescript）
npm run bundle       # 构建双半产物 lib/index.js + lib/client.js
npm run gates        # 一致性门禁（包合同 + 产物关键标记）
```

## 已知限制

- 仅覆盖注入请求头；若目标站点后续收紧 WAF 判定（如校验完整请求结构），需在规则中补充 X-Title / X-Stainless-* 等头。
- TLS 指纹未伪装，当前实测表明 agentrouter.org 未按指纹拒绝该 UA 组合。

## License

MIT
