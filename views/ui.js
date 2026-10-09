// Yhteiset käyttöliittymäkomponentit. Kaikki tekstit lisätään tekstisolmuina
// (textContent-vastine), innerHTML:ää ei käytetä koskaan.

const SVG_NS = 'http://www.w3.org/2000/svg';
const KG_LB = 2.20462;

// ---------------------------------------------------------------------------
// Elementtien luonti

const SALLITUT_PROTOKOLLAT = new Set(['http:', 'https:', 'mailto:']);

// Sallittujen lista: '#'-alkuiset sekä http:, https: ja mailto:. Muuten null.
function safeHref(value) {
  const s = String(value).trim();
  if (s.startsWith('#')) return s;
  try {
    return SALLITUT_PROTOKOLLAT.has(new URL(s, location.href).protocol) ? s : null;
  } catch {
    return null;
  }
}

function applyAttrs(node, attrs, isSvg) {
  if (!attrs) return;
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class' || key === 'className') {
      node.setAttribute('class', String(value));
    } else if (key === 'style') {
      if (typeof value === 'string') node.style.cssText = value;
      else Object.assign(node.style, value);
    } else if (key === 'dataset') {
      for (const [k, v] of Object.entries(value)) {
        if (v !== undefined && v !== null) node.dataset[k] = String(v);
      }
    } else if (/^on/i.test(key)) {
      // Tapahtumat vain funktioina; merkkijonoarvoja ei koskaan aseteta attribuuteiksi.
      if (typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'href' || key === 'xlink:href') {
      const href = safeHref(value);
      if (href !== null) node.setAttribute(key, href);
    } else if (!isSvg && (key === 'value' || key === 'checked' || key === 'selected')) {
      node[key] = value;
    } else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, String(value));
    }
  }
}

function appendChildren(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === undefined || child === null || child === false || child === true) continue;
    if (child instanceof Node) node.append(child);
    else node.append(document.createTextNode(String(child)));
  }
}

function isAttrs(value) {
  return value !== null && typeof value === 'object' && !(value instanceof Node) && !Array.isArray(value);
}

// el(tag, attrs, ...children): attrs tukee avaimia class, style (merkkijono),
// dataset (olio), href, on*-tapahtumat (onClick, onInput, ...) ja muut attribuutit.
export function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (isAttrs(attrs)) applyAttrs(node, attrs, false);
  else if (attrs !== undefined) children.unshift(attrs);
  appendChildren(node, children);
  return node;
}

// SVG-vastine el():lle (lisäapuri kaavioille ja kuvakkeille).
export function svgEl(tag, attrs, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  if (isAttrs(attrs)) applyAttrs(node, attrs, true);
  else if (attrs !== undefined) children.unshift(attrs);
  appendChildren(node, children);
  return node;
}

