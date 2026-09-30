window.__ModuleLoader__.load({id:"dsh-points-mall",factory:(require)=>{
var module={exports:{}};var exports=module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  PACKAGE_NAME: () => PACKAGE_NAME,
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var import_react2 = require("react");
var import_client = require("react-dom/client");

// src/client/Configuration.tsx
var import_react = require("react");

// src/client/api.ts
async function readJsonResponse(response) {
  let value;
  try {
    value = await response.json();
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "SyntaxError") throw error;
    throw new Error(response.ok ? "\u670D\u52A1\u8FD4\u56DE\u7684\u5185\u5BB9\u4E0D\u662F\u6709\u6548 JSON\uFF0C\u8BF7\u91CD\u8BD5\u3002" : `\u8BF7\u6C42\u5931\u8D25\uFF08HTTP ${response.status}\uFF09\uFF0C\u8BF7\u91CD\u8BD5\u3002`);
  }
  if (!response.ok) {
    const message2 = value?.error?.message;
    throw new Error(typeof message2 === "string" ? `\u8BF7\u6C42\u5931\u8D25\uFF08HTTP ${response.status}\uFF09\uFF1A${message2}` : `\u8BF7\u6C42\u5931\u8D25\uFF08HTTP ${response.status}\uFF09\uFF0C\u8BF7\u91CD\u8BD5\u3002`);
  }
  return value;
}
async function requestJson(path, options = {}) {
  const timeout = AbortSignal.timeout(8e3);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: options.body === void 0 ? void 0 : { "Content-Type": "application/json" },
    body: options.body === void 0 ? void 0 : JSON.stringify(options.body),
    cache: "no-store",
    signal
  });
  return readJsonResponse(response);
}

// src/client/setup.ts
async function completeSetup(options) {
  const snapshot = options.form.getSnapshot();
  if (snapshot.status !== "ready" || !snapshot.writable) throw new Error("\u8D26\u672C\u8BBE\u7F6E\u5C1A\u672A\u51C6\u5907\u597D\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002");
  const dataDir = options.dataDir.trim();
  const timeZone = options.timeZone.trim();
  try {
    new Intl.DateTimeFormat("zh-CN", { timeZone }).format();
  } catch {
    throw new Error("\u65F6\u533A\u65E0\u6548\uFF0C\u8BF7\u4F7F\u7528 Asia/Shanghai \u7B49\u65F6\u533A\u540D\u79F0\u3002");
  }
  if (options.mode === "existing" && !dataDir) throw new Error("\u8BF7\u5148\u9009\u62E9\u5DF2\u6709\u8D26\u672C\u76EE\u5F55\u3002");
  const endpoint = options.mode === "new" ? "initialize" : "validate";
  const value = await requestJson(
    `${options.baseUrl ?? "api/points-mall/"}${endpoint}`,
    { method: "POST", body: dataDir ? { dataDir } : {} }
  );
  if (typeof value.dataDir !== "string" || !value.dataDir || value.validation?.valid !== true) {
    throw new Error("\u8D26\u672C\u672A\u901A\u8FC7\u68C0\u67E5\uFF0C\u8BF7\u68C0\u67E5\u76EE\u5F55\u540E\u91CD\u8BD5\u3002");
  }
  const accepted = await options.form.mutate([
    { op: "set", path: ["dataDir"], value: value.dataDir },
    { op: "set", path: ["timeZone"], value: timeZone },
    { op: "set", path: ["setupVersion"], value: 1 },
    ...(snapshot.value?.setupVersion ?? 0) < 1 ? [{ op: "set", path: ["jevEnabled"], value: false }] : []
  ], snapshot.revision);
  if (!accepted) throw new Error("\u914D\u7F6E\u672A\u80FD\u4FDD\u5B58\uFF0C\u8BF7\u91CD\u8BD5\uFF1B\u65B0\u5EFA\u7684\u8D26\u672C\u53EF\u4EE5\u901A\u8FC7\u201C\u8FDE\u63A5\u5DF2\u6709\u8D26\u672C\u201D\u7EE7\u7EED\u4F7F\u7528\u3002");
  return value.dataDir;
}

