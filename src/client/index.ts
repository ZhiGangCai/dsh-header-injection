/**
 * agent-router-ua — 请求头注入插件（client half）。
 *
 * 在 DSH 设置页「插件配置」区注册一张可折叠卡片，编辑请求头注入配置：
 * 启用开关 + 多条 host 规则（每条 = 逗号分隔 host 后缀列表 + 一组多行
 * 「头名: 值」请求头，注入时同名覆盖原值），可增删。配置经 DSH 设置服务
 * （ctx.settingsScope）读写命名空间 `agent-router-ua`，保存后 node half
 * 通过 settings watch 实时生效，无需重启。
 *
 * 2026-08-31 改版：插件由「UA 注入」升级为通用「请求头注入」；表单从
 * hosts/ua 升级为 rules 数组（hosts + headers）；v0.1.0 旧格式 {hosts, ua}
 * 与 v0.2.0 中间格式 rules[{hosts, ua}] 快照自动迁移为 User-Agent 头规则。
 */

import React, { useEffect, useRef, useState } from 'react'

/** 插件名：合同要求与包名一致。 */
export const name = 'agent-router-ua'

/** 严格注入：本插件 client 通过 ctx 访问的服务（settingsScope 动态注入）。 */
export const inject = ['slots']

/** 设置命名空间：与 node half 注册的 join key 一致。 */
const NS = 'agent-router-ua'

/** 默认值（与 node half 保持一致）。 */
const DEFAULT_HOSTS = 'agentrouter.org'
const DEFAULT_UA = 'RooCode/0.15.0'
const DEFAULT_HEADERS = `User-Agent: ${DEFAULT_UA}`

// ── 卡片样式（沿用 DSH 设计令牌，保持与系统设置面板一致）────────────
const cardStyle = {
  overflow: 'hidden',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 10,
  background: 'var(--dsw-alias-bg-module-platform)',
}
const headerStyle = {
  boxSizing: 'border-box' as const,
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  border: 0,
  padding: '13px 14px',
  background: 'transparent',
  color: 'var(--dsw-alias-label-primary)',
  font: 'inherit',
  textAlign: 'left' as const,
  cursor: 'pointer',
}
const headTextStyle = {
  display: 'flex',
  minWidth: 0,
  flexDirection: 'column' as const,
  gap: 3,
}
const nameStyle = {
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 600,
}
const descriptionStyle = {
  fontSize: 13,
  lineHeight: '18px',
  color: 'var(--dsw-alias-label-tertiary)',
}
const chevronStyle = {
  flex: '0 0 auto',
  fontSize: 18,
  lineHeight: 1,
  transition: 'transform 120ms ease',
}
const cardBodyStyle = {
  borderTop: '1px solid var(--dsw-alias-border-l2)',
  padding: '16px 14px 18px',
}
const noteStyle = {
  margin: '0 0 12px',
  fontSize: 13,
  lineHeight: '18px',
  color: 'var(--dsw-alias-label-tertiary)',
}
const fieldRowStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 6,
  marginBottom: 12,
}
const fieldLabelStyle = {
  fontSize: 13,
  lineHeight: '18px',
  color: 'var(--dsw-alias-label-secondary)',
}
const inputStyle = {
  boxSizing: 'border-box' as const,
  width: '100%',
  minHeight: 34,
  padding: '6px 10px',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 8,
  background: 'var(--dsw-alias-bg-layer-1)',
  color: 'var(--dsw-alias-label-primary)',
  font: 'inherit',
  fontSize: 13,
}
/** 多行头列表 textarea 样式（沿用输入框令牌，加高支持多行编辑）。 */
const textareaStyle = {
  ...inputStyle,
  minHeight: 76,
  resize: 'vertical' as const,
  lineHeight: '18px',
}
const switchRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 12,
}
// ── 多规则编辑样式 ──────────────────────────────────────────────────
const ruleBlockStyle = {
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 8,
  padding: '10px 12px 12px',
  marginBottom: 10,
}
const ruleHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 8,
}
const ruleIndexStyle = {
  fontSize: 13,
  lineHeight: '18px',
  fontWeight: 600,
  color: 'var(--dsw-alias-label-secondary)',
}
const removeButtonStyle = {
  boxSizing: 'border-box' as const,
  minHeight: 26,
  padding: '2px 10px',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 13,
  background: 'transparent',
  color: 'var(--dsw-alias-label-tertiary)',
  font: 'inherit',
  fontSize: 12,
  cursor: 'pointer',
}
const addRowStyle = {
  display: 'flex',
  justifyContent: 'flex-start',
  marginBottom: 12,
}
const saveRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
}
const buttonStyle = {
  boxSizing: 'border-box' as const,
  minHeight: 34,
  padding: '6px 16px',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 18,
  background: 'var(--dsw-alias-bg-layer-1)',
  color: 'var(--dsw-alias-label-primary)',
  font: 'inherit',
  fontSize: 14,
  cursor: 'pointer',
}
const savedStyle = {
  fontSize: 13,
  lineHeight: '20px',
  color: 'var(--dsw-alias-state-success-primary)',
}
const errorStyle = {
  fontSize: 13,
  lineHeight: '20px',
  color: 'var(--dsw-alias-state-error-primary)',
}

