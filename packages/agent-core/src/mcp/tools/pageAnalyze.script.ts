/**
 * T048 page_analyze — in-page extraction script.
 *
 * Source: docs/specs/final-architecture/07-analyze-mode.md §7.9 + §7.9.1
 *   (CANONICAL VERBATIM AUTHORITY for the AnalyzePerception shape).
 *
 * Sibling of `pageAnalyze.ts` (factory + handler). This file holds ONLY the
 * single string constant passed to `page.evaluate`, split out per R10.1
 * ≤300-LOC cap on the factory file. The split mirrors the Wave 9b
 * BrowserManager → BrowserPageWrapper precedent.
 *
 * The script is a plain string (NOT executed at module load) — there is NO
 * `page.evaluate(` call in this file's source; it is the ARGUMENT to the
 * single `page.evaluate` call in `pageAnalyze.ts` (REQ-TOOL-PA-001).
 *
 * R10.1: file ≤500 LOC (script body is verbatim §7.9 surface; cannot be
 * meaningfully shrunk without dropping enrichment categories).
 * R13: no `any` (no TypeScript types declared — the script is a string).
 *
 * Script semantics (parallels pageAnalyze.ts header):
 *   - F-S4: returned object literal OMITS `_extensions` (NOT undefined
 *     explicit, NOT {} — absent). Defense-in-depth asserted at AC-11.
 *   - F-S13: iframes[].purposeGuess is one of the Phase 1c IframePurpose
 *     9-value enum members. The hostname classifier mirrors
 *     IframePolicyEngine.ts pattern tables verbatim. `cross_origin` is the
 *     descent-safety decision (NOT an enum member); content-type label is
 *     still derived from hostname for cross-origin iframes.
 *   - Iframe order tier (CAPTCHA → CMP → PAYMENT_3DS → CHECKOUT → CHAT →
 *     VIDEO → ANALYTICS → SOCIAL_EMBED → other) matches Phase 1c
 *     plan.md §2.6 security-first order: a reCAPTCHA nested in a Stripe
 *     checkout flow MUST classify as `captcha` (not `checkout`).
 *   - Single evaluate: this string is the body of ONE invocation; no
 *     internal `fetch`, no nested `evaluate`, no network calls.
 */

/**
 * In-page extraction script. Pure DOM access (no fetch, no network). MUST be
 * passed to EXACTLY ONE page.evaluate invocation per REQ-TOOL-PA-001.
 *
 * Returns the AnalyzePerception shape per §7.9 + §7.9.1, MINUS the
 * `_extensions` key (F-S4 namespace contract).
 */
