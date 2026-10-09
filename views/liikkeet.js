// Liikkeet (speksi 6.5, 4f): haku, lihasryhmäsirut ja lista. Liikkeen sivu #/liike/<id>:
// media ylimpänä, lihasryhmät, paras arvioitu voima, ennätykset, oma historia ja ohje.
import { getState } from '../store.js';
import { tanaanPvm } from '../seed.js';
import { LIIKKEET, LIHASRYHMAT, RYHMAT, liike as haeLiike } from '../data.js';
import { el, svgEl, card, sectionTitle, whyButton, formatWeight } from './ui.js';
import { estimatedStrength, exerciseRecords } from '../engine/score.js';
import { e1rm } from '../engine/progression.js';
import { openExerciseSheet, exerciseMedia, youtubeLinkki } from './media.js';

// Natiivi append ei litistä taulukoita eikä ohita null-arvoja, joten ne käsitellään tässä.
function lisaa(root, ...osat) {
  root.append(...osat.flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false));
}

const iso = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const pv = (pvm) => `${Number(pvm.slice(8, 10))}.${Number(pvm.slice(5, 7))}.`;
const VIIKONPAIVAT = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];
const viikonpaiva = (pvm) => VIIKONPAIVAT[new Date(pvm + 'T12:00:00Z').getUTCDay()];

function ryhmanVari(lihas) {
  if (RYHMAT.tyonnot.includes(lihas)) return 'var(--accent)';
  if (RYHMAT.vedot.includes(lihas)) return 'var(--pull)';
  if (RYHMAT.jalat.includes(lihas)) return 'var(--legs)';
  return 'var(--text-dim)';
}

function normalisoi(s) {
  return String(s || '').toLocaleLowerCase('fi-FI').trim();
}

// Haku ja suodatin säilyvät uudelleenpiirrossa (statechange) ja paluussa listaan.
let haku = '';
let suodatin = null;

