# Section 8 — Unified Tool Manifest (28 Tools)

> **Source of truth:** `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` Section 6 (23 browse tools) + `docs/specs/AI_Analysis_Agent_Architecture_v1.0.md` Section 5 (5 analysis tools)

---

## 8.1 Complete Tool Registry

**REQ-TOOL-001:** All 28 tools SHALL be exposed via Model Context Protocol (MCP). The single MCP server hosts both browse and analyze tools; orchestrator restricts availability per mode.

| # | Tool Name | Category | Description | Safety Class | Mode | Origin |
|---|-----------|----------|-------------|--------------|------|--------|
| | **Navigation (4)** | | | | | |
| 1 | `browser_navigate` | Navigation | Navigate to absolute URL. First action on any task or domain change. | safe | browse | v2.0 |
| 2 | `browser_go_back` | Navigation | Go back in browser history | safe | browse | v2.0 |
| 3 | `browser_go_forward` | Navigation | Go forward in browser history | safe | browse | v2.0 |
| 4 | `browser_reload` | Navigation | Hard reload when content appears stale or page is stuck | safe | browse | v2.0 |
| | **Perception (3)** | | | | | |
| 5 | `browser_get_state` | Perception | Returns Page State Model (AX-tree + filtered DOM). Always call first on a new page. | safe | both | v2.0 |
| 6 | `browser_screenshot` | Perception | Compressed JPEG screenshot (quality configurable, max 1280px) | safe | both | v2.0 |
| 7 | `browser_get_metadata` | Perception | Return title, canonical URL, meta description, og tags, schema.org data | safe | both | v2.0 |
| | **Interaction (8)** | | | | | |
| 8 | `browser_click` | Interaction | Click element by AX-tree ref. Uses ghost-cursor Bezier path. | caution | browse | v2.0 |
| 9 | `browser_click_coords` | Interaction | Click at (x,y) coordinates — **Mode C only**, bypasses semantic layer | caution | browse (Mode C) | v2.0 |
| 10 | `browser_type` | Interaction | Type text character-by-character with Gaussian delays and typo simulation | caution | browse | v2.0 |
| 11 | `browser_scroll` | Interaction | Human-like variable-momentum scroll (up/down/to element). Triggers lazy-load. | safe | browse | v2.0 |
| 12 | `browser_select` | Interaction | Select from `<select>` dropdown by value, label, or index | caution | browse | v3.1 |
| 13 | `browser_hover` | Interaction | Hover to reveal menus, tooltips, dropdowns | safe | browse | v3.1 |
| 14 | `browser_press_key` | Interaction | Press keyboard key or shortcut (Enter, Esc, Tab, Ctrl+A, etc.) | caution | browse | v3.1 |
| 15 | `browser_upload` | Interaction | Upload file to file input element | sensitive | browse | v3.1 |
| | **Tab Management (1)** | | | | | |
| 16 | `browser_tab_manage` | Tab Mgmt | Open new tab, switch tab, close tab | caution | browse | v2.0 |
| | **Data (2)** | | | | | |
| 17 | `browser_extract` | Data | Extract structured data per schema (with confidence + missing fields + merge support) | safe | browse | v2.0 + v3.1 fix |
| 18 | `browser_download` | Data | Download file from URL or link — **requires explicit user approval** | sensitive | browse | v2.0 |
| | **Discovery (2)** | | | | | |
| 19 | `browser_find_by_text` | Discovery | Locate element by visible text (fuzzy match). Returns first match ref. | safe | browse | v2.0 |
| 20 | `browser_get_network` | Discovery | Return recent XHR/fetch requests. Detect form submission success or API failures. | safe | browse | v2.0 |
| | **Control (2)** | | | | | |
| 21 | `browser_wait_for` | Control | Wait for condition (selector appears, URL change, network idle) | safe | both | v2.0 |
| 22 | `agent_complete` | Control | Signal task completion with summary | safe | browse | v3.0 |
| | **HITL (1)** | | | | | |
| 23 | `agent_request_human` | HITL | LLM-triggered `interrupt()` — proactively request human input mid-task | caution | browse | v2.0 |
| | **Restricted (1)** | | | | | |
| | `browser_evaluate` | **RESTRICTED** | Execute sandboxed JS (see 8.4) | blocked/caution | browse | v2.0 |
| | **Analysis (5 — new)** | | | | | |
| 24 | `page_get_element_info` | Analysis | Get bounding box, computed styles, isAboveFold for an element | safe | analyze | v1.0 |
| 25 | `page_get_performance` | Analysis | Get DOMContentLoaded, fullyLoaded, resource count, transfer size, LCP | safe | analyze | v1.0 |
| 26 | `page_screenshot_full` | Analysis | Full-page scrollable screenshot (entire page, not just viewport) | safe | analyze | v1.0 |
| 27 | `page_annotate_screenshot` | Analysis | Overlay finding pins on a screenshot using Sharp | safe | analyze | v1.0 |
| 28 | `page_analyze` | Analysis | Single comprehensive page scan returning AnalyzePerception in one call | safe | analyze | v1.0 |