// src/client/Configuration.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function message(error) {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") return "\u64CD\u4F5C\u8D85\u65F6\uFF0C\u8BF7\u91CD\u8BD5\u3002";
    return error.message;
  }
  return "\u64CD\u4F5C\u672A\u80FD\u5B8C\u6210\uFF0C\u8BF7\u91CD\u8BD5\u3002";
}
function JevSettings({ form }) {
  const snapshot = (0, import_react.useSyncExternalStore)(form.subscribe.bind(form), form.getSnapshot.bind(form), form.getSnapshot.bind(form));
  const id = (0, import_react.useId)();
  const [credential, setCredential] = (0, import_react.useState)();
  const [key, setKey] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)("");
  const [notice, setNotice] = (0, import_react.useState)("");
  const mounted = (0, import_react.useRef)(true);
  (0, import_react.useEffect)(() => {
    mounted.current = true;
    const controller = new AbortController();
    void requestJson("api/points-mall/jev-key", { signal: controller.signal }).then((value) => {
      if (mounted.current) setCredential(value);
    }).catch((value) => {
      if (mounted.current && !controller.signal.aborted) setError(message(value));
    });
    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, []);
  const manageKey = async (clear) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await requestJson(`api/points-mall/jev-key${clear ? "/clear" : ""}`, {
        method: "POST",
        body: clear ? {} : { key: key.trim() }
      });
      if (!mounted.current) return;
      setCredential(result);
      setKey("");
      setNotice(clear ? "\u5DF2\u79FB\u9664 Jev \u5BC6\u94A5\u3002" : "Jev \u5BC6\u94A5\u5DF2\u4FDD\u5B58\u3002");
    } catch (value) {
      if (mounted.current) setError(message(value));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const setEnabled = async (enabled2) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const current = form.getSnapshot();
      const accepted = await form.mutate([{ op: "set", path: ["jevEnabled"], value: enabled2 }], current.revision);
      if (!accepted) throw new Error("Jev \u8BBE\u7F6E\u672A\u80FD\u4FDD\u5B58\uFF0C\u8BF7\u91CD\u8BD5\u3002");
    } catch (value) {
      if (mounted.current) setError(message(value));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const enabled = snapshot.value?.jevEnabled ?? false;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", { className: "pm-divider", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", { children: "Jev \u590D\u6838\uFF08\u53EF\u9009\uFF09" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u672A\u8BBE\u56FA\u5B9A\u5206\u503C\u7684\u4E8B\u9879\u9ED8\u8BA4\u7531\u5F53\u524D DSH \u6A21\u578B\u5B9A\u5206\u3002\u542F\u7528 Jev \u540E\uFF0C\u4F1A\u4F7F\u7528\u989D\u5916\u7684 API \u5BC6\u94A5\u590D\u6838\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "pm-choice", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "checkbox", checked: enabled, disabled: busy || !snapshot.writable || !credential?.configured && !enabled, onChange: (event) => {
        void setEnabled(event.target.checked);
      } }),
      "\u542F\u7528 Jev \u590D\u6838"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pm-field", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${id}-key`, children: "TypeSafe API \u5BC6\u94A5" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pm-input-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { id: `${id}-key`, type: "password", value: key, onChange: (event) => setKey(event.target.value), autoComplete: "off", spellCheck: false, placeholder: credential?.configured ? "\u5DF2\u4FDD\u5B58\uFF1B\u586B\u5199\u53EF\u66FF\u6362" : "\u586B\u5199\u5BC6\u94A5\u540E\u5373\u53EF\u542F\u7528", disabled: busy || credential?.writable === false }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "pm-button", disabled: busy || !key.trim() || credential?.writable === false, onClick: () => {
          void manageKey(false);
        }, children: "\u4FDD\u5B58\u5BC6\u94A5" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: credential === void 0 ? "\u6B63\u5728\u68C0\u67E5\u5BC6\u94A5\u2026" : credential.configured ? "\u5BC6\u94A5\u5DF2\u914D\u7F6E\uFF0C\u4FDD\u5B58\u540E\u4E0D\u4F1A\u663E\u793A\u539F\u503C\u3002" : "\u5C1A\u672A\u914D\u7F6E\u5BC6\u94A5\u3002\u65E0\u9700 Jev \u4E5F\u53EF\u4EE5\u6B63\u5E38\u8BB0\u8D26\u3002" }),
      credential?.configured && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "pm-text-button", disabled: busy || !credential.writable, onClick: () => {
        void manageKey(true);
      }, children: "\u79FB\u9664\u5BC6\u94A5" })
    ] }),
    error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pm-error", role: "alert", children: error }),
    notice && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pm-success", role: "status", children: notice })
  ] });
}
function Configuration({ form, summary }) {
  const snapshot = (0, import_react.useSyncExternalStore)(form.subscribe.bind(form), form.getSnapshot.bind(form), form.getSnapshot.bind(form));
  const card = (0, import_react.useSyncExternalStore)(summary.subscribe, summary.getSnapshot, summary.getSnapshot);
  const id = (0, import_react.useId)();
  const configured = (snapshot.value?.setupVersion ?? 0) >= 1 && Boolean(snapshot.value?.dataDir);
  const [mode, setMode] = (0, import_react.useState)(configured ? "existing" : "new");
  const [dataDir, setDataDir] = (0, import_react.useState)(snapshot.value?.dataDir ?? "");
  const [timeZone, setTimeZone] = (0, import_react.useState)(snapshot.value?.timeZone ?? "Asia/Shanghai");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)("");
  const [notice, setNotice] = (0, import_react.useState)("");
  const dirty = (0, import_react.useRef)(false);
  const mounted = (0, import_react.useRef)(true);
  (0, import_react.useEffect)(() => {
    if (snapshot.status === "ready" && !dirty.current) {
      setDataDir(snapshot.value?.dataDir ?? "");
      setTimeZone(snapshot.value?.timeZone ?? "Asia/Shanghai");
      setMode((snapshot.value?.setupVersion ?? 0) >= 1 ? "existing" : "new");
    }
  }, [snapshot.status, snapshot.value]);
  (0, import_react.useEffect)(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const pickDirectory = async () => {
    setError("");
    const picker = globalThis.__DSH_DIRECTORY_PICKER__;
    if (!picker) {
      setError("\u6B64\u73AF\u5883\u65E0\u6CD5\u6253\u5F00\u76EE\u5F55\u9009\u62E9\u5668\uFF0C\u8BF7\u5728\u8F93\u5165\u6846\u4E2D\u586B\u5199\u8D26\u672C\u76EE\u5F55\u3002");
      return;
    }
    try {
      const selected = await picker.pick();
      if (selected && mounted.current) {
        dirty.current = true;
        setDataDir(selected);
      }
    } catch (value) {
      if (mounted.current) setError(message(value));
    }
  };
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await completeSetup({ mode, dataDir, timeZone, form });
      if (!mounted.current) return;
      dirty.current = false;
      setDataDir(saved);
      setMode("existing");
      setNotice("\u8D26\u672C\u5DF2\u8FDE\u63A5\u3002\u73B0\u5728\u53EF\u4EE5\u5728\u5BF9\u8BDD\u4E2D\u8BF4\u201C\u8BB0\u5F55\u4ECA\u5929\u5B8C\u6210\u7684\u4E8B\u9879\u201D\u3002");
      await summary.refresh();
    } catch (value) {
      if (mounted.current) setError(message(value));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const defaultDirectory = card.status === "unconfigured" ? card.defaultDataDir : void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pm-config", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: configured ? "\u79EF\u5206\u8D26\u672C\u8BBE\u7F6E" : "\u5F00\u59CB\u8BB0\u5F55\u751F\u6D3B\u79EF\u5206" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: configured ? "\u5BF9\u8BDD\u8BB0\u8D26\u4E0E\u4FA7\u680F\u5361\u7247\u4F7F\u7528\u540C\u4E00\u4EFD\u8D26\u672C\u3002" : "\u521B\u5EFA\u7A7A\u8D26\u672C\uFF0C\u6216\u8FDE\u63A5\u5DF2\u6709\u79EF\u5206\u6570\u636E\u3002\u5B8C\u6210\u914D\u7F6E\u540E\u5373\u53EF\u5728\u5BF9\u8BDD\u4E2D\u8BB0\u8D26\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", { onSubmit: (event) => {
      void save(event);
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pm-choices", role: "radiogroup", "aria-label": "\u8D26\u672C\u6765\u6E90", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "pm-choice", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "radio", name: `${id}-mode`, value: "new", checked: mode === "new", disabled: busy, onChange: () => {
            dirty.current = true;
            setMode("new");
            setDataDir("");
            setNotice("");
          } }),
          "\u65B0\u5EFA\u7A7A\u8D26\u672C"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "pm-choice", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "radio", name: `${id}-mode`, value: "existing", checked: mode === "existing", disabled: busy, onChange: () => {
            dirty.current = true;
            setMode("existing");
            setDataDir(snapshot.value?.dataDir ?? "");
            setNotice("");
          } }),
          "\u8FDE\u63A5\u5DF2\u6709\u8D26\u672C"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pm-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${id}-directory`, children: "\u8D26\u672C\u76EE\u5F55" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pm-input-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { id: `${id}-directory`, type: "text", value: dataDir, onChange: (event) => {
            dirty.current = true;
            setDataDir(event.target.value);
          }, placeholder: mode === "new" ? "\u7559\u7A7A\uFF0C\u4F7F\u7528\u9ED8\u8BA4\u6570\u636E\u76EE\u5F55" : "\u9009\u62E9\u5305\u542B ledger \u76EE\u5F55\u7684\u8D26\u672C", disabled: busy, spellCheck: false, autoComplete: "off" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "pm-button", disabled: busy, onClick: () => {
            void pickDirectory();
          }, children: "\u9009\u62E9\u76EE\u5F55" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: mode === "new" ? `\u81EA\u52A8\u521B\u5EFA\u8D26\u672C\u4E0E\u901A\u7528\u89C4\u5219\u6A21\u677F\u3002${defaultDirectory ? `\u9ED8\u8BA4\u76EE\u5F55\uFF1A${defaultDirectory}` : ""}` : "\u4FDD\u5B58\u524D\u4F1A\u68C0\u67E5\u8D26\u672C\u683C\u5F0F\u3002\u68C0\u67E5\u8FC7\u7A0B\u4E0D\u4F1A\u4FEE\u6539\u5DF2\u6709\u6570\u636E\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pm-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${id}-timezone`, children: "\u4ECA\u65E5\u79EF\u5206\u4F7F\u7528\u7684\u65F6\u533A" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { id: `${id}-timezone`, type: "text", value: timeZone, onChange: (event) => {
          dirty.current = true;
          setTimeZone(event.target.value);
        }, disabled: busy, spellCheck: false, autoComplete: "off" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "\u9ED8\u8BA4 Asia/Shanghai\u3002\u4ECA\u65E5\u7D2F\u8BA1\u6309\u4E8B\u9879\u8BB0\u5F55\u7684\u65E5\u671F\u8BA1\u7B97\uFF0C\u5305\u542B\u540E\u7EED\u8C03\u6574\u3002" })
      ] }),
      snapshot.status === "loading" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { role: "status", children: "\u6B63\u5728\u52A0\u8F7D\u8BBE\u7F6E\u2026" }),
      (snapshot.status === "unavailable" || snapshot.status === "ready" && !snapshot.writable) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pm-error", role: "status", children: "\u6B64\u8FDE\u63A5\u65E0\u6CD5\u4FDD\u5B58\u8BBE\u7F6E\uFF0C\u8BF7\u5728 DSH Desktop \u4E2D\u914D\u7F6E\u3002" }),
      error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pm-error", role: "alert", children: error }),
      notice && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pm-success", role: "status", children: notice }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pm-form-actions", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "submit", className: "pm-button pm-button-primary", disabled: busy || snapshot.status !== "ready" || !snapshot.writable, children: busy ? "\u6B63\u5728\u68C0\u67E5\u5E76\u4FDD\u5B58\u2026" : mode === "new" ? "\u521B\u5EFA\u5E76\u5F00\u59CB\u8BB0\u8D26" : "\u68C0\u67E5\u5E76\u8FDE\u63A5\u8D26\u672C" }) })
    ] }),
    configured && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(JevSettings, { form })
  ] });
}
function Activation({ onOpenDetails, onDismiss }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pm-activation", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "\u751F\u6D3B\u79EF\u5206\u5DF2\u542F\u7528" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u5148\u8BBE\u7F6E\u79EF\u5206\u8D26\u672C\uFF0C\u5373\u53EF\u663E\u793A\u79EF\u5206\u3001\u7B49\u7EA7\u548C\u4ECA\u65E5\u7D2F\u8BA1\uFF0C\u5E76\u5728\u5BF9\u8BDD\u4E2D\u8BB0\u8D26\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pm-form-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "pm-button pm-button-primary", onClick: onOpenDetails, children: "\u8BBE\u7F6E\u79EF\u5206\u8D26\u672C" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "pm-button", onClick: onDismiss, children: "\u7A0D\u540E\u8BBE\u7F6E" })
    ] })
  ] });
}

