// WP16a T6a a11y audit helper library (library only; the audit script comes in a later task).
// Pure WCAG colour maths (also injected into the page), an in-page audit (names, font size, contrast), a Tab walker,
// a focus log, viewport-rect and UI-scale helpers. Callers pass a Playwright `page`; this file never imports Playwright
// and has no side effects on import.
// Self-test: node scripts/smoke/lib/a11y-audit.mjs --selftest   (prints ONE JSON line; exit 0 ok, 1 fail; no browser)
import path from 'path';
import { fileURLToPath } from 'url';

// WP16b-2: empty, the tree, toast and era-card scopes gate. Kept for later packages.
export const DEFERRED_SCOPES = [];

// ---- Pure maths. Each helper is self-contained (calls only the other pure helpers): auditScope injects their source. ----

// 'rgb(r, g, b)' | 'rgba(r, g, b, a)' | 'rgb(r g b / a)' | 'transparent' -> { r, g, b, a } (r,g,b 0..255, a 0..1); else null.
export function parseCssColor(str) {
  if (typeof str !== 'string') return null;
  const s = str.trim().toLowerCase();
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const m = /^rgba?\((.*)\)$/.exec(s);
  if (!m) return null;
  const parts = m[1].split(/[\s,\/]+/).filter(p => p !== '');
  if (parts.length !== 3 && parts.length !== 4) return null;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const readNum = p => {
    const n = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%?)$/.exec(p);
    return n ? { v: Number(n[1]), pct: n[2] === '%' } : null;
  };
  const chan = p => {
    const n = readNum(p);
    return n ? clamp(n.pct ? n.v * 2.55 : n.v, 0, 255) : null;
  };
  const alpha = p => {
    const n = readNum(p);
    return n ? clamp(n.pct ? n.v / 100 : n.v, 0, 1) : null;
  };
  const r = chan(parts[0]);
  const g = chan(parts[1]);
  const b = chan(parts[2]);
  const a = parts.length === 4 ? alpha(parts[3]) : 1;
  if (r === null || g === null || b === null || a === null) return null;
  return { r, g, b, a };
}

// Standard alpha compositing of fg {r,g,b,a} over bg {r,g,b,a}.
export function compositeOver(fg, bg) {
  const a = fg.a + bg.a * (1 - fg.a);
  if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (f, q) => (f * fg.a + q * bg.a * (1 - fg.a)) / a;
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a };
}