**Note:** `browser_evaluate` is the 24th browse tool but listed last because of its restricted status. Total: 23 browse tools (including evaluate) + 5 analysis tools = **28 tools**.

---

## 8.2 Mode Availability Matrix

| Tool | Browse | Analyze | Mode A | Mode B | Mode C |
|------|:------:|:-------:|:------:|:------:|:------:|
| browser_navigate | ✅ | — | ✅ | ✅ | ✅ |
| browser_go_back | ✅ | — | ✅ | ✅ | ✅ |
| browser_go_forward | ✅ | — | ✅ | ✅ | ✅ |
| browser_reload | ✅ | — | ✅ | ✅ | ✅ |
| browser_get_state | ✅ | ✅ | — | ✅ | — |
| browser_screenshot | ✅ | ✅ | — | ✅ | ✅ |
| browser_get_metadata | ✅ | ✅ | — | ✅ | — |
| browser_click | ✅ | — | ✅ | ✅ | — |
| browser_click_coords | ✅ | — | — | — | ✅ |
| browser_type | ✅ | — | ✅ | ✅ | ✅ |
| browser_scroll | ✅ | — | ✅ | ✅ | ✅ |
| browser_select | ✅ | — | ✅ | ✅ | — |
| browser_hover | ✅ | — | ✅ | ✅ | — |
| browser_press_key | ✅ | — | ✅ | ✅ | ✅ |
| browser_upload | ✅ | — | ✅ | ✅ | — |
| browser_tab_manage | ✅ | — | ✅ | ✅ | ✅ |
| browser_extract | ✅ | — | ✅ | ✅ | — |
| browser_download | ✅ | — | ✅ | ✅ | — |
| browser_find_by_text | ✅ | — | ✅ | ✅ | — |
| browser_get_network | ✅ | — | ✅ | ✅ | — |
| browser_wait_for | ✅ | ✅ | ✅ | ✅ | ✅ |
| agent_complete | ✅ | — | ✅ | ✅ | ✅ |
| agent_request_human | ✅ | — | ✅ | ✅ | ✅ |
| browser_evaluate | ✅ | — | — | ✅* | — |
| page_get_element_info | — | ✅ | — | — | — |
| page_get_performance | — | ✅ | — | — | — |
| page_screenshot_full | — | ✅ | — | — | — |
| page_annotate_screenshot | — | ✅ | — | — | — |
| page_analyze | — | ✅ | — | — | — |

*`browser_evaluate` requires explicit allowlist; blocked on untrusted domains.

---

## 8.3 TypeScript Interfaces (Browse Tools)