// src/client/PointsCard.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function SettingsIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { viewBox: "0 0 16 16", width: "16", height: "16", fill: "none", strokeWidth: "1.3", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M8 9.75012C8.9665 9.75012 9.75 8.96662 9.75 8.00012C9.75 7.03362 8.9665 6.25012 8 6.25012C7.0335 6.25012 6.25 7.03362 6.25 8.00012C6.25 8.96662 7.0335 9.75012 8 9.75012Z", stroke: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M13.0107 7.79377C12.9505 7.89401 12.9205 7.94413 12.9205 7.99951C12.9205 8.0549 12.9505 8.10502 13.0106 8.20528L13.9849 9.83006C14.045 9.93029 14.0751 9.9804 14.0751 10.0358C14.0751 10.0911 14.045 10.1413 13.9849 10.2415L13.0037 11.8777C12.9468 11.9726 12.9184 12.0201 12.8725 12.0461C12.8267 12.072 12.7713 12.072 12.6607 12.072H10.6704C10.5598 12.072 10.5045 12.072 10.4586 12.098C10.4128 12.1239 10.3843 12.1714 10.3274 12.2662L9.33825 13.9142C9.28133 14.009 9.25287 14.0564 9.20703 14.0823C9.16118 14.1083 9.10588 14.1083 8.99529 14.1083H7.00486C6.89426 14.1083 6.83896 14.1083 6.79312 14.0823C6.74727 14.0564 6.71881 14.009 6.6619 13.9142L5.67273 12.2662C5.61581 12.1714 5.58735 12.1239 5.54151 12.098C5.49566 12.072 5.44036 12.072 5.32977 12.072H3.33945C3.2288 12.072 3.17347 12.072 3.12761 12.0461C3.08176 12.0201 3.0533 11.9726 2.9964 11.8777L2.0152 10.2415C1.9551 10.1413 1.92505 10.0911 1.92505 10.0358C1.92505 9.9804 1.9551 9.93029 2.0152 9.83006L2.98951 8.20528C3.04963 8.10502 3.07969 8.0549 3.07969 7.99951C3.07968 7.94413 3.04961 7.89401 2.98946 7.79377L2.01529 6.17011C1.95514 6.06987 1.92507 6.01975 1.92507 5.96437C1.92506 5.90899 1.95512 5.85886 2.01524 5.7586L2.9964 4.1224C3.0533 4.0275 3.08176 3.98005 3.12761 3.95408C3.17347 3.92811 3.2288 3.92811 3.33945 3.92811H5.32977C5.44036 3.92811 5.49566 3.92811 5.54151 3.90216C5.58735 3.87621 5.61581 3.82879 5.67273 3.73397L6.6619 2.08599C6.71881 1.99116 6.74727 1.94375 6.79312 1.9178C6.83896 1.89185 6.89426 1.89185 7.00486 1.89185H8.99529C9.10588 1.89185 9.16118 1.89185 9.20703 1.9178C9.25287 1.94375 9.28133 1.99116 9.33825 2.08599L10.3274 3.73397C10.3843 3.82879 10.4128 3.87621 10.4586 3.90216C10.5045 3.92811 10.5598 3.92811 10.6704 3.92811H12.6607C12.7713 3.92811 12.8267 3.92811 12.8725 3.95408C12.9184 3.98005 12.9468 4.0275 13.0037 4.1224L13.9849 5.7586C14.045 5.85886 14.0751 5.90899 14.0751 5.96437C14.0751 6.01975 14.045 6.06987 13.9849 6.17011L13.0107 7.79377Z", stroke: "currentColor", strokeMiterlimit: "10" })
  ] });
}
function PointsCard({ snapshot, onConfigure, onRetry }) {
  const format = (value) => value.toLocaleString("zh-CN");
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: "pm-card", "aria-label": "\u751F\u6D3B\u79EF\u5206", "aria-busy": snapshot.status === "loading", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pm-card-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u751F\u6D3B\u79EF\u5206" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "pm-icon-button", onClick: onConfigure, "aria-label": "\u914D\u7F6E\u751F\u6D3B\u79EF\u5206", title: "\u914D\u7F6E\u751F\u6D3B\u79EF\u5206", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(SettingsIcon, {}) })
    ] }),
    snapshot.status === "loading" && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pm-loading", role: "status", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u6B63\u5728\u8BFB\u53D6\u79EF\u5206\u2026" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "pm-loading-line" })
    ] }),
    snapshot.status === "unconfigured" && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pm-card-state", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: "\u628A\u5B8C\u6210\u7684\u751F\u6D3B\u4E8B\u9879\u53D8\u6210\u79EF\u5206\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "pm-text-button", onClick: onConfigure, children: "\u8BBE\u7F6E\u79EF\u5206\u8D26\u672C" })
    ] }),
    snapshot.status === "error" && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pm-card-state", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { role: "status", title: snapshot.message, children: "\u79EF\u5206\u6682\u65F6\u4E0D\u53EF\u7528" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pm-card-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "pm-text-button", onClick: onRetry, children: "\u91CD\u8BD5" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "pm-text-button", onClick: onConfigure, children: "\u68C0\u67E5\u914D\u7F6E" })
      ] })
    ] }),
    snapshot.status === "ready" && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pm-card-balance", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: format(snapshot.balance) }),
          " ",
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "pm-muted", children: "\u79EF\u5206" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "pm-level", children: [
          "Lv.",
          snapshot.level
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pm-progress-label", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
          format(snapshot.expInLevel),
          " / ",
          format(snapshot.expRequired),
          " \u7ECF\u9A8C"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
          "\u8FD8\u5DEE ",
          format(snapshot.expToNext)
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "pm-progress", role: "progressbar", "aria-label": `Lv.${snapshot.level} \u5347\u7EA7\u8FDB\u5EA6`, "aria-valuemin": 0, "aria-valuemax": snapshot.expRequired, "aria-valuenow": snapshot.expInLevel, "aria-valuetext": `${snapshot.expInLevel} / ${snapshot.expRequired} \u7ECF\u9A8C\uFF0C\u8FD8\u5DEE ${snapshot.expToNext} \u5347\u7EA7`, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "pm-progress-fill", style: { transform: `scaleX(${snapshot.progress})` } }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pm-card-today", title: `${snapshot.day} \xB7 ${snapshot.timeZone} \xB7 \u8BA1\u5165\u4ECA\u65E5\u8D5A\u53D6\u8BB0\u5F55\u7684\u6709\u6548\u79EF\u5206`, children: [
        "\u4ECA\u65E5\u7D2F\u8BA1 ",
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("strong", { children: [
          snapshot.todayEarned >= 0 ? "+" : "",
          format(snapshot.todayEarned)
        ] })
      ] })
    ] })
  ] });
}