// WCAG 2.x relative luminance of an sRGB colour {r,g,b} (0..255).
export function relativeLuminance(c) {
  const lin = v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

// Opaque fg / bg {r,g,b}: (L1 + 0.05) / (L2 + 0.05), L1 >= L2.
export function contrastRatio(fg, bg) {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// Large text (>= 24 px, or >= 18.66 px and weight >= 700) needs 3; everything else 4.5.
export function neededRatio(fontPx, fontWeight) {
  const large = fontPx >= 24 || (fontPx >= 18.66 && fontWeight >= 700);
  return large ? 3 : 4.5;
}

// ---- Page audit ----

// Runs in the page (source injected by auditScope). Uses only the five pure helpers by name plus DOM APIs.
function auditInPage(arg) {
  const deferredSel = arg.deferredScopes.join(',');
  const inactiveSel = ':disabled, [aria-disabled="true"], .is-locked';
  const CONTROL = 'button, [role=button], input, select, textarea, [role=tab], [role=radio], a[href]';
  const visible = el => {
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity) > 0;
  };
  const nameOf = el => {
    const al = (el.getAttribute('aria-label') || '').trim();
    if (al) return al;
    const viaIds = (el.getAttribute('aria-labelledby') || '').trim().split(/\s+/).filter(Boolean)
      .map(id => {
        const t = document.getElementById(id);
        return t ? t.textContent.trim() : '';
      })
      .filter(Boolean)
      .join(' ');
    if (viaIds) return viaIds;
    const viaLabels = el.labels ? Array.from(el.labels).map(l => l.textContent.trim()).filter(Boolean).join(' ') : '';
    if (viaLabels) return viaLabels;
    const own = (el.textContent || '').trim();
    if (own) return own;
    return (el.getAttribute('title') || '').trim();
  };
  const textOf = el => {
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim() || (el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
    return t.slice(0, 24);
  };
  const selOf = el => {
    const tag = el.tagName.toLowerCase();
    if (el.id) return tag + '#' + el.id;
    const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return cls.length ? tag + '.' + cls.join('.') : tag;
  };
  const r2 = v => (v === null ? null : Math.round(v * 100) / 100);

  const roots = Array.from(document.querySelectorAll(arg.scopeSel));
  const seen = new Set();
  const candidates = [];
  const add = el => {
    if (!seen.has(el)) {
      seen.add(el);
      candidates.push(el);
    }
  };
  for (const root of roots) {
    add(root);
    for (const d of root.querySelectorAll('*')) add(d);
  }

  const unnamed = [];
  const small = [];
  const contrast = [];
  const deferred = [];
  const inactive = [];
  const indeterminate = [];
  // Deferred scopes win; then inactive (locked / disabled) contrast; otherwise the kind's own bucket.
  const route = (kind, el, item, inactiveFlag) => {
    if (deferredSel && el.closest(deferredSel)) deferred.push(inactiveFlag ? { ...item, inactive: true } : item);
    else if (inactiveFlag) inactive.push(item);
    else if (kind === 'unnamed') unnamed.push(item);
    else if (kind === 'small') small.push(item);
    else contrast.push(item);
  };

  let controls = 0;
  let text = 0;
  for (const el of candidates) {
    if (!visible(el)) continue;
    if (el.closest('.is-fading')) continue; // leaving toast / era card
    const cs = getComputedStyle(el);
    if (el.matches(CONTROL)) {
      controls++;
      if (nameOf(el) === '') {
        route('unnamed', el, { kind: 'unnamed', sel: selOf(el), text: textOf(el), ratio: null, need: null, fontPx: null }, false);
      }
    }
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
    if (!Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim() !== '')) continue;
    text++;
    const fontPx = parseFloat(cs.fontSize);
    const need = neededRatio(fontPx, parseInt(cs.fontWeight, 10) || 400);
    if (fontPx < 12) {
      route('small', el, { kind: 'small', sel: selOf(el), text: textOf(el), ratio: null, need: null, fontPx: r2(fontPx) }, false);
    }
    const item = ratio => ({ kind: 'contrast', sel: selOf(el), text: textOf(el), ratio, need: r2(need), fontPx: r2(fontPx) });
    const fg0 = parseCssColor(cs.color);
    if (!fg0) {
      indeterminate.push(item(null));
      continue;
    }
    // Foreground alpha times the opacity of the element and every ancestor.
    let opacity = 1;
    for (let n = el; n; n = n.parentElement) opacity *= parseFloat(getComputedStyle(n).opacity);
    const fg = { r: fg0.r, g: fg0.g, b: fg0.b, a: fg0.a * opacity };
    // Layers from the element outwards, stopping at the first opaque base layer (document body/root excluded).
    const layers = [];
    let baseIdx = -1;
    for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      const s = getComputedStyle(n);
      const color = parseCssColor(s.backgroundColor);
      const img = s.backgroundImage || '';
      layers.push({ color, gradient: img.indexOf('gradient') >= 0 ? img : null });
      if (color && color.a >= 0.999) {
        baseIdx = layers.length - 1;
        break;
      }
    }
    if (baseIdx < 0) {
      indeterminate.push(item(null));
      continue;
    }
    // bgAt[i]: background at layer i including layer i's own colour, folded upwards from the opaque base.
    const bgAt = [];
    let acc = layers[baseIdx].color;
    bgAt[baseIdx] = acc;
    for (let i = baseIdx - 1; i >= 0; i--) {
      const c = layers[i].color;
      if (c && c.a > 0) acc = compositeOver(c, acc);
      bgAt[i] = acc;
    }
    let g = -1;
    for (let i = 0; i <= baseIdx; i++) {
      if (layers[i].gradient) {
        g = i;
        break;
      }
    }
    let ratio;
    if (g < 0) {
      ratio = contrastRatio(compositeOver(fg, bgAt[0]), bgAt[0]);
    } else {
      // Nearest gradient layer: every rgb()/rgba() stop, text over each stop; the worst (min) ratio counts.
      const stops = (layers[g].gradient.match(/rgba?\([^)]*\)/g) || []).map(s => parseCssColor(s)).filter(c => c !== null);
      if (stops.length === 0) {
        indeterminate.push(item(null));
        continue;
      }
      ratio = Infinity;
      for (const st of stops) {
        let sb = compositeOver(st, bgAt[g]);
        // Layers nearer than the gradient paint over the stop too.
        for (let i = g - 1; i >= 0; i--) {
          const c = layers[i].color;
          if (c && c.a > 0) sb = compositeOver(c, sb);
        }
        ratio = Math.min(ratio, contrastRatio(compositeOver(fg, sb), sb));
      }
    }
    const need0 = need;
    if (ratio < need0) route('contrast', el, item(r2(ratio)), el.closest(inactiveSel) !== null);
  }

  return {
    rootCount: roots.length,
    checked: { controls, text },
    unnamed,
    small,
    contrast,
    deferred,
    inactive,
    indeterminate,
  };
}