export const PAGE_ANALYZE_SCRIPT = `(() => {
  const vw = window.innerWidth || 1280;
  const vh = window.innerHeight || 800;
  const foldY = vh;

  // ── helpers ──────────────────────────────────────────────────────────
  function isAboveFold(rect) {
    return rect && rect.top < foldY && rect.bottom > 0;
  }
  function bbOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  }
  function txt(s, max) {
    const t = (s || '').replace(/\\s+/g, ' ').trim();
    return max && t.length > max ? t.slice(0, max) : t;
  }
  function tokenize(s) {
    return (s || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  }
  function jaccard(a, b) {
    if (a.length === 0 && b.length === 0) return 1;
    const sa = new Set(a); const sb = new Set(b);
    let inter = 0; sa.forEach(v => { if (sb.has(v)) inter++; });
    const union = new Set([...sa, ...sb]).size;
    return union === 0 ? 0 : inter / union;
  }
  function parseRgb(s) {
    if (!s) return null;
    const m = s.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const parts = m[1].split(',').map(p => parseFloat(p.trim()));
    if (parts.length < 3) return null;
    return [parts[0], parts[1], parts[2]];
  }
  function rl(rgb) {
    const f = c => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  }
  function contrast(fg, bg) {
    if (!fg || !bg) return 0;
    const l1 = rl(fg), l2 = rl(bg);
    const a = Math.max(l1, l2), b = Math.min(l1, l2);
    return (a + 0.05) / (b + 0.05);
  }

  // ── iframe purpose classifier (Phase 1c IframePolicyEngine mirror) ───
  const CAPTCHA_PATS = ['google.com/recaptcha','hcaptcha.com','cloudflare.com/turnstile','arkoselabs.com'];
  const CMP_PATS = ['cookielaw.org','cookiebot.com','trustarc.com','usercentrics.eu','consensu.org'];
  const PAY3DS_PATS = ['3dsecure.io','verifiedbyvisa.com','maestrocard.com','securecode.com'];
  const CHECKOUT_PATS = ['stripe.com','adyen.com','paypal.com','braintreepayments.com','razorpay.com','ccavenue.com'];
  const CHAT_PATS = ['intercom.io','crisp.chat','drift.com','zendesk.com','freshchat.com','tawk.to','olark.com'];
  const VIDEO_PATS = ['youtube.com/embed','youtube-nocookie.com','vimeo.com','wistia.com','brightcove.net'];
  const ANALYTICS_PATS = ['googletagmanager.com','google-analytics.com','doubleclick.net','bat.bing.com','linkedin.com/li/track'];
  const SOCIAL_PATS = ['twitter.com','instagram.com','tiktok.com','facebook.com','pinterest.com','linkedin.com/embed'];
  function matchAny(target, pats) { for (const p of pats) if (target.indexOf(p) !== -1) return true; return false; }
  function looksLikeIssuer3DS(t) {
    if (t.indexOf('3ds') === -1) return false;
    return t.indexOf('bank') !== -1 || t.indexOf('issuer') !== -1 || t.indexOf('acs') !== -1 || t.indexOf('challenge') !== -1;
  }
  function classifyIframePurpose(src) {
    let target = (src || '').toLowerCase();
    try { const u = new URL(src); target = (u.hostname + u.pathname).toLowerCase(); } catch (e) {}
    if (matchAny(target, CAPTCHA_PATS)) return 'captcha';
    if (matchAny(target, CMP_PATS)) return 'cmp';
    if (matchAny(target, PAY3DS_PATS) || looksLikeIssuer3DS(target)) return 'payment_3ds';
    if (matchAny(target, CHECKOUT_PATS)) return 'checkout';
    if (matchAny(target, CHAT_PATS)) return 'chat';
    if (matchAny(target, VIDEO_PATS)) return 'video';
    if (matchAny(target, ANALYTICS_PATS)) return 'analytics';
    if (matchAny(target, SOCIAL_PATS)) return 'social_embed';
    return 'other';
  }

  // ── pattern banks (urgency/scarcity + risk-reversal) ─────────────────
  const URGENCY_PATTERNS = [
    /limited[\\s-]+time/i,
    /only\\s+\\d+\\s+left/i,
    /ends?\\s+in\\s+\\d+[:h]\\d+/i,
    /\\d+\\s+viewing\\s+now/i,
    /hurry/i,
    /act\\s+now/i,
    /while\\s+supplies\\s+last/i,
    /sale\\s+ends/i
  ];
  const RISK_REVERSAL_PATTERNS = [
    /money[\\s-]+back/i,
    /free\\s+returns?/i,
    /\\d+[\\s-]*day\\s+guarantee/i,
    /no\\s+commitment/i,
    /satisfaction\\s+guaranteed/i,
    /risk[\\s-]+free/i,
    /cancel\\s+any\\s*time/i,
    /try\\s+(it|for)\\s+free/i
  ];

  // ── metadata ─────────────────────────────────────────────────────────
  const url = location.href;
  const title = document.title || '';
  const metaDescEl = document.querySelector('meta[name="description"]');
  const metaDescription = metaDescEl ? (metaDescEl.getAttribute('content') || null) : null;
  const canonicalEl = document.querySelector('link[rel="canonical"]');
  const canonical = canonicalEl ? (canonicalEl.getAttribute('href') || null) : null;
  const langAttr = document.documentElement.getAttribute('lang');
  const ogTags = {};
  document.querySelectorAll('meta[property^="og:"], meta[name^="og:"]').forEach(m => {
    const key = (m.getAttribute('property') || m.getAttribute('name') || '').replace(/^og:/, '');
    const val = m.getAttribute('content') || '';
    if (key && val) ogTags[key] = val;
  });
  const schemaOrg = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
    try { const parsed = JSON.parse(s.textContent || 'null'); if (parsed && typeof parsed === 'object') schemaOrg.push(parsed); } catch (e) {}
  });

  // ── headingHierarchy ─────────────────────────────────────────────────
  const headingHierarchy = [];
  document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => {
    headingHierarchy.push({
      level: parseInt(h.tagName.charAt(1), 10),
      text: txt(h.textContent, 100),
      isAboveFold: isAboveFold(h.getBoundingClientRect())
    });
  });

  // ── landmarks / semanticHTML ─────────────────────────────────────────
  const landmarks = [];
  document.querySelectorAll('[role],nav,main,footer,header,aside').forEach(el => {
    const role = el.getAttribute('role') || el.tagName.toLowerCase();
    const label = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || '';
    landmarks.push({ role, label });
  });
  const semanticHTML = {
    hasMain: !!document.querySelector('main'),
    hasNav: !!document.querySelector('nav'),
    hasFooter: !!document.querySelector('footer'),
    formCount: document.querySelectorAll('form').length,
    tableCount: document.querySelectorAll('table').length
  };

  // ── structure (v2.3) — title vs first H1 similarity ─────────────────
  const firstH1 = document.querySelector('h1');
  const h1Text = firstH1 ? txt(firstH1.textContent || '', 200) : '';
  const titleTokens = tokenize(title);
  const h1Tokens = tokenize(h1Text);
  const titleH1Similarity = jaccard(titleTokens, h1Tokens);
  const structure = { titleH1Match: titleH1Similarity >= 0.5, titleH1Similarity };

  // ── textContent ──────────────────────────────────────────────────────
  const bodyText = document.body ? (document.body.innerText || '').replace(/\\s+/g, ' ').trim() : '';
  const wordCount = bodyText ? bodyText.split(/\\s+/).filter(Boolean).length : 0;
  const sentenceCount = Math.max(1, (bodyText.match(/[.!?]+/g) || []).length);
  const syllableCount = Math.max(wordCount, Math.round(wordCount * 1.5));
  const readabilityScore = wordCount < 30 ? null : (206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / Math.max(wordCount, 1)));
  const paragraphs = [];
  const allParas = Array.from(document.querySelectorAll('p')).slice(0, 50);
  for (const p of allParas) {
    const t = txt(p.textContent || '', 500);
    if (!t) continue;
    paragraphs.push({ text: t, position: isAboveFold(p.getBoundingClientRect()) ? 'above_fold' : 'below_fold' });
  }
  const heroSubheadingEl = document.querySelector('h2');
  const heroSubheading = heroSubheadingEl ? txt(heroSubheadingEl.textContent || '', 200) : null;
  const firstParagraph = paragraphs.length > 0 ? paragraphs[0].text : null;
  const valueProp = { h1: h1Text || null, heroSubheading, firstParagraph };
  const urgencyScarcityHits = [];
  for (const re of URGENCY_PATTERNS) { const m = bodyText.match(re); if (m) urgencyScarcityHits.push({ pattern: re.source, match: m[0] }); }
  const riskReversalHits = [];
  for (const re of RISK_REVERSAL_PATTERNS) { const m = bodyText.match(re); if (m) riskReversalHits.push({ pattern: re.source, match: m[0] }); }
  const textContent = { wordCount, readabilityScore, primaryLanguage: (langAttr || 'en').split('-')[0], paragraphs, valueProp, urgencyScarcityHits, riskReversalHits };

  // ── ctas ─────────────────────────────────────────────────────────────
  const ctaCandidates = Array.from(document.querySelectorAll('button, a[href], input[type="submit"], input[type="button"], [role="button"]'));
  const ctaTextSamples = [];
  const ctas = ctaCandidates.slice(0, 50).map((el, idx) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    const text = txt(el.textContent || el.getAttribute('value') || '', 80);
    if (!text) return null;
    ctaTextSamples.push(text);
    const cs = getComputedStyle(el);
    const fg = parseRgb(cs.color);
    const bg = parseRgb(cs.backgroundColor);
    const styleType = (idx === 0 ? 'primary' : (idx === 1 ? 'secondary' : 'tertiary'));
    return {
      text,
      accessibleName: el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || text || null,
      role: el.getAttribute('role') || (el.tagName === 'A' ? 'link' : 'button'),
      type: styleType,
      isAboveFold: isAboveFold(r),
      boundingBox: { x: r.left, y: r.top, width: r.width, height: r.height },
      computedStyles: {
        backgroundColor: cs.backgroundColor || '',
        color: cs.color || '',
        fontSize: cs.fontSize || '',
        padding: cs.padding || '',
        contrastRatio: contrast(fg, bg)
      },
      hoverStyles: null,
      focusStyles: null,
      surroundingContext: txt((el.parentElement ? el.parentElement.textContent : '') || '', 200)
    };
  }).filter(Boolean);

  // ── forms ────────────────────────────────────────────────────────────
  const formEls = Array.from(document.querySelectorAll('form'));
  const formSignalTexts = [];
  const forms = formEls.map((f, i) => {
    const fieldEls = Array.from(f.querySelectorAll('input, select, textarea'));
    const fields = fieldEls.map(fe => {
      const type = fe.tagName === 'SELECT' ? 'select' : (fe.tagName === 'TEXTAREA' ? 'textarea' : (fe.getAttribute('type') || 'text'));
      const id = fe.getAttribute('id');
      const labelEl = id ? f.querySelector('label[for="' + id + '"]') : (fe.closest('label'));
      const label = labelEl ? txt(labelEl.textContent || '', 100) : '';
      const ariaLabel = fe.getAttribute('aria-label');
      const isRequired = fe.hasAttribute('required') || fe.getAttribute('aria-required') === 'true';
      if (label) formSignalTexts.push(label);
      return {
        type,
        label,
        hasLabel: !!labelEl,
        accessibleName: ariaLabel || label || null,
        role: fe.getAttribute('role') || (fe.tagName.toLowerCase() === 'select' ? 'combobox' : (type === 'submit' || type === 'button' ? 'button' : 'textbox')),
        isRequired,
        hasValidation: fe.hasAttribute('pattern') || fe.hasAttribute('minlength') || fe.hasAttribute('maxlength') || isRequired,
        hasErrorMessage: !!f.querySelector('[role="alert"], .error, .invalid-feedback'),
        placeholder: fe.getAttribute('placeholder') || ''
      };
    });
    const submitEl = f.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
    return {
      id: f.getAttribute('id') || ('form-' + i),
      fieldCount: fields.length,
      requiredFieldCount: fields.filter(x => x.isRequired).length,
      fields,
      hasInlineValidation: !!f.querySelector('[aria-invalid], .error'),
      submitButtonText: submitEl ? txt(submitEl.textContent || submitEl.getAttribute('value') || '', 50) : ''
    };
  });

  // ── trustSignals ─────────────────────────────────────────────────────
  const trustKeywords = /\\b(trust|secure|verified|certified|guarantee|rating|reviews?|testimonial)\\b/i;
  const trustEls = Array.from(document.querySelectorAll('[class*="trust" i], [class*="badge" i], [class*="review" i], [class*="testimonial" i], [class*="guarantee" i], [aria-label*="rating" i]'));
  const ctaCenters = ctas.map(c => ({ cx: c.boundingBox.x + c.boundingBox.width / 2, cy: c.boundingBox.y + c.boundingBox.height / 2 }));
  const trustSignals = trustEls.slice(0, 30).map(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    const t = txt(el.textContent || el.getAttribute('aria-label') || '', 200);
    if (!t && !trustKeywords.test(el.className)) return null;
    const cls = (el.className || '').toLowerCase();
    let type = 'social_proof';
    if (/badge|verified|certified|secure/.test(cls)) type = 'badge';
    else if (/review|rating/.test(cls)) type = 'review';
    else if (/testimonial/.test(cls)) type = 'testimonial';
    else if (/guarantee/.test(cls)) type = 'guarantee';
    else if (/security/.test(cls)) type = 'security';
    let subtype = 'other';
    if (/payment/.test(cls)) subtype = 'payment';
    else if (/iso|cert/.test(cls)) subtype = 'security_certification';
    else if (/review/.test(cls)) subtype = 'customer_review';
    else if (/rating/.test(cls)) subtype = 'aggregate_rating';
    let minDist = null;
    if (ctaCenters.length > 0) {
      const tx = r.left + r.width / 2, ty = r.top + r.height / 2;
      minDist = Infinity;
      for (const c of ctaCenters) {
        const d = Math.sqrt((c.cx - tx) ** 2 + (c.cy - ty) ** 2);
        if (d < minDist) minDist = d;
      }
    }
    return {
      type,
      subtype,
      text: t,
      isAboveFold: isAboveFold(r),
      boundingBox: { x: r.left, y: r.top, width: r.width, height: r.height },
      source: 'unknown',
      attribution: null,
      freshnessDate: null,
      pixelDistanceToNearestCta: minDist === Infinity ? null : minDist
    };
  }).filter(Boolean);

  // ── layout / images ──────────────────────────────────────────────────
  const allElems = document.body ? document.body.getElementsByTagName('*').length : 1;
  const aboveFoldElems = Array.from(document.body ? document.body.getElementsByTagName('*') : []).filter(e => {
    const r = e.getBoundingClientRect();
    return r.top < foldY && r.bottom > 0 && r.width > 0;
  });
  const layout = {
    viewportHeight: vh,
    foldPosition: foldY,
    contentAboveFold: aboveFoldElems.slice(0, 50).map(e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '')),
    visualHierarchy: {
      primaryElement: firstH1 ? 'h1' : (ctas.length > 0 ? 'button' : ''),
      secondaryElements: ctas.slice(0, 3).map(c => c.type)
    },
    whitespaceRatio: Math.max(0, Math.min(1, 1 - (aboveFoldElems.length / Math.max(allElems, 1))))
  };
  const images = Array.from(document.querySelectorAll('img')).slice(0, 50).map(im => {
    const r = im.getBoundingClientRect();
    return {
      src: im.getAttribute('src') || '',
      alt: im.getAttribute('alt') || '',
      hasAlt: im.hasAttribute('alt'),
      width: im.naturalWidth || r.width || 0,
      height: im.naturalHeight || r.height || 0,
      isAboveFold: isAboveFold(r),
      isLazyLoaded: im.getAttribute('loading') === 'lazy'
    };
  });

  // ── iframes (v2.3) ───────────────────────────────────────────────────
  // pageOrigin may be the literal string 'null' on about:blank (e.g.,
  // setContent-loaded fixtures). Use it as the absolute compare baseline:
  // an iframe with an absolute src is cross-origin iff its parsed origin
  // differs from pageOrigin.
  const pageOrigin = location.origin;
  const iframes = Array.from(document.querySelectorAll('iframe')).slice(0, 30).map(ifr => {
    const src = ifr.getAttribute('src') || '';
    const r = ifr.getBoundingClientRect();
    let origin = '';
    let isCrossOrigin = false;
    // Try parsing src as an absolute URL first (no base). If that succeeds
    // and yields a different origin, it's cross-origin.
    try {
      const u = new URL(src);
      origin = u.origin;
      isCrossOrigin = u.origin !== pageOrigin;
    } catch (e) {
      // Relative src — same-origin relative to pageOrigin (best-effort).
      try {
        const u = new URL(src, pageOrigin === 'null' ? 'http://placeholder.invalid' : pageOrigin);
        origin = pageOrigin === 'null' ? '' : u.origin;
        isCrossOrigin = false;
      } catch (e2) {}
    }
    return {
      src,
      origin,
      isCrossOrigin,
      boundingBox: { x: r.left, y: r.top, width: r.width, height: r.height },
      isAboveFold: isAboveFold(r),
      purposeGuess: classifyIframePurpose(src)
    };
  });

  // ── navigation ───────────────────────────────────────────────────────
  const navEl = document.querySelector('nav');
  const primaryNavItems = navEl ? Array.from(navEl.querySelectorAll('a[href]')).slice(0, 30).map(a => ({
    text: txt(a.textContent || '', 80),
    url: a.getAttribute('href') || '',
    isActive: a.getAttribute('aria-current') === 'page' || /\\bactive\\b/.test(a.className)
  })) : [];
  const breadcrumbs = Array.from(document.querySelectorAll('[aria-label="breadcrumb" i] a, .breadcrumb a, [class*="breadcrumb" i] a')).slice(0, 10).map(a => txt(a.textContent || '', 60));
  const footerEl = document.querySelector('footer');
  const footerNavItems = footerEl ? Array.from(footerEl.querySelectorAll('a[href]')).slice(0, 60).map(a => {
    const colHeader = a.closest('[class*="column" i], [class*="section" i], li, div');
    const section = colHeader ? (colHeader.querySelector('h2,h3,h4,h5,h6')?.textContent || null) : null;
    return { text: txt(a.textContent || '', 80), url: a.getAttribute('href') || '', section: section ? txt(section, 40) : null };
  }) : [];
  const navigation = {
    primaryNavItems,
    breadcrumbs,
    footerNavItems,
    hasSearch: !!document.querySelector('input[type="search"], [role="search"]'),
    hasMobileMenu: !!document.querySelector('[aria-label*="menu" i], button[aria-expanded], .hamburger, [class*="mobile-menu" i]')
  };

  // ── accessibility (v2.3) ─────────────────────────────────────────────
  const focusable = Array.from(document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')).slice(0, 100);
  const keyboardFocusOrder = focusable.map(el => {
    const tabAttr = el.getAttribute('tabindex');
    const ti = tabAttr === null ? 0 : parseInt(tabAttr, 10) || 0;
    return {
      selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(/\\s+/).filter(Boolean).slice(0, 2).join('.') : ''),
      role: el.getAttribute('role') || el.tagName.toLowerCase(),
      accessibleName: el.getAttribute('aria-label') || txt(el.textContent || '', 60) || null,
      tabindex: ti
    };
  });
  const skipLinks = Array.from(document.querySelectorAll('a[href^="#"]')).slice(0, 10).filter(a => {
    const r = a.getBoundingClientRect();
    return r.top < 100;
  }).map(a => {
    const cs = getComputedStyle(a);
    return {
      text: txt(a.textContent || '', 50),
      target: a.getAttribute('href') || '',
      isVisible: cs.display !== 'none' && cs.visibility !== 'hidden'
    };
  });
  const accessibility = { keyboardFocusOrder, skipLinks };

  // ── performance ──────────────────────────────────────────────────────
  const navEntry = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || null;
  const resourceEntries = (performance.getEntriesByType && performance.getEntriesByType('resource')) || [];
  const lcpEntries = (performance.getEntriesByType && performance.getEntriesByType('largest-contentful-paint')) || [];
  const layoutShifts = (performance.getEntriesByType && performance.getEntriesByType('layout-shift')) || [];
  const eventEntries = (performance.getEntriesByType && performance.getEntriesByType('event')) || [];
  let clsValue = 0; let hasShift = false;
  for (const ls of layoutShifts) { if (!ls.hadRecentInput) { clsValue += ls.value; hasShift = true; } }
  const byInter = new Map();
  for (const e of eventEntries) { if (e.interactionId) { const cur = byInter.get(e.interactionId) || 0; byInter.set(e.interactionId, Math.max(cur, e.duration)); } }
  const inp = byInter.size > 0 ? Math.max.apply(null, Array.from(byInter.values())) : undefined;
  const perfObj = {
    domContentLoaded: navEntry ? navEntry.domContentLoadedEventEnd : 0,
    fullyLoaded: navEntry ? navEntry.loadEventEnd : 0,
    resourceCount: resourceEntries.length,
    totalTransferSize: resourceEntries.reduce((s, r) => s + (r.transferSize || 0), 0)
  };
  if (lcpEntries.length > 0) perfObj.largestContentfulPaint = lcpEntries[lcpEntries.length - 1].startTime;
  if (inp !== undefined) perfObj.interactionToNextPaint = inp;
  if (hasShift) perfObj.cumulativeLayoutShift = clsValue;
  if (navEntry) perfObj.timeToFirstByte = navEntry.responseStart;

  // ── inferredPageType (v2.3) ──────────────────────────────────────────
  const urlPath = location.pathname.toLowerCase();
  const urlKeywords = urlPath.split(/[\\/\\-_]/).filter(Boolean);
  const schemaTypes = schemaOrg.map(s => (s && s['@type'] ? String(s['@type']) : '')).filter(Boolean);
  const ctaJoinedLC = ctaTextSamples.join(' ').toLowerCase();
  const formJoinedLC = formSignalTexts.join(' ').toLowerCase();
  let primary = 'unknown';
  const alternatives = [];
  if (/\\/?(checkout|payment|cart)\\b/.test(urlPath) || /\\b(place order|pay now|complete order)\\b/.test(ctaJoinedLC) || schemaTypes.includes('CheckoutPage')) {
    primary = 'checkout';
  } else if (/\\/(product|p\\/|pdp|item)\\b/.test(urlPath) || /\\b(add to cart|buy now|add to bag)\\b/.test(ctaJoinedLC) || schemaTypes.includes('Product')) {
    primary = 'product_detail_page';
  } else if (urlPath === '/' || urlPath === '' || /home/.test(urlPath)) {
    primary = 'home';
  } else if (/\\b(sign in|log in|register|sign up)\\b/.test(ctaJoinedLC) || /password/.test(formJoinedLC)) {
    primary = 'auth';
  } else if (/(category|c\\/|collection|department)/.test(urlPath)) {
    primary = 'category';
  } else if (/\\bsearch\\b/.test(urlPath) || document.querySelector('input[type="search"]')) {
    primary = 'search';
  } else if (document.querySelector('article')) {
    primary = 'article';
  }
  const inferredPageType = {
    primary,
    alternatives,
    signalsUsed: {
      urlKeywords,
      ctaTexts: ctaTextSamples.slice(0, 10),
      formSignals: formSignalTexts.slice(0, 10),
      schemaOrgTypes: schemaTypes
    }
  };

  // ── assemble final shape (F-S4: _extensions OMITTED) ─────────────────
  return {
    metadata: {
      url,
      requestedUrl: url,
      title,
      metaDescription,
      canonical,
      lang: langAttr,
      ogTags,
      schemaOrg,
      timestamp: Date.now(),
      viewport: { width: vw, height: vh }
    },
    headingHierarchy,
    landmarks,
    semanticHTML,
    structure,
    textContent,
    ctas,
    forms,
    trustSignals,
    layout,
    images,
    iframes,
    navigation,
    accessibility,
    performance: perfObj,
    inferredPageType
  };
})()`;