// src/client/mount.ts
var POINTS_CARD_SELECTOR = "[data-dsh-life-points-card]";
var mounts = /* @__PURE__ */ new WeakMap();
function mountCardContainer(document2, render) {
  if (mounts.has(document2) || document2.querySelector(POINTS_CARD_SELECTOR)) return () => {
  };
  const window = document2.defaultView;
  if (!window || !document2.body) return () => {
  };
  const container = document2.createElement("div");
  container.setAttribute("data-dsh-life-points-card", "");
  mounts.set(document2, container);
  const unmount = render(container);
  let disposed = false;
  let frame;
  const place = () => {
    if (disposed) return;
    const column = document2.querySelector('[data-pane="sidebar"], [class*="sidebarCol"]');
    const foot = column?.querySelector('[class*="footArea"]');
    if (!foot) return;
    const usage = foot.querySelector("[data-dsh-usage-foot-card]");
    const settings = foot.querySelector('[class*="settingsArea"]');
    const anchor = usage ?? settings;
    if (anchor && anchor.parentElement === foot) {
      if (container.nextElementSibling !== anchor) foot.insertBefore(container, anchor);
    } else if (container.parentElement !== foot || foot.lastElementChild !== container) {
      foot.append(container);
    }
    const collapsed = document2.querySelector('[data-sidebar-collapsed="true"]') !== null || column?.querySelector('[class*="collapsed"]') !== null;
    container.hidden = collapsed;
  };
  place();
  const observer = new window.MutationObserver(() => {
    if (frame !== void 0 || disposed) return;
    frame = window.requestAnimationFrame(() => {
      frame = void 0;
      place();
    });
  });
  observer.observe(document2.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "data-sidebar-collapsed"]
  });
  return () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    if (frame !== void 0) window.cancelAnimationFrame(frame);
    unmount();
    container.remove();
    mounts.delete(document2);
  };
}