function chevron() {
  return svgEl('svg', { class: 'chevron', viewBox: '0 0 8 14', width: 8, height: 14, 'aria-hidden': 'true' },
    svgEl('path', { d: 'M1.5 1.5 6.5 7l-5 5.5', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

function playIkoni(koko = 16) {
  return svgEl('svg', { viewBox: '0 0 24 24', width: koko, height: koko, 'aria-hidden': 'true' },
    svgEl('path', { d: 'M8 5.5v13l10.5-6.5z', fill: 'currentColor' }));
}

function arvoTeksti(arvio, yksikko) {
  if (!arvio) return null;
  return arvio.yksikko === 'toistoa' ? `${arvio.arvo} toistoa` : formatWeight(arvio.arvo, yksikko);
}

// --- Lista -----------------------------------------------------------------

function lista(root, state) {
  const historia = (state.historia || []).filter(Boolean);
  const yksikko = (state.profiili && state.profiili.yksikko) || 'kg';
  const tanaan = tanaanPvm(new Date().toISOString());

  const rivit = LIIKKEET.map((l) => {
    let arvio = null;
    try {
      arvio = estimatedStrength(l, historia, tanaan);
    } catch (err) {
      console.error(err);
    }
    const rivi = el('a', { class: 't8-lib-row', href: `#/liike/${encodeURIComponent(l.id)}` },
      el('span', { class: 't8-lib-dot', style: `background:${ryhmanVari(l.lihasryhma)}`, 'aria-hidden': 'true' }),
      el('span', { class: 't8-lib-body' },
        el('span', { class: 't8-lib-name' }, l.nimi,
          l.media && l.media.animaatio ? el('span', { class: 't8-lib-anim', title: 'Animaatio' }, playIkoni(10)) : null),
        el('span', { class: 't8-lib-sub' }, `${iso(l.lihasryhma)} · ${l.valine}`)),
      arvio ? el('span', { class: 't8-lib-val' }, arvoTeksti(arvio, yksikko)) : null,
      chevron());
    return { l, rivi, haettava: normalisoi(`${l.nimi} ${l.lihasryhma} ${(l.toissijaiset || []).join(' ')} ${l.valine}`) };
  });

  const listaEl = el('div', { class: 'list t8-lib-list' }, rivit.map((r) => r.rivi));
  const tyhja = el('div', { class: 'card t8-empty', hidden: true });
  const laskuri = el('span', { class: 't8-lib-count' });

  function suodata() {
    const q = normalisoi(haku);
    let n = 0;
    for (const r of rivit) {
      const nakyy = (!suodatin || r.l.lihasryhma === suodatin) && (!q || r.haettava.includes(q));
      r.rivi.hidden = !nakyy;
      if (nakyy) n += 1;
    }
    listaEl.hidden = n === 0;
    tyhja.hidden = n !== 0;
    tyhja.textContent = q ? `Ei osumia haulla ”${haku.trim()}”.` : 'Ei liikkeitä tällä suodattimella.';
    laskuri.textContent = `${n} liikettä`;
  }

  const input = el('input', {
    class: 't8-search-input',
    type: 'search',
    placeholder: 'Hae liikettä',
    'aria-label': 'Hae liikettä',
    autocomplete: 'off',
    enterkeyhint: 'search',
    value: haku,
    onInput: (e) => { haku = e.target.value; suodata(); },
  });

  const sirut = [null, ...LIHASRYHMAT].map((r) => el('button', {
    class: 'chip',
    type: 'button',
    'aria-pressed': String(suodatin === r),
    onClick: () => {
      suodatin = r;
      sirut.forEach((s, i) => s.setAttribute('aria-pressed', String([null, ...LIHASRYHMAT][i] === suodatin)));
      suodata();
    },
  }, r ? iso(r) : 'Kaikki'));

  lisaa(root, 
    el('h1', { class: 'page-title' }, 'Liikkeet'),
    el('label', { class: 't8-search' },
      svgEl('svg', { viewBox: '0 0 24 24', width: 18, height: 18, 'aria-hidden': 'true', class: 't8-search-ico' },
        svgEl('path', { d: 'M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.5 15.5 20 20', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' })),
      input),
    el('div', { class: 'chips scroll t8-lib-chips', role: 'group', 'aria-label': 'Suodata lihasryhmän mukaan' }, sirut),
    el('div', { class: 't8-lib-meta' }, laskuri, el('span', { class: 'muted small' }, 'Oikealla paras arvioitu voima')),
    listaEl,
    tyhja,
  );
  suodata();
}

// --- Liikkeen sivu -----------------------------------------------------------

function kerrat(liikeId, historia) {
  const tulos = [];
  for (const t of historia) {
    if (!(t.tyyppi == null || t.tyyppi === 'voima')) continue;
    for (const tl of t.liikkeet || []) {
      if (tl.liikeId !== liikeId) continue;
      const sarjat = (tl.sarjat || []).filter((s) => s && !s.lammittely && Number.isFinite(s.toistot) && s.toistot > 0);
      if (sarjat.length) tulos.push({ pvm: t.pvm, aloitus: t.aloitus || '', sarjat });
    }
  }
  return tulos.sort((a, b) => (`${a.pvm}${a.aloitus}` < `${b.pvm}${b.aloitus}` ? -1 : 1));
}

function kertaParas(kerta, kehonpaino) {
  return Math.max(...kerta.sarjat.map((s) => (kehonpaino ? s.toistot : e1rm(Number(s.paino) || 0, s.toistot))));
}

function kayra(arvot) {
  const W = 300;
  const H = 70;
  const min = Math.min(...arvot);
  const max = Math.max(...arvot);
  const vali = max - min || 1;
  const pisteet = arvot.map((v, i) => [
    (i / (arvot.length - 1)) * (W - 12) + 6,
    H - 8 - ((v - min) / vali) * (H - 20),
  ]);
  const d = 'M' + pisteet.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L');
  const alue = `${d} L${pisteet[pisteet.length - 1][0].toFixed(1)} ${H} L${pisteet[0][0].toFixed(1)} ${H} Z`;
  const viimeinen = pisteet[pisteet.length - 1];
  return svgEl('svg', { class: 't8-spark', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    svgEl('path', { d: alue, class: 't8-spark-area' }),
    svgEl('path', { d, class: 't8-spark-line', 'vector-effect': 'non-scaling-stroke' }),
    svgEl('circle', { cx: viimeinen[0], cy: viimeinen[1], r: 4, class: 't8-spark-dot' }));
}

function sarjatTeksti(kerta, kehonpaino, yksikko) {
  const painot = new Set(kerta.sarjat.map((s) => Number(s.paino) || 0));
  const toistot = kerta.sarjat.map((s) => s.toistot).join(' · ');
  if (painot.size === 1) {
    const p = [...painot][0];
    if (kehonpaino && p === 0) return `${toistot} toistoa`;
    return `${kehonpaino ? '+' : ''}${formatWeight(p, yksikko)} × ${toistot}`;
  }
  return kerta.sarjat.map((s) => `${formatWeight(s.paino, yksikko)}×${s.toistot}`).join(', ');
}

function liikeSivu(root, state, liike) {
  const historia = (state.historia || []).filter(Boolean);
  const yksikko = (state.profiili && state.profiili.yksikko) || 'kg';
  const tanaan = tanaanPvm(new Date().toISOString());
  const kehonpaino = liike.valine === 'kehonpaino';

  let arvio = null;
  let ennatykset = { arvioituVoima: null, volyymi: null, toistot: null, paino: null };
  try {
    arvio = estimatedStrength(liike, historia, tanaan);
    ennatykset = exerciseRecords(liike.id, historia, liike);
  } catch (err) {
    console.error(err);
  }
  const omat = kerrat(liike.id, historia);

  const voimaMiksi = kehonpaino
    ? 'Kehonpainoliikkeissä arvioitu voima on paras toistomäärä yhdessä sarjassa viimeisen 6 viikon ajalta. Lisäpainoa ei huomioida.'
      + '\n\nJos liikettä ei ole tehty yli 14 päivään, arvio laskee 1 % jokaista alkavaa viikkoa kohden, enintään 10 %. Tauko heikentää kuntoa, ja arvio palaa ennalleen treenaamalla.'
    : 'Arvioitu maksimi (e1RM) kertoo, paljonko jaksaisit nostaa yhden kerran. Se lasketaan parhaasta sarjasta viimeisen 6 viikon ajalta kaavalla paino × (1 + toistot / 30), jolloin eri toistomäärillä tehdyt sarjat ovat vertailukelpoisia.'
      + '\n\nJos liikettä ei ole tehty yli 14 päivään, arvio laskee 1 % jokaista alkavaa viikkoa kohden, enintään 10 %. Tauko heikentää kuntoa, ja arvio palaa ennalleen treenaamalla.';

  const voimaKortti = card(
    el('div', { class: 't8-eyebrow' }, kehonpaino ? 'Paras arvioitu voima · toistoa' : 'Paras arvioitu voima · e1RM'),
    arvio
      ? el('div', { class: 't8-strength' },
        el('span', { class: 'big-number' }, arvio.yksikko === 'toistoa'
          ? String(arvio.arvo)
          : formatWeight(arvio.arvo, yksikko).replace(/\s(kg|lb)$/, '')),
        el('span', { class: 't8-strength-unit' }, arvio.yksikko === 'toistoa' ? 'toistoa' : yksikko))
      : el('div', { class: 't8-strength-empty' }, 'Ei vielä tuloksia. Tee liike treenissä, niin arvio näkyy tässä.'),
    arvio
      ? el('div', { class: 't8-strength-sub' },
        `Viimeksi ${pv(arvio.viimeksi)}`,
        arvio.vahennysPros > 0 ? el('span', { class: 't8-pill t8-pill-warn' }, `Tauko −${arvio.vahennysPros} %`) : null)
      : null,
    omat.length >= 2 ? kayra(omat.slice(-12).map((k) => kertaParas(k, kehonpaino))) : null,
    el('div', { class: 't8-why-row' }, whyButton(voimaMiksi)),
  );
  voimaKortti.classList.add('t8-strength-card');

  const viimeisin = omat.length ? omat[omat.length - 1] : null;
  const ennatysRuudut = kehonpaino
    ? [
      { otsikko: 'Eniten toistoja', r: ennatykset.toistot, muoto: (v) => `${v}` },
      { otsikko: 'Kertoja', r: viimeisin ? { arvo: omat.length, pvm: viimeisin.pvm } : null, muoto: (v) => `${v}`, ali: 'viimeksi ' },
      ennatykset.paino ? { otsikko: 'Raskain lisäpaino', r: ennatykset.paino, muoto: (v) => formatWeight(v, yksikko) } : null,
      ennatykset.volyymi ? { otsikko: 'Paras volyymi', r: ennatykset.volyymi, muoto: (v) => formatWeight(Math.round(v), yksikko) } : null,
    ].filter(Boolean)
    : [
      { otsikko: 'Arvioitu maksimi', r: ennatykset.arvioituVoima, muoto: (v) => formatWeight(v, yksikko) },
      { otsikko: 'Paras volyymi', r: ennatykset.volyymi, muoto: (v) => formatWeight(Math.round(v), yksikko) },
      { otsikko: 'Eniten toistoja', r: ennatykset.toistot, muoto: (v) => `${v}` },
      { otsikko: 'Raskain paino', r: ennatykset.paino, muoto: (v) => formatWeight(v, yksikko) },
    ];

  const toissijaiset = liike.toissijaiset || [];

  lisaa(root, 
    el('a', { class: 't8-back', href: '#/liikkeet' }, '‹ Liikkeet'),
    el('h1', { class: 'page-title t8-page-title-tight' }, liike.nimi),
    el('div', { class: 'chips t8-ex-tags' },
      el('span', { class: 'chip is-active t8-chip-static' }, iso(liike.lihasryhma)),
      toissijaiset.map((t) => el('span', { class: 'chip t8-chip-static' }, iso(t))),
      el('span', { class: 'chip t8-chip-static t8-chip-equip' }, iso(liike.valine))),
    exerciseMedia(liike),
    el('div', { class: 't8-media-actions t8-media-actions-2' },
      el('button', { class: 'btn t8-show-btn', type: 'button', onClick: () => openExerciseSheet(liike) }, playIkoni(16), 'Näytä liike'),
      youtubeLinkki(liike, { teksti: 'YouTube' })),
    sectionTitle('Voima'),
    voimaKortti,
    el('div', { class: 't8-records' }, ennatysRuudut.map((x) => el('div', { class: 't8-record' },
      el('span', { class: 't8-record-lbl' }, x.otsikko),
      el('span', { class: 't8-record-val' }, x.r ? x.muoto(x.r.arvo) : '–'),
      el('span', { class: 't8-record-date' }, x.r ? `${x.ali || ''}${pv(x.r.pvm)}` : 'ei vielä')))),
    sectionTitle('Oma historia'),
    omat.length
      ? el('div', { class: 'list' }, omat.slice(-6).reverse().map((k) => el('div', { class: 't8-hist-row' },
        el('span', { class: 't8-hist-date' }, el('b', null, pv(k.pvm)), el('span', null, viikonpaiva(k.pvm))),
        el('span', { class: 't8-hist-sets' }, sarjatTeksti(k, kehonpaino, yksikko)),
        el('span', { class: 't8-hist-best' }, kehonpaino
          ? `${kertaParas(k, true)}`
          : formatWeight(Math.round(kertaParas(k, false) * 10) / 10, yksikko)))))
      : card(el('p', { class: 'muted' }, 'Et ole vielä tehnyt tätä liikettä. Ensimmäisellä kerralla ehdotamme maltillista aloituspainoa.')),
    omat.length ? el('p', { class: 'muted small t8-footnote' }, kehonpaino ? 'Oikealla kerran paras toistomäärä.' : 'Oikealla kerran paras arvioitu maksimi (e1RM).') : null,
    sectionTitle('Ohje'),
    card(el('p', { class: 't8-ohje' }, liike.ohje)),
  );
}

export function render(root, params = {}) {
  const state = getState() || {};
  if (params.id) {
    const l = haeLiike(params.id);
    if (!l) {
      lisaa(root, 
        el('a', { class: 't8-back', href: '#/liikkeet' }, '‹ Liikkeet'),
        el('h1', { class: 'page-title' }, 'Liikettä ei löytynyt'),
        card(el('p', { class: 'muted' }, 'Tätä liikettä ei ole kirjastossa.'), el('a', { class: 'btn btn-primary', href: '#/liikkeet' }, 'Takaisin liikkeisiin')),
      );
      return;
    }
    liikeSivu(root, state, l);
    return;
  }
  lista(root, state);
}