/** 表单中的一条规则（编辑态字符串，保存时规整）。 */
type RuleForm = { hosts: string; headers: string }

/** 从快照值规整出表单初始字段（rules 数组优先，旧格式 hosts/ua 自动迁移）。 */
function snapshotToForm(value: unknown): { enabled: boolean; rules: RuleForm[] } {
  const v = (value ?? {}) as Record<string, unknown>
  const rules: RuleForm[] = []
  if (Array.isArray(v.rules)) {
    for (const item of v.rules as Array<Record<string, unknown>>) {
      if (item == null) continue
      const hosts = typeof item.hosts === 'string' ? item.hosts : ''
      // headers 多行头文本优先；仅有 ua 字段时（v0.2.0 中间格式）迁移为 User-Agent 头。
      let headers = typeof item.headers === 'string' ? item.headers : ''
      if (!headers && typeof item.ua === 'string' && item.ua) headers = `User-Agent: ${item.ua}`
      if (hosts || headers) rules.push({ hosts, headers })
    }
  }
  // 旧格式迁移（v0.1.0）：无 rules 时用 hosts + ua 构造单条 User-Agent 头规则。
  if (rules.length === 0 && typeof v.hosts === 'string' && v.hosts) {
    const ua = typeof v.ua === 'string' && v.ua ? v.ua : DEFAULT_UA
    rules.push({ hosts: v.hosts, headers: `User-Agent: ${ua}` })
  }
  if (rules.length === 0) rules.push({ hosts: DEFAULT_HOSTS, headers: DEFAULT_HEADERS })
  return { enabled: v.enabled !== false, rules }
}

/**
 * 设置面板卡片组件。通过 settingsScope 读取/写入命名空间 `agent-router-ua`。
 * 本地编辑 + 保存按钮：保存时写入启用开关与规则数组，node half 实时生效。
 * 规则 hosts 或 headers 任一为空的条目保存时丢弃（与 node half normalize 一致）。
 */