// src/client/styles.ts
var STYLES = `
[data-dsh-life-points-card][hidden] { display: none !important; }
.pm-card, .pm-config, .pm-activation { color: var(--dsw-alias-label-primary, CanvasText); font-family: inherit; box-sizing: border-box; }
.pm-card *, .pm-config *, .pm-activation * { box-sizing: border-box; }
.pm-card { padding: 9px 10px; margin: 4px 0 6px; border: 1px solid var(--dsw-alias-border-l2, #d9dde5); border-radius: 12px; background: var(--dsw-alias-bg-layer-2, Canvas); font-size: 12px; line-height: 1.45; font-variant-numeric: tabular-nums; }
.pm-card-head, .pm-card-balance, .pm-progress-label { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
.pm-card-head { height: 20px; font-weight: 500; }
.pm-card-balance { margin-top: 4px; }
.pm-card-balance strong { font-size: 18px; font-weight: 600; }
.pm-level { font-size: 12px; font-weight: 500; }
.pm-muted, .pm-progress-label, .pm-card-today { color: var(--dsw-alias-label-secondary, #555f70); }
.pm-progress-label { margin-top: 5px; font-size: 11px; }
.pm-progress { height: 4px; margin-top: 4px; overflow: hidden; border-radius: 4px; background: var(--dsw-alias-bg-layer-4, #e4e7ed); }
.pm-progress-fill { width: 100%; height: 100%; transform-origin: left; border-radius: inherit; background: var(--dsw-alias-brand-primary, #4d6bfe); transition: transform 180ms ease-out; }
.pm-card-today { margin-top: 5px; font-size: 11px; }
.pm-card-today strong { color: var(--dsw-alias-label-primary, CanvasText); font-weight: 500; }
.pm-icon-button, .pm-text-button { appearance: none; background: transparent; border: 0; font: inherit; cursor: pointer; color: inherit; }
.pm-icon-button { display: grid; place-items: center; width: 26px; height: 26px; padding: 4px; border-radius: 6px; color: var(--dsw-alias-label-secondary, #555f70); }
.pm-icon-button:hover { background: var(--dsw-alias-bg-layer-4, #e4e7ed); color: var(--dsw-alias-label-primary, CanvasText); }
.pm-text-button { padding: 3px 0; color: var(--dsw-alias-brand-primary, #4d6bfe); font-weight: 500; text-underline-offset: 3px; }
.pm-text-button:hover { text-decoration: underline; }
.pm-card-actions { display: flex; gap: 14px; }
.pm-card-state p { margin: 7px 0 2px; color: var(--dsw-alias-label-secondary, #555f70); }
.pm-loading { padding: 9px 0 3px; color: var(--dsw-alias-label-secondary, #555f70); }
.pm-loading-line { width: 60%; height: 4px; border-radius: 4px; background: var(--dsw-alias-bg-layer-4, #e4e7ed); margin-top: 9px; }
.pm-config { max-width: 620px; font-size: 13px; line-height: 1.6; }
.pm-config h3, .pm-activation h3 { margin: 0 0 6px; font-size: 16px; font-weight: 600; }
.pm-config p, .pm-activation p { margin: 0 0 14px; color: var(--dsw-alias-label-secondary, #555f70); }
.pm-config fieldset { margin: 18px 0 0; padding: 0; border: 0; }
.pm-config legend { padding: 0; margin: 0 0 8px; font-weight: 500; }
.pm-choices { display: flex; flex-wrap: wrap; gap: 8px 20px; margin-bottom: 14px; }
.pm-choice { display: inline-flex; align-items: center; gap: 7px; cursor: pointer; }
.pm-config input[type=radio], .pm-config input[type=checkbox] { accent-color: var(--dsw-alias-brand-primary, #4d6bfe); }
.pm-field { display: flex; flex-direction: column; gap: 6px; margin: 12px 0; }
.pm-field > label { font-weight: 500; }
.pm-input-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.pm-config input[type=text], .pm-config input[type=password], .pm-config select { min-width: 0; width: 100%; border: 1px solid var(--dsw-alias-border-l2, #d9dde5); border-radius: 8px; padding: 8px 10px; font: inherit; line-height: 1.5; background: var(--dsw-alias-bg-layer-1, Canvas); color: inherit; caret-color: var(--dsw-alias-brand-primary, #4d6bfe); }
.pm-config input::placeholder { color: var(--dsw-alias-label-secondary, #555f70); }
.pm-config input[type=checkbox] { margin: 0; }
.pm-config small { color: var(--dsw-alias-label-secondary, #555f70); font-size: 12px; }
.pm-button { flex-shrink: 0; border: 1px solid var(--dsw-alias-border-l2, #d9dde5); padding: 7px 12px; border-radius: 8px; font: inherit; line-height: 1.5; color: inherit; background: var(--dsw-alias-bg-layer-1, Canvas); cursor: pointer; }
.pm-button:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-4, #e4e7ed); }
.pm-button:active:not(:disabled) { transform: translateY(1px); }
.pm-button-primary { border-color: transparent; background: var(--dsw-alias-button-primary-fill, #4d6bfe); color: var(--dsw-alias-label-primary-foreground, white); }
.pm-button-primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover, #3d58d0); }
.pm-button:disabled { opacity: .5; cursor: default; }
.pm-error { color: var(--dsw-alias-state-error-primary, #b42318); margin: 8px 0; }
.pm-success { color: var(--dsw-alias-label-primary, CanvasText); margin: 8px 0; }
.pm-form-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 14px; }
.pm-divider { border-top: 1px solid var(--dsw-alias-border-l2, #d9dde5); padding-top: 18px !important; margin-top: 24px !important; }
.pm-activation { padding: 14px 0; font-size: 13px; line-height: 1.6; }
.pm-activation .pm-form-actions { margin-top: 0; }
.pm-card button:focus-visible, .pm-config button:focus-visible, .pm-config input:focus-visible, .pm-config select:focus-visible, .pm-activation button:focus-visible { outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary, #4d6bfe)); outline-offset: 2px; }
.pm-card ::selection, .pm-config ::selection { background: color-mix(in srgb, var(--dsw-alias-brand-primary, #4d6bfe) 25%, transparent); }
@media (prefers-reduced-motion: reduce) { .pm-progress-fill { transition: none; } .pm-button:active:not(:disabled) { transform: none; } }
@media (max-width: 420px) { .pm-config .pm-input-row { flex-wrap: wrap; } .pm-config .pm-input-row > input { flex-basis: 100%; } }
`;