export async function auditScope(page, scopeSel) {
  const expr = `(() => {\n${[parseCssColor, compositeOver, relativeLuminance, contrastRatio, neededRatio].map(f => f.toString()).join('\n')}\nreturn (${auditInPage.toString()})(${JSON.stringify({ scopeSel, deferredScopes: DEFERRED_SCOPES })});\n})()`;
  return page.evaluate(expr);
}

// ---- Tab walker ----

// Runs in the page after each Tab press. Self-contained: RING and NAME are inlined here.
function tabRecord(scopeSel) {
  const ringOf = el => {
    const cs = getComputedStyle(el);
    return (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 1) || cs.boxShadow !== 'none';
  };
  const nameOf = el => {
    const al = (el.getAttribute('aria-label') || '').trim();
    if (al) return al;
    const viaIds = (el.getAttribute('aria-labelledby') || '').trim().split(/\s+/).filter(Boolean)
      .map(id => {
        const t = document.getElementById(id);
        return t ? t.textContent.trim() : '';
      })
      .filter(Boolean)
      .join(' ');
    if (viaIds) return viaIds;
    const viaLabels = el.labels ? Array.from(el.labels).map(l => l.textContent.trim()).filter(Boolean).join(' ') : '';
    if (viaLabels) return viaLabels;
    const own = (el.textContent || '').trim();
    if (own) return own;
    return (el.getAttribute('title') || '').trim();
  };
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) {
    return { tag: 'body', id: '', cls: '', tech: '', ring: ringOf(document.body), named: false, inScope: scopeSel ? false : null };
  }
  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || '',
    cls: el.getAttribute('class') || '',
    tech: (el.dataset && el.dataset.tech) || '',
    ring: ringOf(el),
    named: nameOf(el) !== '',
    inScope: scopeSel ? !!el.closest(scopeSel) : null,
  };
}

// n x (key, wait 60 ms, record). key is 'Tab' or 'Shift+Tab'. Index i is the press number from 0. The caller focuses the start point first.
export async function tabWalk(page, n, scopeSel = null, key = 'Tab') {
  const out = [];
  for (let i = 0; i < n; i++) {
    await page.keyboard.press(key);
    await page.waitForTimeout(60);
    const rec = await page.evaluate(tabRecord, scopeSel);
    out.push({ i, ...rec });
  }
  return out;
}

