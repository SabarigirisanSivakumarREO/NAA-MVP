/**
 * SubstrateExtension.script — page-evaluate string payload for T1B-000.
 *
 * Why this file exists: ContextAssembler's `page.evaluate()` runs in the
 * Playwright sandbox where TypeScript type imports + ESM `.js` imports are
 * not resolvable. Phase 1 ships this same pattern via READ_METADATA_SCRIPT
 * in ContextAssembler.ts — a self-contained IIFE string passed to
 * `page.evaluate(SCRIPT)`. This file mirrors that pattern for the larger
 * T1B-000 substrate extraction.
 *
 * The source of truth for the extraction logic is
 * `./SubstrateExtension.ts` (pure function, jsdom-unit-testable). This
 * script string is a parallel implementation kept byte-identical in spirit
 * — if you change the .ts module, mirror the change here.
 *
 * R10: file ≤ 300 lines (R10.1); functions ≤ 50 lines inside the script
 * payload itself (R10.2); named export (R10.3).
 * R14: no logging from inside the page sandbox.
 * R20: substrate fields land at top-level / inside `metadata` of the
 * returned object; never under `_extensions.*`.
 */

import type { SubstrateResult } from './SubstrateExtension.js';

export type { SubstrateResult };

/**
 * Self-contained IIFE — receives `viewport` injected via
 * `page.evaluate(SCRIPT, viewport)` and returns a SubstrateResult-shaped
 * plain object. Pure JS — no type annotations, no module imports.
 *
 * NN-LL1 BINDING — primaryActions heuristic mirrored from
 * SubstrateExtension.ts: submit-button → canonical-CTA-text → prominent
 * (≥ 100 × 40 px) → null.
 */
export const SUBSTRATE_EXTRACTION_SCRIPT = `(function (viewport) {
  var PRIMARY_ACTION_TEXT_PATTERN = /add to (cart|bag|basket)|buy now|sign up|get started|subscribe|book now/i;
  var MIN_PROMINENT_CTA_WIDTH_PX = 100;
  var MIN_PROMINENT_CTA_HEIGHT_PX = 40;

  function readVisibleText(el) {
    var raw = el.innerText !== undefined ? el.innerText : (el.textContent || '');
    return String(raw).trim().replace(/\\s+/g, ' ');
  }

  function buildSelector(el) {
    if (el.id) {
      try { return '#' + CSS.escape(el.id); }
      catch (e) { return '#' + el.id; }
    }
    var tag = el.tagName.toLowerCase();
    var name = el.getAttribute && el.getAttribute('name');
    if (name) {
      try { return tag + '[name="' + CSS.escape(name) + '"]'; }
      catch (e) { return tag + '[name="' + name + '"]'; }
    }
    var parent = el.parentElement;
    if (!parent) return tag;
    var siblings = [];
    for (var i = 0; i < parent.children.length; i++) {
      if (parent.children[i].tagName === el.tagName) siblings.push(parent.children[i]);
    }
    if (siblings.length === 1) return tag;
    return tag + ':nth-of-type(' + (siblings.indexOf(el) + 1) + ')';
  }

  function isInViewport(el, vp) {
    var r = el.getBoundingClientRect();
    return r.bottom > 0 && r.right > 0 && r.top < vp.height && r.left < vp.width;
  }

  function makeCta(el, index) {
    var r = el.getBoundingClientRect();
    var role = el.getAttribute('role');
    var cta = {
      index: index,
      text: readVisibleText(el),
      selector: buildSelector(el),
      sizePx: { width: r.width, height: r.height }
    };
    if (role) cta.role = role;
    return cta;
  }

  function collectCtas() {
    var sel = 'button, [role="button"], a[role="button"], input[type="submit"], input[type="button"]';
    var nodes = Array.prototype.slice.call(document.querySelectorAll(sel));
    return nodes.map(function (el, i) { return makeCta(el, i); });
  }

  function classifyFormField(el) {
    var tag = el.tagName.toLowerCase();
    if (tag === 'select') return 'select';
    if (tag === 'textarea') return 'textarea';
    if (tag === 'input') {
      var t = (el.getAttribute('type') || 'text').toLowerCase();
      if (t === 'text' || t === 'email' || t === 'password' || t === 'tel') return t;
      if (t === 'checkbox') return 'checkbox';
      if (t === 'radio') return 'radio';
      return 'other';
    }
    return 'other';
  }

  function collectFormFields() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll('input, select, textarea'));
    return nodes.map(function (el) {
      return {
        selector: buildSelector(el),
        type: classifyFormField(el),
        required: el.hasAttribute('required')
      };
    });
  }

  function collectSchemaOrg() {
    var scripts = Array.prototype.slice.call(document.querySelectorAll('script[type="application/ld+json"]'));
    var out = [];
    for (var i = 0; i < scripts.length; i++) {
      var raw = scripts[i].textContent;
      if (!raw) continue;
      try {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (var j = 0; j < parsed.length; j++) {
            if (parsed[j] && typeof parsed[j] === 'object') out.push(parsed[j]);
          }
        } else if (parsed && typeof parsed === 'object') {
          out.push(parsed);
        }
      } catch (e) {
        // Silently skip malformed JSON-LD blocks per spec R-00.
      }
    }
    return out;
  }

  function collectOgTags() {
    var metas = Array.prototype.slice.call(document.querySelectorAll('meta[property^="og:"]'));
    var out = {};
    for (var i = 0; i < metas.length; i++) {
      var prop = metas[i].getAttribute('property');
      var content = metas[i].getAttribute('content');
      if (prop && content !== null) out[prop] = content;
    }
    return out;
  }

  function collectHeadings() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var lvl = parseInt(nodes[i].tagName.substring(1), 10);
      if (lvl < 1 || lvl > 6) continue;
      out.push({ level: lvl, text: readVisibleText(nodes[i]), selector: buildSelector(nodes[i]) });
    }
    return out;
  }

  function detectPrimaryActions(vp) {
    var btns = Array.prototype.slice.call(document.querySelectorAll('button, input[type="submit"]'));
    var inView = btns.filter(function (el) { return isInViewport(el, vp); });

    var submitBtn = inView.find(function (el) {
      return (el.getAttribute('type') || '').toLowerCase() === 'submit';
    });
    if (submitBtn) return { selector: buildSelector(submitBtn), text: readVisibleText(submitBtn) };

    var canonical = inView.find(function (el) { return PRIMARY_ACTION_TEXT_PATTERN.test(readVisibleText(el)); });
    if (canonical) return { selector: buildSelector(canonical), text: readVisibleText(canonical) };

    var prominent = inView.find(function (el) {
      var r = el.getBoundingClientRect();
      return r.width >= MIN_PROMINENT_CTA_WIDTH_PX && r.height >= MIN_PROMINENT_CTA_HEIGHT_PX;
    });
    if (prominent) return { selector: buildSelector(prominent), text: readVisibleText(prominent) };

    return null;
  }

  return {
    ctas: collectCtas(),
    formFields: collectFormFields(),
    schemaOrg: collectSchemaOrg(),
    ogTags: collectOgTags(),
    headings: collectHeadings(),
    primaryActions: detectPrimaryActions(viewport)
  };
})`;

/** Safe-default substrate result — used if page.evaluate() fails. */
export function emptySubstrate(): SubstrateResult {
  return {
    ctas: [],
    formFields: [],
    schemaOrg: [],
    ogTags: {},
    headings: [],
    primaryActions: null,
  };
}