function UaInjectCard({ scope }: { scope: any }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<{ enabled: boolean; rules: RuleForm[] }>(() =>
    snapshotToForm(scope.getSnapshot()?.value),
  )
  const [writable, setWritable] = useState<boolean>(scope.getSnapshot()?.writable !== false)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  // 订阅 settingsScope 快照变化：外部写入时同步回表单。
  useEffect(() => {
    mounted.current = true
    const unsubscribe = scope.subscribe(() => {
      if (!mounted.current) return
      const snap = scope.getSnapshot()
      if (snap?.value !== undefined) setForm(snapshotToForm(snap.value))
      setWritable(snap?.writable !== false)
    })
    return () => {
      mounted.current = false
      unsubscribe?.()
    }
  }, [scope])

  /** 新增一条空规则（headers 预填默认 User-Agent 头，降低录入成本）。 */
  const addRule = (): void => {
    setForm((f) => ({ ...f, rules: [...f.rules, { hosts: '', headers: DEFAULT_HEADERS }] }))
  }

  /** 删除指定下标的规则。 */
  const removeRule = (index: number): void => {
    setForm((f) => ({ ...f, rules: f.rules.filter((_, i) => i !== index) }))
  }

  /** 更新指定下标规则的字段。 */
  const updateRule = (index: number, patch: Partial<RuleForm>): void => {
    setForm((f) => ({
      ...f,
      rules: f.rules.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    }))
  }

  const save = async () => {
    setSaved(null)
    setError(null)
    try {
      await scope.set('enabled', form.enabled)
      await scope.set(
        'rules',
        form.rules
          .map((r) => ({ hosts: r.hosts.trim(), headers: r.headers.trim() }))
          .filter((r) => r.hosts && r.headers),
      )
      if (!mounted.current) return
      setSaved('已保存，立即生效')
      window.setTimeout(() => {
        if (mounted.current) setSaved(null)
      }, 2500)
    } catch (e) {
      if (!mounted.current) return
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return React.createElement(
    'li',
    { style: cardStyle },
    React.createElement(
      'button',
      {
        type: 'button',
        style: headerStyle,
        'aria-expanded': open,
        'aria-label': `${open ? '收起' : '展开'}: 请求头注入`,
        onClick: () => setOpen(!open),
      },
      React.createElement(
        'span',
        { style: headTextStyle },
        React.createElement('span', { style: nameStyle }, '请求头注入'),
        React.createElement('span', { style: descriptionStyle }, '按 host 规则注入请求头（同名覆盖原值），可配置多条规则'),
      ),
      React.createElement(
        'span',
        { 'aria-hidden': 'true', style: { ...chevronStyle, transform: open ? 'rotate(180deg)' : 'none' } },
        '⌄',
      ),
    ),
    open
      ? React.createElement(
          'div',
          { style: cardBodyStyle },
          !writable
            ? React.createElement('p', { style: noteStyle }, '当前环境的设置为只读，无法保存。')
            : null,
          React.createElement(
            'div',
            { style: switchRowStyle },
            React.createElement('span', { style: fieldLabelStyle }, '启用注入'),
            React.createElement('input', {
              type: 'checkbox',
              checked: form.enabled,
              disabled: !writable,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, enabled: e.target.checked }),
            }),
          ),
          React.createElement('div', { style: fieldLabelStyle }, '注入规则（每条 = host 列表 + 请求头集合，host 逗号分隔、子域自动匹配，同名头覆盖原值）'),
          form.rules.map((rule, index) =>
            React.createElement(
              'div',
              { key: index, style: ruleBlockStyle },
              React.createElement(
                'div',
                { style: ruleHeaderStyle },
                React.createElement('span', { style: ruleIndexStyle }, `规则 ${index + 1}`),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    style: removeButtonStyle,
                    disabled: !writable,
                    'aria-label': `删除规则 ${index + 1}`,
                    onClick: () => removeRule(index),
                  },
                  '删除',
                ),
              ),
              React.createElement(
                'div',
                { style: fieldRowStyle },
                React.createElement('span', { style: fieldLabelStyle }, 'Host（逗号分隔多个）'),
                React.createElement('input', {
                  style: inputStyle,
                  value: rule.hosts,
                  disabled: !writable,
                  placeholder: DEFAULT_HOSTS,
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) => updateRule(index, { hosts: e.target.value }),
                }),
              ),
              React.createElement(
                'div',
                { style: { ...fieldRowStyle, marginBottom: 0 } },
                React.createElement('span', { style: fieldLabelStyle }, '请求头（每行一条「头名: 值」，同名覆盖原值）'),
                React.createElement('textarea', {
                  style: textareaStyle,
                  value: rule.headers,
                  disabled: !writable,
                  placeholder: DEFAULT_HEADERS,
                  spellCheck: false,
                  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => updateRule(index, { headers: e.target.value }),
                }),
              ),
            ),
          ),
          React.createElement(
            'div',
            { style: addRowStyle },
            React.createElement(
              'button',
              { type: 'button', style: buttonStyle, disabled: !writable, onClick: addRule },
              '+ 添加规则',
            ),
          ),
          React.createElement(
            'div',
            { style: saveRowStyle },
            React.createElement(
              'button',
              { type: 'button', style: buttonStyle, disabled: !writable, onClick: save },
              '保存',
            ),
            saved ? React.createElement('span', { style: savedStyle }, saved) : null,
            error ? React.createElement('span', { style: errorStyle }, error) : null,
          ),
        )
      : null,
  )
}

/** client half 入口：注册设置页「插件配置」卡片。 */
export function apply(ctx: any): void {
  try {
    ctx.inject(['settingsScope'], (raw: any) => {
      const c = raw
      const binder = c?.settingsScope
      if (binder === undefined || binder === null) return
      const scope = binder.bind({ namespace: NS })
      c.slots.inject('settings.plugin.item', () =>
        c.slots.register(
          {
            name: 'settings.plugin.item',
            key: NS,
            priority: 30,
          },
          () => React.createElement(UaInjectCard, { scope }),
        ),
      )
    })
  } catch (error) {
    console.error('[agent-router-ua] client 设置卡片加载失败:', error)
  }
}