```typescript
export interface BrowserMCPServer {
  // Navigation (4)
  browser_navigate(params: { url: string }): Promise<{ success: boolean; finalUrl: string }>;
  browser_go_back(): Promise<{ success: boolean; url: string }>;
  browser_go_forward(): Promise<{ success: boolean; url: string }>;
  browser_reload(params: { waitUntil?: "load" | "domcontentloaded" | "networkidle" }): Promise<{ success: boolean }>;

  // Perception (3)
  browser_get_state(params: { includeScreenshot?: boolean }): Promise<PageStateModel>;
  browser_screenshot(params: { quality?: number }): Promise<{ imageBase64: string }>;
  browser_get_metadata(): Promise<{
    title: string;
    canonicalUrl: string;
    metaDescription: string;
    ogTags: Record<string, string>;
    schemaOrg: Record<string, any>[];
    lang: string;
  }>;

  // Interaction (8)
  browser_click(params: { elementRef: string }): Promise<{ success: boolean }>;
  browser_click_coords(params: { x: number; y: number }): Promise<{ success: boolean }>;
  browser_type(params: { elementRef: string; text: string; clearFirst?: boolean }): Promise<{ success: boolean }>;
  browser_scroll(params: { direction: "up" | "down"; elementRef?: string; amount?: number }): Promise<{ success: boolean }>;
  browser_select(params: { elementRef: string; value: string }): Promise<{ success: boolean }>;
  browser_hover(params: { elementRef: string }): Promise<{ success: boolean }>;
  browser_press_key(params: { key: string; modifiers?: string[] }): Promise<{ success: boolean }>;
  browser_upload(params: { elementRef: string; filePath: string }): Promise<{ success: boolean }>;

  // Tab Management (1)
  browser_tab_manage(params: {
    action: "new" | "switch" | "close";
    tabId?: string;
    url?: string;
  }): Promise<{ success: boolean; tabId: string; tabCount: number }>;

  // Data (2)
  browser_extract(params: {
    schema: object;
    selectors?: Record<string, string>;
    strategy?: "dom" | "llm_vision" | "auto";
    merge_key?: string;
  }): Promise<{
    data: any[];
    confidence: number;
    missing_fields: string[];
    source: "dom" | "llm_vision";
  }>;
  browser_download(params: {
    url?: string;
    elementRef?: string;
    savePath?: string;
  }): Promise<{
    success: boolean;
    filePath: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }>;

  // Discovery (2)
  browser_find_by_text(params: {
    text: string;
    exact?: boolean;
    elementType?: string;
  }): Promise<{
    found: boolean;
    elementRef: string | null;
    selector: string | null;
    matchedText: string;
  }>;
  browser_get_network(params: {
    urlPattern?: string;
    method?: string;
    statusCode?: number;
    limit?: number;
  }): Promise<{
    requests: Array<{
      url: string;
      method: string;
      statusCode: number;
      contentType: string;
      responseSize: number;
      timestamp: number;
    }>;
  }>;

  // Control (2)
  browser_wait_for(params: { condition: string; timeout?: number }): Promise<{ success: boolean }>;
  agent_complete(params: { success: boolean; summary: string }): Promise<{ recorded: boolean }>;

  // HITL (1)
  agent_request_human(params: {
    reason: string;
    question?: string;
    options?: string[];
    includeScreenshot?: boolean;
  }): Promise<{
    response: string;
    selectedOption?: string;
  }>;

  // Restricted (1)
  browser_evaluate(params: { script: string }): Promise<{ result: any }>;
}
```

---

## 8.4 TypeScript Interfaces (Analysis Tools)

```typescript
export interface AnalysisMCPServer {
  // Tool 24: Get element bounding box, position, computed styles
  page_get_element_info(params: {
    selector: string;
    properties?: string[];
  }): Promise<{
    boundingBox: { x: number; y: number; width: number; height: number };
    isAboveFold: boolean;
    computedStyles: Record<string, string>;
    contrastRatio?: number;
  }>;

  // Tool 25: Get page performance metrics
  page_get_performance(): Promise<{
    domContentLoaded: number;
    fullyLoaded: number;
    resourceCount: number;
    totalTransferSize: number;
    largestContentfulPaint?: number;
  }>;

  // Tool 26: Full-page scrollable screenshot
  page_screenshot_full(params: {
    quality?: number;       // 1-100, default 80
    maxHeight?: number;     // pixels, default 15000
  }): Promise<{
    imageBase64: string;
    width: number;
    height: number;
  }>;

  // Tool 27: Annotate screenshot with finding pins
  page_annotate_screenshot(params: {
    screenshotBase64: string;
    annotations: Array<{
      id: string;
      type: "pin" | "box" | "arrow";
      position: { x: number; y: number };
      dimensions?: { width: number; height: number };
      label: string;
      severity: "critical" | "high" | "medium" | "low";
      color?: string;
    }>;
  }): Promise<{
    annotatedImageBase64: string;
  }>;

  // Tool 28: Comprehensive page scan
  page_analyze(params: {
    sections: Array<
      "structure" | "content" | "ctas" | "forms" |
      "trust" | "layout" | "images" | "navigation" | "performance"
    >;
  }): Promise<AnalyzePerception>;
}
```

