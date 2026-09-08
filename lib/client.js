window.__ModuleLoader__.load({
  id: 'dsh-header-injection',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var import_react = __toESM(require("react"), 1);
var name = "dsh-header-injection";
var inject = ["slots"];
var NS = "dsh-header-injection";
var DEFAULT_HOSTS = "agentrouter.org";
var DEFAULT_UA = "RooCode/0.15.0";
var DEFAULT_HEADERS = `User-Agent: ${DEFAULT_UA}`;
var cardStyle = {
  overflow: "hidden",
  border: "1px solid var(--dsw-alias-border-l2)",
  borderRadius: 10,
  background: "var(--dsw-alias-bg-module-platform)"
};
var headerStyle = {
  boxSizing: "border-box",
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  border: 0,
  padding: "13px 14px",
  background: "transparent",
  color: "var(--dsw-alias-label-primary)",
  font: "inherit",
  textAlign: "left",
  cursor: "pointer"
};
var headTextStyle = {
  display: "flex",
  minWidth: 0,
  flexDirection: "column",
  gap: 3
};
var nameStyle = {
  fontSize: 14,
  lineHeight: "20px",
  fontWeight: 600
};
var descriptionStyle = {
  fontSize: 13,
  lineHeight: "18px",
  color: "var(--dsw-alias-label-tertiary)"
};
var chevronStyle = {
  flex: "0 0 auto",
  fontSize: 18,
  lineHeight: 1,
  transition: "transform 120ms ease"
};
var cardBodyStyle = {
  borderTop: "1px solid var(--dsw-alias-border-l2)",
  padding: "16px 14px 18px"
};
var noteStyle = {
  margin: "0 0 12px",
  fontSize: 13,
  lineHeight: "18px",
  color: "var(--dsw-alias-label-tertiary)"
};
var fieldRowStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginBottom: 12
};
var fieldLabelStyle = {
  fontSize: 13,
  lineHeight: "18px",
  color: "var(--dsw-alias-label-secondary)"
};
var inputStyle = {
  boxSizing: "border-box",
  width: "100%",
  minHeight: 34,
  padding: "6px 10px",
  border: "1px solid var(--dsw-alias-border-l2)",
  borderRadius: 8,
  background: "var(--dsw-alias-bg-layer-1)",
  color: "var(--dsw-alias-label-primary)",
  font: "inherit",
  fontSize: 13
};
var textareaStyle = {
  ...inputStyle,
  minHeight: 76,
  resize: "vertical",
  lineHeight: "18px"
};
var switchRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 12
};
var ruleBlockStyle = {
  border: "1px solid var(--dsw-alias-border-l2)",
  borderRadius: 8,
  padding: "10px 12px 12px",
  marginBottom: 10
};
var ruleHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 8
};
var ruleIndexStyle = {
  fontSize: 13,
  lineHeight: "18px",
  fontWeight: 600,
  color: "var(--dsw-alias-label-secondary)"
};
var removeButtonStyle = {
  boxSizing: "border-box",
  minHeight: 26,
  padding: "2px 10px",
  border: "1px solid var(--dsw-alias-border-l2)",
  borderRadius: 13,
  background: "transparent",
  color: "var(--dsw-alias-label-tertiary)",
  font: "inherit",
  fontSize: 12,
  cursor: "pointer"
};
var addRowStyle = {
  display: "flex",
  justifyContent: "flex-start",
  marginBottom: 12
};
var saveRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12
};
var buttonStyle = {
  boxSizing: "border-box",
  minHeight: 34,
  padding: "6px 16px",
  border: "1px solid var(--dsw-alias-border-l2)",
  borderRadius: 18,
  background: "var(--dsw-alias-bg-layer-1)",
  color: "var(--dsw-alias-label-primary)",
  font: "inherit",
  fontSize: 14,
  cursor: "pointer"
};
var savedStyle = {
  fontSize: 13,
  lineHeight: "20px",
  color: "var(--dsw-alias-state-success-primary)"
};
var errorStyle = {
  fontSize: 13,
  lineHeight: "20px",
  color: "var(--dsw-alias-state-error-primary)"
};
function snapshotToForm(value) {
  const v = value ?? {};
  const rules = [];
  if (Array.isArray(v.rules)) {
    for (const item of v.rules) {
      if (item == null) continue;
      const hosts = typeof item.hosts === "string" ? item.hosts : "";
      let headers = typeof item.headers === "string" ? item.headers : "";
      if (!headers && typeof item.ua === "string" && item.ua) headers = `User-Agent: ${item.ua}`;
      if (hosts || headers) rules.push({ hosts, headers });
    }
  }
  if (rules.length === 0 && typeof v.hosts === "string" && v.hosts) {
    const ua = typeof v.ua === "string" && v.ua ? v.ua : DEFAULT_UA;
    rules.push({ hosts: v.hosts, headers: `User-Agent: ${ua}` });
  }
  if (rules.length === 0) rules.push({ hosts: DEFAULT_HOSTS, headers: DEFAULT_HEADERS });
  return { enabled: v.enabled !== false, rules };
}
function HeaderInjectCard({ scope }) {
  const [open, setOpen] = (0, import_react.useState)(false);
  const [form, setForm] = (0, import_react.useState)(
    () => snapshotToForm(scope.getSnapshot()?.value)
  );
  const [writable, setWritable] = (0, import_react.useState)(scope.getSnapshot()?.writable !== false);
  const [saved, setSaved] = (0, import_react.useState)(null);
  const [error, setError] = (0, import_react.useState)(null);
  const mounted = (0, import_react.useRef)(true);
  (0, import_react.useEffect)(() => {
    mounted.current = true;
    const unsubscribe = scope.subscribe(() => {
      if (!mounted.current) return;
      const snap = scope.getSnapshot();
      if (snap?.value !== void 0) setForm(snapshotToForm(snap.value));
      setWritable(snap?.writable !== false);
    });
    return () => {
      mounted.current = false;
      unsubscribe?.();
    };
  }, [scope]);
  const addRule = () => {
    setForm((f) => ({ ...f, rules: [...f.rules, { hosts: "", headers: DEFAULT_HEADERS }] }));
  };
  const removeRule = (index) => {
    setForm((f) => ({ ...f, rules: f.rules.filter((_, i) => i !== index) }));
  };
  const updateRule = (index, patch) => {
    setForm((f) => ({
      ...f,
      rules: f.rules.map((r, i) => i === index ? { ...r, ...patch } : r)
    }));
  };
  const save = async () => {
    setSaved(null);
    setError(null);
    try {
      await scope.set("enabled", form.enabled);
      await scope.set(
        "rules",
        form.rules.map((r) => ({ hosts: r.hosts.trim(), headers: r.headers.trim() })).filter((r) => r.hosts && r.headers)
      );
      if (!mounted.current) return;
      setSaved("已保存，立即生效");
      window.setTimeout(() => {
        if (mounted.current) setSaved(null);
      }, 2500);
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return import_react.default.createElement(
    "li",
    { style: cardStyle },
    import_react.default.createElement(
      "button",
      {
        type: "button",
        style: headerStyle,
        "aria-expanded": open,
        "aria-label": `${open ? "收起" : "展开"}: 请求头注入`,
        onClick: () => setOpen(!open)
      },
      import_react.default.createElement(
        "span",
        { style: headTextStyle },
        import_react.default.createElement("span", { style: nameStyle }, "请求头注入"),
        import_react.default.createElement("span", { style: descriptionStyle }, "按 host 规则注入请求头（同名覆盖原值），可配置多条规则")
      ),
      import_react.default.createElement(
        "span",
        { "aria-hidden": "true", style: { ...chevronStyle, transform: open ? "rotate(180deg)" : "none" } },
        "⌄"
      )
    ),
    open ? import_react.default.createElement(
      "div",
      { style: cardBodyStyle },
      !writable ? import_react.default.createElement("p", { style: noteStyle }, "当前环境的设置为只读，无法保存。") : null,
      import_react.default.createElement(
        "div",
        { style: switchRowStyle },
        import_react.default.createElement("span", { style: fieldLabelStyle }, "启用注入"),
        import_react.default.createElement("input", {
          type: "checkbox",
          checked: form.enabled,
          disabled: !writable,
          onChange: (e) => setForm({ ...form, enabled: e.target.checked })
        })
      ),
      import_react.default.createElement("div", { style: fieldLabelStyle }, "注入规则（每条 = host 列表 + 请求头集合，host 逗号分隔、子域自动匹配，同名头覆盖原值）"),
      form.rules.map(
        (rule, index) => import_react.default.createElement(
          "div",
          { key: index, style: ruleBlockStyle },
          import_react.default.createElement(
            "div",
            { style: ruleHeaderStyle },
            import_react.default.createElement("span", { style: ruleIndexStyle }, `规则 ${index + 1}`),
            import_react.default.createElement(
              "button",
              {
                type: "button",
                style: removeButtonStyle,
                disabled: !writable,
                "aria-label": `删除规则 ${index + 1}`,
                onClick: () => removeRule(index)
              },
              "删除"
            )
          ),
          import_react.default.createElement(
            "div",
            { style: fieldRowStyle },
            import_react.default.createElement("span", { style: fieldLabelStyle }, "Host（逗号分隔多个）"),
            import_react.default.createElement("input", {
              style: inputStyle,
              value: rule.hosts,
              disabled: !writable,
              placeholder: DEFAULT_HOSTS,
              onChange: (e) => updateRule(index, { hosts: e.target.value })
            })
          ),
          import_react.default.createElement(
            "div",
            { style: { ...fieldRowStyle, marginBottom: 0 } },
            import_react.default.createElement("span", { style: fieldLabelStyle }, "请求头（每行一条「头名: 值」，同名覆盖原值）"),
            import_react.default.createElement("textarea", {
              style: textareaStyle,
              value: rule.headers,
              disabled: !writable,
              placeholder: DEFAULT_HEADERS,
              spellCheck: false,
              onChange: (e) => updateRule(index, { headers: e.target.value })
            })
          )
        )
      ),
      import_react.default.createElement(
        "div",
        { style: addRowStyle },
        import_react.default.createElement(
          "button",
          { type: "button", style: buttonStyle, disabled: !writable, onClick: addRule },
          "+ 添加规则"
        )
      ),
      import_react.default.createElement(
        "div",
        { style: saveRowStyle },
        import_react.default.createElement(
          "button",
          { type: "button", style: buttonStyle, disabled: !writable, onClick: save },
          "保存"
        ),
        saved ? import_react.default.createElement("span", { style: savedStyle }, saved) : null,
        error ? import_react.default.createElement("span", { style: errorStyle }, error) : null
      )
    ) : null
  );
}
function apply(ctx) {
  try {
    ctx.inject(["settingsScope"], (raw) => {
      const c = raw;
      const binder = c?.settingsScope;
      if (binder === void 0 || binder === null) return;
      const scope = binder.bind({ namespace: NS });
      c.slots.inject(
        "settings.plugin.item",
        () => c.slots.register(
          {
            name: "settings.plugin.item",
            key: NS,
            priority: 30
          },
          () => import_react.default.createElement(HeaderInjectCard, { scope })
        )
      );
    });
  } catch (error) {
    console.error("[dsh-header-injection] client 设置卡片加载失败:", error);
  }
}

    return module.exports;
  }
});