// ---- Focus log ----

export async function installFocusLog(page) {
  await page.evaluate(() => {
    if (window.__a11yFocused) return;
    window.__a11yFocused = new Set();
    document.addEventListener('focusin', e => window.__a11yFocused.add(e.target), true);
  });
}

export async function resetFocusLog(page) {
  await installFocusLog(page);
  await page.evaluate(() => window.__a11yFocused.clear());
}

// Runs in the page. Self-contained: visibility and descriptors are inlined here.
function missingProbe(arg) {
  const container = document.querySelector(arg.containerSel);
  if (!container) return [];
  const log = window.__a11yFocused;
  const focused = el => !!log && log.has(el);
  const visible = el => {
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity) > 0;
  };
  const descOf = el => {
    if (el.id) return '#' + el.id;
    const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    const base = el.tagName.toLowerCase() + (cls.length ? '.' + cls.join('.') : '');
    const text = ((el.textContent || '') || (el.getAttribute('aria-label') || '')).replace(/\s+/g, ' ').trim().slice(0, 24);
    return text ? base + ' "' + text + '"' : base;
  };
  const cands = Array.from(container.querySelectorAll('button, input, select, textarea, a[href], [role=radio], [tabindex="0"]'))
    .filter(el => !el.matches('[disabled]') && el.getAttribute('role') !== 'tab' && visible(el));
  // Radios inside a radiogroup: one focused member per group is enough.
  const groupOf = el => {
    const isRadio = el.getAttribute('role') === 'radio' || (el.tagName === 'INPUT' && el.type === 'radio');
    return isRadio ? el.closest('[role=radiogroup]') : null;
  };
  const hit = new Map();
  for (const el of cands) {
    const g = groupOf(el);
    if (g) hit.set(g, hit.get(g) || focused(el));
  }
  const reported = new Set();
  const out = [];
  for (const el of cands) {
    const g = groupOf(el);
    if (g) {
      if (!hit.get(g) && !reported.has(g)) {
        reported.add(g);
        out.push('radiogroup:' + (g.getAttribute('aria-label') || g.id || descOf(g)));
      }
      continue;
    }
    if (!focused(el)) out.push(descOf(el));
  }
  return out;
}

// Descriptors of visible, enabled controls inside containerSel that the focus log never saw. A missing container gives [].
export async function missingFocus(page, containerSel) {
  return page.evaluate(missingProbe, { containerSel });
}

// ---- Helpers ----

export async function focusId(page, id) {
  return page.evaluate(i => {
    const el = document.getElementById(i);
    if (el) el.focus();
    return !!el && document.activeElement === el;
  }, id);
}

export async function setUiScale(page, pct) {
  await page.evaluate(p => {
    window.__wedtmd.session.updateSettings({ uiScale: p });
  }, pct);
  await page.waitForTimeout(300);
}

// ok: element exists, width and height > 0, rect inside [0, innerWidth] x [0, innerHeight] within tolPx.
export async function rectInViewport(page, sel, tolPx = 1) {
  return page.evaluate(([s, tol]) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const el = document.querySelector(s);
    if (!el) return { ok: false, rect: null, viewport: { w: vw, h: vh } };
    const r = el.getBoundingClientRect();
    const rect = { x: r.x, y: r.y, width: r.width, height: r.height };
    const ok = r.width > 0 && r.height > 0 && r.left >= -tol && r.top >= -tol && r.right <= vw + tol && r.bottom <= vh + tol;
    return { ok, rect, viewport: { w: vw, h: vh } };
  }, [sel, tolPx]);
}

// ---- Self-test (entry script only) ----