function chevron() {
  return svgEl('svg', { class: 'chevron', viewBox: '0 0 8 14', width: 8, height: 14, 'aria-hidden': 'true' },
    svgEl('path', { d: 'M1.5 1.5 6.5 7l-5 5.5', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

function closeIcon() {
  return svgEl('svg', { viewBox: '0 0 24 24', width: 20, height: 20, 'aria-hidden': 'true' },
    svgEl('path', { d: 'M6 6l12 12M18 6 6 18', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round' }));
}

// ---------------------------------------------------------------------------
// Perusrakenteet

export function card(...children) {
  return el('div', { class: 'card' }, ...children);
}

export function sectionTitle(teksti) {
  return el('h2', { class: 'section-title' }, teksti);
}

// Rivi: otsikko vasemmalla, arvo ja chevron oikealla. href → linkki, onClick → painike.
export function listRow({ otsikko, arvo, href, onClick } = {}) {
  const sisalto = [
    el('span', { class: 'row-title' }, otsikko),
    arvo !== undefined && arvo !== null && arvo !== '' ? el('span', { class: 'row-value' }, arvo) : null,
  ];
  if (href) {
    return el('a', { class: 'row', href, onClick }, ...sisalto, chevron());
  }
  if (onClick) {
    return el('button', { class: 'row', type: 'button', onClick }, ...sisalto, chevron());
  }
  return el('div', { class: 'row' }, ...sisalto);
}

// ---------------------------------------------------------------------------
// Alalaatikko

// Avoimet laatikot pinona: päällimmäinen on viimeisenä.
const sheetStack = [];

function backgroundRoot() {
  return document.querySelector('.app');
}

// Taustan inert-tila: sovelluksen juuri on inert, kun yksikin laatikko on auki,
// ja alemmat laatikot ovat inert päällimmäisen alla.
function syncInert() {
  const app = backgroundRoot();
  if (app) app.inert = sheetStack.length > 0;
  sheetStack.forEach((s, i) => { s.layer.inert = i < sheetStack.length - 1; });
}

// Esc sulkee vain päällimmäisen laatikon.
function onSheetKey(e) {
  if (e.key !== 'Escape' || !sheetStack.length) return;
  e.preventDefault();
  sheetStack[sheetStack.length - 1].close();
}

// Reitin vaihto sulkee kaikki laatikot heti. Kuuntelija rekisteröidään moduulin
// latautuessa, joten se ajetaan ennen reitittimen hashchange-käsittelijää ja
// tausta ei ole enää inert, kun reititin kohdistaa uuden näkymän.
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    [...sheetStack].reverse().forEach((s) => s.closeNow());
  });
  // Selaimen / puhelimen Takaisin: jokainen laatikko lisää avautuessaan oman historiamerkinnän
  // (sama URL, ei hashchangea). popstate sulkee laatikot, joiden merkintä ei ole enää nykyinen
  // tai sen alla. Uusi tila voi kuulua alempaan laatikkoon (sisäkkäiset laatikot).
  window.addEventListener('popstate', (e) => {
    const nykyinen = e.state && e.state[SHEET_KEY];
    const i = sheetStack.findIndex((s) => s.token === nykyinen);
    [...sheetStack.slice(i + 1)].reverse().forEach((s) => s.closeFromHistory());
  });
}

const SHEET_KEY = 'pspSheet';
let sheetLaskuri = 0;

function omaMerkinta(token) {
  return !!history.state && history.state[SHEET_KEY] === token;
}

// sheet(sisalto, {label}) → {close}. label asetetaan dialogin aria-labeliksi;
// ilman sitä nimi otetaan sisällön .sheet-title-otsikosta.
export function sheet(sisaltoNode, { label } = {}) {
  let closed = false;
  const html = document.documentElement;
  const palautaKohdistus = document.activeElement;

  const body = el('div', { class: 'sheet-body' }, sisaltoNode);
  const panel = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', tabindex: '-1' },
    el('div', { class: 'sheet-handle', 'aria-hidden': 'true' }),
    el('button', { class: 'sheet-close', type: 'button', 'aria-label': 'Sulje', onClick: () => close() }, closeIcon()),
    body);
  if (label) {
    panel.setAttribute('aria-label', String(label));
  } else {
    const otsikko = body.querySelector('.sheet-title');
    if (otsikko) {
      otsikko.id = otsikko.id || `sheet-title-${Math.random().toString(36).slice(2, 9)}`;
      panel.setAttribute('aria-labelledby', otsikko.id);
    } else {
      panel.setAttribute('aria-label', 'Alalaatikko');
    }
  }
  const backdrop = el('div', { class: 'sheet-backdrop', onClick: () => close() });
  const layer = el('div', { class: 'sheet-layer' }, backdrop, panel);

  function finish() {
    if (!layer.isConnected) return;
    layer.remove();
    if (!document.querySelector('.sheet-layer')) html.classList.remove('sheet-open');
  }

  function doClose({ immediate, restore }) {
    if (closed) return;
    closed = true;
    const i = sheetStack.indexOf(entry);
    if (i >= 0) sheetStack.splice(i, 1);
    if (!sheetStack.length) document.removeEventListener('keydown', onSheetKey);
    syncInert();
    layer.inert = true;
    layer.classList.remove('is-open');
    if (restore && palautaKohdistus && palautaKohdistus.isConnected && typeof palautaKohdistus.focus === 'function') {
      palautaKohdistus.focus({ preventScroll: true });
    }
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (immediate || reduce) {
      finish();
    } else {
      panel.addEventListener('transitionend', finish, { once: true });
      setTimeout(finish, 400);
    }
  }

  // Sulkeminen (X, tausta, Esc tai näkymän oma painike): laatikon oma historiamerkintä
  // poistetaan history.back()-kutsulla vain, jos se on yhä nykyinen merkintä. Tarkistus tehdään
  // vasta tehtäväjonon kautta: jos kutsuja siirtyy heti toiseen reittiin (location.hash tai
  // location.replace), nykyinen merkintä ei ole enää laatikon oma eikä back() peru siirtymää.
  function close() {
    if (closed) return;
    doClose({ immediate: false, restore: true });
    setTimeout(() => {
      if (omaMerkinta(token)) history.back();
    }, 0);
  }

  const token = `s${Date.now().toString(36)}-${sheetLaskuri += 1}`;
  const entry = {
    layer,
    token,
    close,
    closeNow: () => doClose({ immediate: true, restore: false }),
    closeFromHistory: () => doClose({ immediate: false, restore: true }),
  };

  try {
    history.pushState({ ...(history.state || {}), [SHEET_KEY]: token }, '');
  } catch {
    // Historiaan kirjoitus ei onnistu: laatikko toimii ilman Takaisin-tukea.
  }

  document.body.append(layer);
  html.classList.add('sheet-open');
  if (!sheetStack.length) document.addEventListener('keydown', onSheetKey);
  sheetStack.push(entry);
  syncInert();
  void panel.offsetHeight; // pakotetaan asettelu, jotta avautumisanimaatio toimii
  layer.classList.add('is-open');
  panel.focus({ preventScroll: true });

  return { close };
}

// "Miksi?"-painike, joka avaa perustelun alalaatikkoon. Tyhjä rivi erottaa kappaleet.
export function whyButton(teksti) {
  const avaa = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const kappaleet = typeof teksti === 'string'
      ? teksti.split(/\n\s*\n/).map((p) => el('p', null, p.trim()))
      : [teksti];
    sheet(el('div', { class: 'why-sheet' }, el('h2', { class: 'sheet-title' }, 'Miksi?'), ...kappaleet), { label: 'Miksi?' });
  };
  return el('button', { class: 'why-btn', type: 'button', onClick: avaa },
    el('span', { class: 'why-icon', 'aria-hidden': 'true' }, '?'),
    'Miksi?');
}

// ---------------------------------------------------------------------------
// Kuusikulmiorengas

function clampPros(pros) {
  const n = Number(pros);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

// hexRing({segmentit:[{pros, vari}], keskiteksti, koko}): kärki ylöspäin oleva
// kuusikulmio. Sivut jaetaan segmenteille tasan (3 segmenttiä → 2 sivua kullekin,
// 1 segmentti → koko kehä). Täyttö etenee myötäpäivään segmentin alusta.
export function hexRing({ segmentit = [], keskiteksti, koko = 160 } = {}) {
  const segs = segmentit.length ? segmentit : [{ pros: 0, vari: 'var(--accent)' }];
  const n = segs.length;
  const sw = koko < 72 ? 14 : koko < 120 ? 10 : 8; // viewBox-yksiköissä (0–100)
  const R = 50 - sw / 2 - 1;
  const vertex = (i) => {
    const a = ((-90 + 60 * i) * Math.PI) / 180;
    return [50 + R * Math.cos(a), 50 + R * Math.sin(a)];
  };
  const s = R; // säännöllisen kuusikulmion sivu = ympäri piirretyn ympyrän säde
  const gap = n > 1 ? sw / 2 + 2 : 0;

  const svg = svgEl('svg', { class: 'hex-ring-svg', viewBox: '0 0 100 100', width: koko, height: koko, 'aria-hidden': 'true' });

  segs.forEach((seg, idx) => {
    const alku = Math.round((idx * 6) / n);
    const loppu = Math.round(((idx + 1) * 6) / n);
    const k = loppu - alku;
    if (k <= 0) return;
    const pts = [];
    for (let i = alku; i <= loppu; i++) pts.push(vertex(i % 6));
    let d;
    let pituus;
    if (k === 6 && gap === 0) {
      pts.pop();
      d = 'M' + pts.map((p) => p.map((v) => v.toFixed(2)).join(' ')).join(' L') + ' Z';
      pituus = 6 * s;
    } else {
      const t = gap / s;
      const [a0, a1] = [pts[0], pts[1]];
      pts[0] = [a0[0] + (a1[0] - a0[0]) * t, a0[1] + (a1[1] - a0[1]) * t];
      const [b0, b1] = [pts[pts.length - 1], pts[pts.length - 2]];
      pts[pts.length - 1] = [b0[0] + (b1[0] - b0[0]) * t, b0[1] + (b1[1] - b0[1]) * t];
      d = 'M' + pts.map((p) => p.map((v) => v.toFixed(2)).join(' ')).join(' L');
      pituus = k * s - 2 * gap;
    }
    const vari = seg.vari || 'var(--accent)';
    const pohja = { d, fill: 'none', 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

    const track = svgEl('path', { ...pohja, class: 'hex-track' });
    track.style.stroke = vari;
    svg.append(track);

    const pros = clampPros(seg.pros);
    if (pros > 0) {
      const fill = svgEl('path', { ...pohja, class: 'hex-fill' });
      fill.style.stroke = vari;
      if (pros < 100) {
        const len = (pituus * pros) / 100;
        fill.setAttribute('stroke-dasharray', `${len.toFixed(2)} ${(pituus + 10).toFixed(2)}`);
      }
      svg.append(fill);
    }
  });

  const label = [keskiteksti, ...segs.map((sg) => `${Math.round(clampPros(sg.pros))} %`)]
    .filter((v) => v !== undefined && v !== null && v !== '')
    .join(', ');
  const wrap = el('div', {
    class: 'hex-ring',
    role: 'img',
    'aria-label': label,
    style: `width:${koko}px;height:${koko}px`,
  }, svg);
  if (keskiteksti !== undefined && keskiteksti !== null && keskiteksti !== '') {
    wrap.append(el('div', { class: 'hex-center', style: `font-size:${Math.max(11, Math.round(koko * 0.2))}px` }, keskiteksti));
  }
  return wrap;
}

// ---------------------------------------------------------------------------
// Lomakekomponentit

export function toggle({ arvo = false, onChange, label } = {}) {
  let paalla = !!arvo;
  const btn = el('button', { class: 'toggle', type: 'button', role: 'switch', 'aria-checked': String(paalla), 'aria-label': label || null },
    el('span', { class: 'toggle-knob', 'aria-hidden': 'true' }));
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    paalla = !paalla;
    btn.setAttribute('aria-checked', String(paalla));
    if (onChange) onChange(paalla);
  });
  return btn;
}

export function segmented({ vaihtoehdot = [], arvo, onChange, label } = {}) {
  let valittu = arvo;
  const wrap = el('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label || null });
  const napit = vaihtoehdot.map((v) => el('button', {
    class: 'segmented-option',
    type: 'button',
    role: 'radio',
    'aria-checked': String(v.arvo === valittu),
    onClick: () => {
      if (v.arvo === valittu) return;
      valittu = v.arvo;
      napit.forEach((nappi, i) => nappi.setAttribute('aria-checked', String(vaihtoehdot[i].arvo === valittu)));
      if (onChange) onChange(valittu);
    },
  }, v.teksti));
  wrap.append(...napit);
  return wrap;
}

// ---------------------------------------------------------------------------
// Muotoilu

// formatWeight(kg, yksikko): paino tallennetaan kiloina; lb-näyttö 1 desimaalilla.
export function formatWeight(kg, yksikko = 'kg') {
  const n = Number(kg);
  if (kg === null || kg === undefined || kg === '' || !Number.isFinite(n)) return '–';
  if (yksikko === 'lb') {
    const lb = n * KG_LB;
    return `${lb.toLocaleString('fi-FI', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} lb`;
  }
  return `${n.toLocaleString('fi-FI', { maximumFractionDigits: 2 })} kg`;
}