// src/client/summary.ts
function decodeSummary(value) {
  if (!value || typeof value !== "object") throw new Error("\u79EF\u5206\u6570\u636E\u683C\u5F0F\u5F02\u5E38\uFF0C\u8BF7\u91CD\u8BD5\u6216\u68C0\u67E5\u8D26\u672C\u3002");
  const data = value;
  if (data.status === "error" && typeof data.message === "string") {
    return { status: "error", message: data.message };
  }
  if (data.status === "unconfigured") {
    return {
      status: "unconfigured",
      ...typeof data.defaultDataDir === "string" ? { defaultDataDir: data.defaultDataDir } : {},
      ...typeof data.timeZone === "string" ? { timeZone: data.timeZone } : {},
      ...typeof data.message === "string" ? { message: data.message } : {}
    };
  }
  const integers = ["balance", "totalExp", "level", "expInLevel", "expRequired", "expToNext", "todayEarned"];
  const strings = ["day", "timeZone", "updatedAt"];
  if (data.status !== "ready" || !integers.every((key) => Number.isSafeInteger(data[key])) || !strings.every((key) => typeof data[key] === "string" && data[key].length > 0) || typeof data.progress !== "number" || !Number.isFinite(data.progress) || data.progress < 0 || data.progress > 1 || data.level < 1 || data.totalExp < 0 || data.expInLevel < 0 || data.expRequired <= 0 || data.expToNext < 0 || data.expInLevel >= data.expRequired || data.expRequired - data.expInLevel !== data.expToNext || Math.abs(data.progress - data.expInLevel / data.expRequired) > 1e-9) {
    throw new Error("\u79EF\u5206\u6570\u636E\u683C\u5F0F\u5F02\u5E38\uFF0C\u8BF7\u91CD\u8BD5\u6216\u68C0\u67E5\u8D26\u672C\u3002");
  }
  return data;
}
var SummaryStore = class {
  snapshot = { status: "loading" };
  listeners = /* @__PURE__ */ new Set();
  timer;
  wakeTimer;
  controller;
  inFlight;
  started = false;
  disposed = false;
  refreshPending = false;
  requestGeneration = 0;
  options;
  document;
  updates;
  updatesController;
  updatesStream;
  retryTimer;
  updateGeneration = 0;
  updateAttempt = 0;
  lastRevision;
  baselineRead;
  baselineTimer;
  constructor(options = {}) {
    this.options = { url: "api/points-mall/summary", intervalMs: 3e4, timeoutMs: 8e3, baselineWaitMs: 200, ...options };
    this.document = options.document ?? (typeof document === "undefined" ? void 0 : document);
    this.updates = options.updates;
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  start() {
    if (this.started || this.disposed) return;
    this.started = true;
    this.document?.addEventListener("visibilitychange", this.onVisibilityChange);
    this.document?.defaultView?.addEventListener("focus", this.wake);
    this.readAfterBaseline();
  }
  refresh = () => {
    if (this.disposed || !this.isVisible()) return Promise.resolve();
    if (this.inFlight) {
      this.refreshPending = true;
      return this.inFlight;
    }
    clearTimeout(this.timer);
    clearTimeout(this.wakeTimer);
    this.wakeTimer = void 0;
    const controller = new AbortController();
    this.controller = controller;
    const generation = ++this.requestGeneration;
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    const request = async () => {
      try {
        const response = await fetch(this.options.url, { signal: controller.signal, cache: "no-store" });
        const summary = decodeSummary(await readJsonResponse(response));
        if (!this.disposed && generation === this.requestGeneration) this.publish(summary);
      } catch (error) {
        if (!this.disposed && generation === this.requestGeneration) {
          this.publish({ status: "error", message: error instanceof Error && error.name !== "AbortError" ? error.message : "\u8BFB\u53D6\u79EF\u5206\u8D85\u65F6\uFF0C\u8BF7\u91CD\u8BD5\u3002" });
        }
      } finally {
        clearTimeout(timeout);
        this.controller = void 0;
        this.inFlight = void 0;
        if (!this.disposed && this.started && this.isVisible()) {
          const delay = this.refreshPending ? 0 : this.options.intervalMs;
          this.refreshPending = false;
          this.timer = setTimeout(() => {
            void this.refresh();
          }, delay);
        }
      }
    };
    this.inFlight = request();
    return this.inFlight;
  };
  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    clearTimeout(this.wakeTimer);
    this.document?.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.document?.defaultView?.removeEventListener("focus", this.wake);
    this.controller?.abort();
    this.closeUpdates();
    this.listeners.clear();
  }
  /** A new native connection invalidates both the stream and its read baseline. */
  reconnectUpdates = () => {
    if (this.disposed) return;
    this.closeUpdates();
    this.updateAttempt = 0;
    this.readAfterBaseline();
  };
  isVisible() {
    return this.document?.hidden !== true;
  }
  onVisibilityChange = () => {
    if (this.isVisible()) {
      if (this.updates && !this.updatesController) this.readAfterBaseline();
      else this.wake();
      return;
    }
    clearTimeout(this.timer);
    clearTimeout(this.wakeTimer);
    this.wakeTimer = void 0;
    this.refreshPending = false;
    this.requestGeneration++;
    this.controller?.abort();
    this.closeUpdates();
  };
  /** Visibility and focus commonly arrive together; share one refresh. */
  wake = () => {
    if (this.disposed || !this.isVisible() || this.wakeTimer !== void 0) return;
    if (this.baselineTimer !== void 0) return;
    if (this.inFlight && !this.controller?.signal.aborted) return;
    this.wakeTimer = setTimeout(() => {
      this.wakeTimer = void 0;
      void this.refresh();
    }, 0);
  };
  /** Wait briefly for the registered stream's baseline; a slow carrier never blocks the card. */
  readAfterBaseline() {
    if (this.disposed || !this.isVisible()) return;
    if (!this.updates) {
      void this.refresh();
      return;
    }
    clearTimeout(this.wakeTimer);
    this.wakeTimer = void 0;
    this.clearBaselineRead();
    const plan = { generation: this.updateGeneration + 1 };
    this.baselineRead = plan;
    this.baselineTimer = setTimeout(() => {
      this.baselineTimer = void 0;
      if (this.baselineRead === plan) void this.refresh();
    }, this.options.baselineWaitMs);
    this.openUpdates();
  }
  clearBaselineRead() {
    clearTimeout(this.baselineTimer);
    this.baselineTimer = void 0;
    this.baselineRead = void 0;
  }
  openUpdates() {
    if (!this.updates || this.disposed || !this.started || !this.isVisible() || this.updatesController) return;
    clearTimeout(this.retryTimer);
    const controller = new AbortController();
    const generation = ++this.updateGeneration;
    this.updatesController = controller;
    void (async () => {
      let opening = true;
      try {
        const stream = this.updates(controller.signal);
        this.updatesStream = stream;
        for await (const frame of stream) {
          if (controller.signal.aborted || generation !== this.updateGeneration || this.disposed) break;
          if (!Number.isSafeInteger(frame?.revision) || frame.revision < 0) throw new Error("Invalid update revision");
          const previous = this.lastRevision;
          this.lastRevision = frame.revision;
          const isBaseline = opening;
          opening = false;
          if (isBaseline) {
            if (this.baselineRead?.generation === generation) this.clearBaselineRead();
            void this.refresh();
          } else if (previous !== frame.revision) {
            this.updateAttempt = 0;
            void this.refresh();
          }
        }
      } catch {
      } finally {
        if (generation !== this.updateGeneration) return;
        this.updatesController = void 0;
        this.updatesStream = void 0;
        if (this.disposed || !this.started || !this.isVisible()) return;
        if (this.baselineRead?.generation === generation) {
          this.clearBaselineRead();
          void this.refresh();
        }
        const delay = Math.min(1e3 * 2 ** Math.min(this.updateAttempt++, 5), 3e4);
        this.retryTimer = setTimeout(() => {
          this.openUpdates();
        }, delay);
      }
    })();
  }
  closeUpdates() {
    clearTimeout(this.retryTimer);
    this.clearBaselineRead();
    this.updateGeneration++;
    this.updatesController?.abort();
    this.updatesStream?.dispose?.();
    this.updatesController = void 0;
    this.updatesStream = void 0;
  }
  publish(snapshot) {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
};

// src/client/index.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var name = "points-mall-client";
var inject = ["slots", "configForms", "pluginNavigation", "remote"];
var PACKAGE_NAME = "dsh-points-mall";
var UPDATES_REMOTE = {
  package: PACKAGE_NAME,
  descriptors: [{
    id: "dsh-points-mall#pointsMallUpdates/watch",
    service: "pointsMallUpdates",
    namespace: "pointsMallUpdates",
    method: "watch",
    mode: "stream",
    invocation: { kind: "direct" },
    parameters: [],
    cancellation: { parameter: "signal" },
    result: { mode: "src-json" }
  }]
};
function CardBinding({ summary, configure }) {
  const snapshot = (0, import_react2.useSyncExternalStore)(summary.subscribe, summary.getSnapshot, summary.getSnapshot);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(PointsCard, { snapshot, onConfigure: configure, onRetry: () => {
    void summary.refresh();
  } });
}
function apply(ctx) {
  let watchUpdates;
  const summary = new SummaryStore({ updates: (signal) => {
    if (!watchUpdates) throw new Error("Points update namespace is unavailable");
    return watchUpdates(signal);
  } });
  const form = ctx.configForms.get("points-mall");
  ctx.effect(async () => {
    let disposeRemote;
    let disposeNamespace;
    try {
      disposeRemote = await ctx.remote.$mount(UPDATES_REMOTE);
      const namespace = ctx.inject(["remote.pointsMallUpdates"], (boundCtx) => {
        watchUpdates = (signal) => boundCtx.remote.pointsMallUpdates.watch(signal);
        return () => {
          watchUpdates = void 0;
        };
      });
      disposeNamespace = namespace.dispose;
      await namespace;
    } catch {
    }
    summary.start();
    const unsubscribe = form.subscribe(() => {
      void summary.refresh();
    });
    const unsubscribeReset = ctx.on("connection/reset", summary.reconnectUpdates);
    return async () => {
      unsubscribe();
      unsubscribeReset();
      summary.dispose();
      await disposeNamespace?.();
      await disposeRemote?.();
    };
  }, "points-mall: summary polling");
  ctx.effect(() => {
    if (document.getElementById("dsh-points-mall-styles")) return () => {
    };
    const style = document.createElement("style");
    style.id = "dsh-points-mall-styles";
    style.textContent = STYLES;
    document.head.append(style);
    return () => {
      style.remove();
    };
  }, "points-mall: native styles");
  ctx.effect(() => mountCardContainer(document, (container) => {
    const root = (0, import_client.createRoot)(container);
    root.render((0, import_react2.createElement)(CardBinding, { summary, configure: () => ctx.pluginNavigation.openBundle(PACKAGE_NAME) }));
    return () => {
      root.unmount();
    };
  }), "points-mall: sidebar card");
  ctx.slots.inject("plugins.bundle.activation", () => ctx.slots.register({
    name: "plugins.bundle.activation",
    key: PACKAGE_NAME
  }, Activation));
  ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
    name: "plugins.bundle.config",
    key: PACKAGE_NAME,
    inject: () => ({ form, summary })
  }, Configuration));
}

return module.exports;}});