function runSelfTest() {
  const checks = {};
  const values = {};
  const flag = (name, cond, value) => {
    checks[name] = cond === true;
    values[name] = value === undefined ? null : value;
  };
  const attempt = fn => {
    try {
      return fn();
    } catch {
      return NaN;
    }
  };
  const near = (name, got, want, tol) => flag(name, typeof got === 'number' && Math.abs(got - want) <= tol, got);
  const pair = (fg, bg) => attempt(() => contrastRatio(parseCssColor(fg), parseCssColor(bg)));

  near('contrast_black_white_21', attempt(() => contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })), 21, 1e-9);
  near('old_sys_tab_active_3_73', pair('rgb(210, 191, 156)', 'rgb(140, 74, 42)'), 3.73, 0.02);
  near('steam_on_rust_5_10', pair('rgb(232, 224, 204)', 'rgb(140, 74, 42)'), 5.1, 0.02);
  near('dirty_beige_on_rust_dark_4_34', pair('rgb(168, 149, 122)', 'rgb(78, 42, 26)'), 4.34, 0.02);

  near('needed_24_400_3', neededRatio(24, 400), 3, 0);
  near('needed_18_66_700_3', neededRatio(18.66, 700), 3, 0);
  near('needed_18_700_4_5', neededRatio(18, 700), 4.5, 0);
  near('needed_15_400_4_5', neededRatio(15, 400), 4.5, 0);
  near('needed_23_9_400_4_5', neededRatio(23.9, 400), 4.5, 0);

  const half = attempt(() => compositeOver({ r: 255, g: 255, b: 255, a: 0.5 }, { r: 0, g: 0, b: 0, a: 1 }));
  const hr = half && typeof half === 'object' ? half : {};
  near('composite_half_white_r', hr.r, 127.5, 0.01);
  near('composite_half_white_g', hr.g, 127.5, 0.01);
  near('composite_half_white_b', hr.b, 127.5, 0.01);
  near('composite_half_white_a', hr.a, 1, 0.01);

  const tr = attempt(() => parseCssColor('transparent'));
  flag('parse_transparent_a0', !!tr && tr.a === 0, tr);
  const tr0 = attempt(() => parseCssColor('rgba(0, 0, 0, 0)'));
  flag('parse_rgba_zero_a0', !!tr0 && tr0.a === 0, tr0);
  const hsl = attempt(() => parseCssColor('hsl(0 0% 0%)'));
  flag('parse_hsl_null', hsl === null, hsl);
  const slash = attempt(() => parseCssColor('rgb(140 74 42 / 0.5)'));
  flag('parse_space_slash_alpha', !!slash && slash.r === 140 && slash.g === 74 && slash.b === 42 && slash.a === 0.5, slash);
  const comma = attempt(() => parseCssColor('rgba(1, 2, 3, 0.25)'));
  flag('parse_rgba_comma_alpha', !!comma && comma.r === 1 && comma.g === 2 && comma.b === 3 && comma.a === 0.25, comma);

  flag('deferred_scopes_empty', DEFERRED_SCOPES.length === 0, DEFERRED_SCOPES.length);
  near('ink_on_amber_6_43', pair('rgb(20, 17, 15)', 'rgb(217, 130, 43)'), 6.43, 0.02);
  near('ink_on_amber_dim_6_49', pair('rgb(20, 17, 15)', 'rgb(168, 149, 122)'), 6.49, 0.02);
  near('sand_on_rust_dark_6_12', pair('rgb(201, 178, 138)', 'rgb(78, 42, 26)'), 6.12, 0.02);

  const ok = Object.values(checks).every(Boolean);
  console.log(JSON.stringify({ ok, checks, values }));
  process.exitCode = ok ? 0 : 1;
}

const isEntry = (() => {
  if (!process.argv[1]) return false;
  return path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
})();

if (isEntry) {
  if (process.argv.includes('--selftest')) {
    runSelfTest();
  } else {
    console.error('usage: node scripts/smoke/lib/a11y-audit.mjs --selftest');
    process.exitCode = 2;
  }
}