---

## 8.5 JS Sandbox Specification

**REQ-MCP-SANDBOX-001:** `browser_evaluate` SHALL run in isolated execution context.

**REQ-MCP-SANDBOX-002:** The sandbox SHALL NOT have access to:
- `document.cookie`
- `localStorage` / `sessionStorage`
- `fetch` / `XMLHttpRequest` (no network)
- `window.open` / `window.location` (no navigation)

**REQ-MCP-SANDBOX-003:** `browser_evaluate` SHALL be `blocked` on untrusted domains, `caution` on trusted domains with audit logging.

---

## 8.6 `page_analyze` Implementation Detail

**REQ-TOOL-PA-001:** `page_analyze` SHALL execute a SINGLE Playwright `page.evaluate()` call that collects all requested sections in one DOM traversal. It SHALL NOT make multiple `evaluate()` calls.

```typescript
// Pseudocode for the injected script
async function pageAnalyze(page: Page, sections: string[]): Promise<AnalyzePerception> {
  return await page.evaluate((requestedSections) => {
    const result: any = {
      metadata: {
        url: location.href,
        title: document.title,
        timestamp: Date.now(),
        viewport: { width: window.innerWidth, height: window.innerHeight }
      }
    };

    if (requestedSections.includes("structure")) {
      result.headingHierarchy = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map(h => ({
        level: parseInt(h.tagName[1]),
        text: h.textContent!.trim().substring(0, 100),
        isAboveFold: h.getBoundingClientRect().top < window.innerHeight,
      }));
      result.landmarks = Array.from(document.querySelectorAll("[role], main, nav, footer, aside, header")).map(el => ({
        role: el.getAttribute("role") || el.tagName.toLowerCase(),
        label: el.getAttribute("aria-label") || "",
      }));
      result.semanticHTML = {
        hasMain: !!document.querySelector("main"),
        hasNav: !!document.querySelector("nav"),
        hasFooter: !!document.querySelector("footer"),
        formCount: document.querySelectorAll("form").length,
        tableCount: document.querySelectorAll("table").length,
      };
    }

    if (requestedSections.includes("ctas")) {
      result.ctas = Array.from(document.querySelectorAll(
        "a[href], button, [role='button'], input[type='submit']"
      ))
        .filter(el => {
          const rect = el.getBoundingClientRect();
          const styles = window.getComputedStyle(el);
          return rect.width > 40 && rect.height > 20
            && styles.display !== "none"
            && styles.visibility !== "hidden";
        })
        .slice(0, 20)
        .map(el => {
          const rect = el.getBoundingClientRect();
          const styles = window.getComputedStyle(el);
          return {
            text: el.textContent!.trim().substring(0, 80),
            type: classifyCTAType(el, styles),
            isAboveFold: rect.top < window.innerHeight,
            boundingBox: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            },
            computedStyles: {
              backgroundColor: styles.backgroundColor,
              color: styles.color,
              fontSize: styles.fontSize,
              padding: styles.padding,
              contrastRatio: calculateContrastRatio(styles.color, styles.backgroundColor),
            },
            surroundingContext: getSurroundingText(el, 50),
          };
        });
    }

    // ... similar single-pass collection for forms, trust, layout, images, navigation, performance ...

    return result;
  }, sections);
}
```

---

## 8.7 Deferred Tools (Not in v1.0)

| Tool | Reason for Deferral |
|------|-------------------|
| `memory_save` / `memory_recall` | Memory handled internally by `load_memory` node. LLM doesn't need explicit memory tools for MVP. |
| `browser_set_cookie` | Security risk too high. Auth/session cookies should be injected via HITL or pre-configured browser profiles, not LLM-controlled. |
| `browser_drag_drop` | Rare interaction pattern. Can be approximated with `browser_click_coords` + mouse events if needed. |
| `browser_record_workflow` | Record actions as Mode A workflow recipe. Deferred until Phase 6 (Memory & Replay) of browser agent. |
