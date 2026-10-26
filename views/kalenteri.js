// Kalenterivalmentaja (speksi 4l B): viikkonäkymä (edellinen, kuluva ja seuraava viikko) tiiviillä
// aikajanalla klo 6–21, asetukset alalaatikossa, viikon suunnittelu (planWeek → hyväksyntä applyPlan),
// muutos uuden palaverin jälkeen (replan → valinta applyReplan) ja toteutumisaste (completionRate).
// Demossa kalenteri on keksitty; tuotteessa kalenterista luetaan luvalla vain varattu/vapaa-tieto.
//
// Näkymä piirretään statechange-tapahtumasta uudelleen (ei omaPaivitys-lippua). Keskeneräinen
// ehdotus, palaverisimulaatio ja valittu viikko säilyvät moduulin muuttujissa piirtojen välillä ja
// nollataan, kun reitiltä poistutaan.
import { getState, update } from '../store.js?v=19a48e7';
import { tanaanPvm } from '../seed.js?v=19a48e7';
import { el, svgEl, sheet, segmented, whyButton } from './ui.js?v=19a48e7';
import { addDays, daysBetween, weekStart, onVoimatreeni } from '../engine/util.js?v=19a48e7';
import {
  planWeek, applyPlan, replan, applyReplan, completionRate, seuraavaVaraus,
  AIKAIKKUNAT, KALENTERI_OLETUSASETUKSET,
} from '../engine/schedule.js?v=19a48e7';
import { rakennaPaiva, aktiivinenOhjelma } from './paiva.js?v=19a48e7';

export const AIKAJANA_ALKU_H = 6;
export const AIKAJANA_LOPPU_H = 21;
const VKP = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];
const SUOSIKIT = ['aamu', 'lounas', 'ilta', 'viikonloppu'];
const MATKAT = [0, 10, 15, 20, 30];
const AUKEAA = [5, 6, 7, 8, 9, 10];
const SULKEUTUU = [18, 19, 20, 21, 22, 23, 24];
export const PALAVERI_MIN = 60;

export const YKSITYISYYS = 'Tuotteessa luetaan vain varattu/vapaa-tieto luvallasi – ei tapahtumien nimiä.';
export const LISATTY_TEKSTI = 'Lisätty kalenteriin (demo – tuotteessa oikeaan kalenteriisi)';

// --- Puhtaat apurit (testataan) ----------------------------------------------------

function pad(n) {
  return String(n).padStart(2, '0');
}

// 'YYYY-MM-DDTHH:mm' → minuutit vuorokauden alusta (null, jos virheellinen).
export function minuutit(aika) {
  const m = /T(\d{2}):(\d{2})/.exec(String(aika || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// '2026-10-29T17:30' → '17.30'
export function kello(aika) {
  const min = minuutit(aika);
  return min === null ? '' : `${Math.floor(min / 60)}.${pad(min % 60)}`;
}

// '2026-10-29' → 'to 29.10.'
export function paivaTeksti(pvm) {
  const [, m, d] = String(pvm).split('-').map(Number);
  return `${VKP[new Date(`${pvm}T12:00:00Z`).getUTCDay()]} ${d}.${m}.`;
}

function lyhytPvm(pvm) {
  const [, m, d] = String(pvm).split('-').map(Number);
  return `${d}.${m}.`;
}

/**
 * aikajanaSijainti(alkuMin, loppuMin) → { vasen, leveys } prosentteina aikajanalla klo 6–21 tai null,
 * jos väli ei osu aikajanalle. Ulos menevä osa leikataan.
 */
export function aikajanaSijainti(alkuMin, loppuMin, alkuH = AIKAJANA_ALKU_H, loppuH = AIKAJANA_LOPPU_H) {
  const a0 = alkuH * 60;
  const b0 = loppuH * 60;
  const a = Math.max(a0, alkuMin);
  const b = Math.min(b0, loppuMin);
  if (!(b > a)) return null;
  const pituus = b0 - a0;
  return {
    vasen: Math.round(((a - a0) / pituus) * 10000) / 100,
    leveys: Math.round(((b - a) / pituus) * 10000) / 100,
  };
}

/**
 * paivanLohkot(tila, pvm, { ehdotus, palaveri }) → [{ tyyppi: 'varattu'|'treeni'|'ehdotus'|'uusi', alku, loppu, teksti, ... }]
 * Päivän aikajanan lohkot alkuajan mukaan: kalenterin tapahtumat (harmaat), treenivaraukset,
 * hyväksymätön ehdotus ja simuloitu uusi palaveri. Tapahtumien otsikoksi näytetään vain
 * 'Palaveri' tai 'Varattu' (tuotteessa luetaan vain varattu/vapaa-tieto).
 */
export function paivanLohkot(tila, pvm, { ehdotus = null, palaveri = null } = {}) {
  const kal = (tila && tila.kalenteri) || {};
  const lohkot = [];
  for (const t of Array.isArray(kal.tapahtumat) ? kal.tapahtumat : []) {
    if (!t || String(t.alku).slice(0, 10) !== pvm) continue;
    lohkot.push({
      tyyppi: 'varattu',
      alku: t.alku,
      loppu: t.loppu,
      teksti: /palaveri/i.test(t.otsikko || '') ? 'Palaveri' : 'Varattu',
      lisatty: !!t.lisatty,
    });
  }
  for (const v of Array.isArray(kal.varaukset) ? kal.varaukset : []) {
    if (!v || v.pvm !== pvm) continue;
    lohkot.push({
      tyyppi: 'treeni',
      alku: v.alku,
      loppu: v.loppu,
      teksti: v.ohjelmaPaiva || 'Treeni',
      kestoMin: v.kestoMin,
      toteutunut: !!v.toteutunut,
      tiivistetty: !!v.tiivistetty,
      id: v.id,
    });
  }
  for (const e of Array.isArray(ehdotus) ? ehdotus : []) {
    if (!e || e.pvm !== pvm) continue;
    lohkot.push({ tyyppi: 'ehdotus', alku: e.alku, loppu: e.loppu, teksti: e.ohjelmaPaiva || 'Treeni', kestoMin: e.kestoMin });
  }
  if (palaveri && String(palaveri.alku).slice(0, 10) === pvm) {
    lohkot.push({ tyyppi: 'uusi', alku: palaveri.alku, loppu: palaveri.loppu, teksti: 'Uusi palaveri' });
  }
  return lohkot.sort((a, b) => String(a.alku).localeCompare(String(b.alku)));
}

/**
 * simuloituPalaveri(varaus, id, kestoMin = 60, aiemmin = 0) → { id, alku, loppu, otsikko: 'Palaveri' }
 * Palaveri alkaa `aiemmin` minuuttia ennen treenivarausta (oletus: samaan aikaan) ja kestää kestoMin.
 */
export function simuloituPalaveri(varaus, id, kestoMin = PALAVERI_MIN, aiemmin = 0) {
  const pvm = String(varaus.alku).slice(0, 10);
  const a = Math.max(0, minuutit(varaus.alku) - aiemmin);
  const b = Math.min(24 * 60 - 1, a + kestoMin);
  return {
    id,
    alku: `${pvm}T${pad(Math.floor(a / 60))}:${pad(a % 60)}`,
    loppu: `${pvm}T${pad(Math.floor(b / 60))}:${pad(b % 60)}`,
    otsikko: 'Palaveri',
  };
}

/**
 * demoPalaveri(tila, varaus, id, { nyt }) → { palaveri, vaihtoehdot }
 * "Simuloi: uusi palaveri" demossa: palaveri peittää varauksen alun ja jättää samalle päivälle
 * 30–45 minuutin raon, jotta valmentaja tarjoaa heti sekä tiivistyksen että siirron.
 * replan tarjoaa tiivistyksen vain, kun täysimittainen treeni ei enää mahdu samana päivänä mihinkään
 * suosikkiaikaan, mutta pisin vapaa rako (matkoineen) on vähintään 30 min. Siksi kokeillaan lyhimmästä
 * alkaen palavereita, jotka alkavat treenin alussa tai enintään tunnin ennen sitä, ja valitaan
 * ensimmäinen, jolla vaihtoehdoissa on 30–45 min tiivistys ja siirto. Jos sellaista ei löydy
 * (esim. päivä on jo täynnä), käytetään tunnin palaveria treenin alusta.
 */
export function demoPalaveri(tila, varaus, id, { nyt } = {}) {
  let varalla = null;
  // Viikonlopun ikkuna on 9–18, joten pisin tarvittava palaveri on lähes ikkunan mittainen.
  for (let kesto = 30; kesto <= 600; kesto += 15) {
    for (let aiemmin = 0; aiemmin <= 60; aiemmin += 15) {
      const palaveri = simuloituPalaveri(varaus, id, kesto, aiemmin);
      if (minuutit(palaveri.loppu) <= minuutit(varaus.alku)) continue; // ei osu varaukseen
      const vaihtoehdot = replan(tila, varaus.id, palaveri, { nyt });
      const tiivis = vaihtoehdot.find((v) => v.tyyppi === 'tiivistys');
      if (!tiivis || tiivis.kestoMin < 30 || tiivis.kestoMin > 45) continue;
      if (vaihtoehdot.some((v) => v.tyyppi === 'siirto')) return { palaveri, vaihtoehdot };
      if (!varalla) varalla = { palaveri, vaihtoehdot };
    }
  }
  if (varalla) return varalla;
  const palaveri = simuloituPalaveri(varaus, id);
  return { palaveri, vaihtoehdot: replan(tila, varaus.id, palaveri, { nyt }) };
}

/** viikonNimi(siirto) → 'Viime viikko' | 'Tämä viikko' | 'Ensi viikko' */
export function viikonNimi(siirto) {
  if (siirto < 0) return 'Viime viikko';
  if (siirto > 0) return 'Ensi viikko';
  return 'Tämä viikko';
}

/**
 * toteutumaTeksti(rate, siirto) → esim. 'Tällä viikolla 2/3 toteutunut'.
 * Ensi viikolle kerrotaan varausten määrä; ilman varauksia 'ei treenivarauksia'.
 */
export function toteutumaTeksti(rate, siirto = 0) {
  const etuliite = siirto < 0 ? 'Viime viikolla' : siirto > 0 ? 'Ensi viikolla' : 'Tällä viikolla';
  if (!rate || !rate.suunniteltu) return `${etuliite} ei treenivarauksia`;
  if (siirto > 0) return `${etuliite} ${rate.suunniteltu} ${rate.suunniteltu === 1 ? 'treeni' : 'treeniä'} kalenterissa`;
  return `${etuliite} ${rate.teksti}`;
}

/**
 * tiivistettyTreeni(tila, varaus) → { paiva, kestoMin, liikkeitaEnintaan, sarjatEnintaan, ohje, rivit: [{ nimi, sarjat, toistot }] } | null
 * Tiivistetyn varauksen treeni: varauksen ohjelmapäivä rakennaPaiva-logiikalla tiivistetyllä kestolla,
 * liikkeet rajattuna (liikkeitaEnintaan) ja sarjat lyhennettyinä (sarjatEnintaan).
 */
export function tiivistettyTreeni(tila, varaus) {
  const t = varaus && varaus.tiivistetty;
  if (!t || !tila) return null;
  const ohjelma = aktiivinenOhjelma(tila);
  const paivat = ohjelma.paivat || [];
  const i = paivat.findIndex((p) => p.nimi === varaus.ohjelmaPaiva);
  let historia = Array.isArray(tila.historia) ? tila.historia : [];
  if (i >= 0 && paivat.length) {
    // rakennaPaiva valitsee viimeisimmän merkinnän jälkeisen ohjelmapäivän: merkki edellisestä päivästä
    // (ei voimatreeni, ei liikkeitä) valitsee varauksen päivän vaikuttamatta palautumiseen tai painoihin.
    const viimeisin = historia.reduce((m, x) => (x && typeof x.pvm === 'string' && x.pvm > m ? x.pvm : m), varaus.pvm);
    historia = [...historia, {
      id: 'kalenteri-merkki', pvm: viimeisin, aloitus: '￿', tyyppi: 'kalenteri-merkki',
      ohjelmaId: ohjelma.id, paivaNimi: paivat[(i - 1 + paivat.length) % paivat.length].nimi, liikkeet: [],
    }];
  }
  const profiili = { ...(tila.profiili || {}), kesto: t.kestoMin };
  const p = rakennaPaiva({ ...tila, profiili, historia }, `${varaus.pvm}T12:00:00`);
  const rivit = p.rivit
    .filter((r) => r.tyyppi !== 'kesto' && !r.eiVaihtoehtoa)
    .slice(0, t.liikkeitaEnintaan)
    .map((r) => {
      const haarukka = r.tavoite.toistoMin === r.tavoite.toistoMax ? `${r.tavoite.toistoMin}` : `${r.tavoite.toistoMin}–${r.tavoite.toistoMax}`;
      return { nimi: r.liike.nimi, sarjat: Math.min(r.tavoite.sarjat, t.sarjatEnintaan), toistot: haarukka };
    });
  return {
    paiva: p.paiva.nimi,
    kestoMin: t.kestoMin,
    liikkeitaEnintaan: t.liikkeitaEnintaan,
    sarjatEnintaan: t.sarjatEnintaan,
    ohje: t.ohje,
    rivit,
  };
}

// --- Näkymän tila piirtojen välillä ----------------------------------------------------

const alkutila = () => ({
  siirto: 0,          // -1, 0 tai 1 viikkoa nykyisestä
  ehdotus: null,      // { viikonAlku, lista }
  lisatty: null,      // viikonAlku, jolle ehdotus juuri hyväksyttiin
  muutos: null,       // { varausId, palaveri, vaihtoehdot }
  valinta: null,      // { varausId, vaihtoehto }
  paramsAvain: null,  // käsitellyt reittiparametrit (valmentajan "Avaa kalenteri")
});
let nakyma = alkutila();
let palaveriLaskuri = 0;

function siivous() {
  if (!/^#\/kalenteri(\?|$)/.test(location.hash)) nakyma = alkutila();
}

// --- Osat --------------------------------------------------------------------------------

function ikoni(d, koko = 18, leveys = 2) {
  return svgEl('svg', { viewBox: '0 0 24 24', width: koko, height: koko, 'aria-hidden': 'true', class: 'kal-ico' },
    ...[].concat(d).map((x) => svgEl('path', { d: x, fill: 'none', stroke: 'currentColor', 'stroke-width': leveys, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })));
}

const IKONIT = {
  vasen: 'M15 5l-7 7 7 7',
  oikea: 'M9 5l7 7-7 7',
  asetukset: ['M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z',
    'M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.4A7.5 7.5 0 0 0 7 6.4l-2.4-.9-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9a7.5 7.5 0 0 0 2.6 1.5l.4 2.4h4l.4-2.4a7.5 7.5 0 0 0 2.6-1.5l2.4.9 2-3.4z'],
  kipina: 'M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9zM18.5 15.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z',
  lukko: ['M7 11V8a5 5 0 0 1 10 0v3', 'M5.5 11h13v9.5h-13z'],
};

function lohkoNimi(l) {
  if (l.tyyppi === 'treeni') return `Treeni ${l.teksti}${l.toteutunut ? ', toteutunut' : ''}`;
  if (l.tyyppi === 'ehdotus') return `Ehdotus: treeni ${l.teksti}`;
  return l.teksti;
}

/**
 * lohkoTeksti(lohko) → aikajanan palkin teksti. Treeneille ohjelmapäivän tunnus (esim. 'B', toteutunut '✓ B');
 * varauksille koko sana vain, kun palkki on vähintään 2,5 tuntia (tiivis aikajana), muuten tyhjä.
 * nakyvaMin: palkin näkyvä pituus minuutteina (aikajanan reunalla leikattu), oletuksena koko kesto.
 */
export function lohkoTeksti(l, nakyvaMin) {
  const kesto = Number.isFinite(nakyvaMin) ? nakyvaMin : (minuutit(l.loppu) ?? 0) - (minuutit(l.alku) ?? 0);
  if (l.tyyppi === 'treeni' || l.tyyppi === 'ehdotus') {
    const tunnus = String(l.teksti || '').replace(/^Päivä\s+/, '');
    if (kesto < 30) return '';
    return l.toteutunut ? (kesto >= 60 && tunnus.length <= 2 ? `✓ ${tunnus}` : '✓') : (tunnus.length <= 3 || kesto >= 120 ? tunnus : '');
  }
  return kesto >= 150 ? l.teksti : '';
}

function aikajana(lohkot, { tanaan, pvm, nytMin }) {
  const osat = [];
  for (const l of lohkot) {
    const s = aikajanaSijainti(minuutit(l.alku), minuutit(l.loppu));
    if (!s) continue;
    const luokka = l.tyyppi === 'treeni' ? `is-workout${l.toteutunut ? ' is-done' : ''}`
      : l.tyyppi === 'ehdotus' ? 'is-proposal' : l.tyyppi === 'uusi' ? 'is-new' : 'is-busy';
    const teksti = lohkoTeksti(l, Math.round((s.leveys / 100) * (AIKAJANA_LOPPU_H - AIKAJANA_ALKU_H) * 60));
    osat.push(el('span', {
      class: `kal-block ${luokka}`,
      style: `left:${s.vasen}%;width:${s.leveys}%`,
      title: `${lohkoNimi(l)} ${kello(l.alku)}–${kello(l.loppu)}`,
    }, teksti ? el('span', { class: 'kal-block-text' }, teksti) : null));
  }
  if (pvm === tanaan && nytMin !== null) {
    const s = aikajanaSijainti(nytMin, nytMin + 1);
    if (s) osat.push(el('span', { class: 'kal-now', style: `left:${s.vasen}%` }));
  }
  const kuvaus = lohkot.length
    ? lohkot.map((l) => `${lohkoNimi(l)} ${kello(l.alku)}–${kello(l.loppu)}`).join(', ')
    : 'vapaata';
  return el('div', { class: 'kal-bar', role: 'img', 'aria-label': `${paivaTeksti(pvm)}: ${kuvaus}` }, osat);
}

function asteikko() {
  const tunnit = [];
  for (let h = AIKAJANA_ALKU_H; h <= AIKAJANA_LOPPU_H; h += 3) tunnit.push(h);
  return el('div', { class: 'kal-scale', 'aria-hidden': 'true' },
    tunnit.map((h) => {
      const vasen = ((h - AIKAJANA_ALKU_H) / (AIKAJANA_LOPPU_H - AIKAJANA_ALKU_H)) * 100;
      return el('span', { class: 'kal-scale-h', style: `left:${vasen}%` }, String(h));
    }));
}

function paivanInfo(lohkot, treenattu) {
  const treenit = lohkot.filter((l) => l.tyyppi === 'treeni' || l.tyyppi === 'ehdotus');
  if (treenit.length) {
    const l = treenit[0];
    return el('span', { class: `kal-day-info${l.tyyppi === 'ehdotus' ? ' is-proposal' : ''}${l.toteutunut ? ' is-done' : ''}` },
      `${kello(l.alku)} · ${l.teksti}${Number.isFinite(l.kestoMin) ? ` · ${l.kestoMin} min` : ''}${l.toteutunut ? ' ✓' : ''}${l.tyyppi === 'ehdotus' ? ' (ehdotus)' : ''}`);
  }
  if (treenattu) return el('span', { class: 'kal-day-info is-done' }, 'Treenattu ✓');
  return null;
}

function viikkoRuudukko(state, { alku, tanaan, nytMin }) {
  const treenipaivat = new Set((state.historia || []).filter((t) => t && onVoimatreeni(t)).map((t) => t.pvm));
  const ehdotus = nakyma.ehdotus && nakyma.ehdotus.viikonAlku === alku ? nakyma.ehdotus.lista : null;
  const palaveri = nakyma.muutos ? nakyma.muutos.palaveri : null;
  const paivat = Array.from({ length: 7 }, (_, i) => {
    const pvm = addDays(alku, i);
    const lohkot = paivanLohkot(state, pvm, { ehdotus, palaveri });
    return el('li', { class: `kal-day${pvm === tanaan ? ' is-today' : ''}${pvm < tanaan ? ' is-past' : ''}` },
      el('div', { class: 'kal-day-head' },
        el('span', { class: 'kal-day-name' }, paivaTeksti(pvm), pvm === tanaan ? el('span', { class: 'kal-today-tag' }, 'tänään') : null),
        paivanInfo(lohkot, treenipaivat.has(pvm))),
      aikajana(lohkot, { tanaan, pvm, nytMin }));
  });
  return el('section', { class: 'card kal-week' },
    asteikko(),
    el('ol', { class: 'kal-days' }, paivat),
    el('div', { class: 'kal-legend', 'aria-hidden': 'true' },
      el('span', { class: 'kal-legend-item' }, el('span', { class: 'kal-swatch is-busy' }), 'Varattu'),
      el('span', { class: 'kal-legend-item' }, el('span', { class: 'kal-swatch is-workout' }), 'Treeni'),
      ehdotus ? el('span', { class: 'kal-legend-item' }, el('span', { class: 'kal-swatch is-proposal' }), 'Ehdotus') : null,
      palaveri ? el('span', { class: 'kal-legend-item' }, el('span', { class: 'kal-swatch is-new' }), 'Uusi palaveri') : null));
}

function valmentajaOtsikko(teksti) {
  return el('div', { class: 'kal-coach-head' },
    el('span', { class: 'kal-coach-avatar', 'aria-hidden': 'true' }, ikoni(IKONIT.kipina, 16)),
    el('span', { class: 't8-eyebrow t8-eyebrow-accent' }, teksti));
}

function asetuksetOf(state) {
  const a = (state.kalenteri && state.kalenteri.asetukset) || {};
  return {
    suosikkiajat: Array.isArray(a.suosikkiajat) ? a.suosikkiajat.filter((s) => AIKAIKKUNAT[s]) : [...KALENTERI_OLETUSASETUKSET.suosikkiajat],
    aukiolo: a.aukiolo && Number.isFinite(a.aukiolo.alku) && Number.isFinite(a.aukiolo.loppu) ? { ...a.aukiolo } : { ...KALENTERI_OLETUSASETUKSET.aukiolo },
    matkaMin: Number.isFinite(a.matkaMin) ? a.matkaMin : KALENTERI_OLETUSASETUKSET.matkaMin,
  };
}

// --- Toiminnot ----------------------------------------------------------------------------

function nytIso() {
  return new Date().toISOString();
}

function suunnittele(alku) {
  nakyma.ehdotus = { viikonAlku: alku, lista: planWeek(getState(), alku, { nyt: nytIso() }) };
  nakyma.lisatty = null;
  nakyma.valinta = null;
}

function tallennaAsetukset(muutos) {
  update((s) => {
    const kal = s.kalenteri && typeof s.kalenteri === 'object' ? s.kalenteri : { tapahtumat: [], varaukset: [] };
    s.kalenteri = { ...kal, asetukset: { ...asetuksetOf(s), ...muutos } };
  });
  // Auki oleva ehdotus lasketaan heti uusilla asetuksilla (piirto tapahtuu statechangesta).
  if (nakyma.ehdotus) suunnittele(nakyma.ehdotus.viikonAlku);
}

function avaaAsetukset() {
  const state = getState();
  const a = asetuksetOf(state);
  const profiili = state.profiili || {};
  let suosikit = [...a.suosikkiajat];

  const sirut = SUOSIKIT.map((id) => {
    const w = AIKAIKKUNAT[id];
    const nappi = el('button', {
      class: 'chip kal-fav', type: 'button', 'aria-pressed': String(suosikit.includes(id)),
      onClick: () => {
        suosikit = suosikit.includes(id) ? suosikit.filter((x) => x !== id) : SUOSIKIT.filter((x) => x === id || suosikit.includes(x));
        nappi.setAttribute('aria-pressed', String(suosikit.includes(id)));
        tallennaAsetukset({ suosikkiajat: suosikit });
      },
    }, w.nimi, el('span', { class: 'kal-fav-time' }, `${w.alku / 60}–${w.loppu / 60}`));
    return nappi;
  });

  const valinta = (arvot, nykyinen, nimi, onChange) => el('label', { class: 'kal-select' },
    el('span', { class: 'kal-select-label' }, nimi),
    el('select', { class: 'kal-select-input', onChange: (e) => onChange(Number(e.target.value)) },
      arvot.map((h) => el('option', { value: String(h), selected: h === nykyinen }, `klo ${h}`))));
  let aukiolo = { ...a.aukiolo };

  sheet(el('div', { class: 'kal-sheet' },
    el('h2', { class: 'sheet-title' }, 'Kalenterin asetukset'),
    el('p', { class: 'muted small' }, 'Valmentaja sijoittaa treenit näiden mukaan. Muutos päivittää ehdotuksen heti.'),
    el('h3', { class: 'kal-sheet-h' }, 'Suosikkiajat'),
    el('div', { class: 'chips kal-favs', role: 'group', 'aria-label': 'Suosikkiajat' }, sirut),
    el('h3', { class: 'kal-sheet-h' }, 'Salin aukiolo'),
    el('div', { class: 'kal-selects' },
      valinta(AUKEAA, aukiolo.alku, 'Avautuu', (v) => { aukiolo = { ...aukiolo, alku: v }; tallennaAsetukset({ aukiolo }); }),
      valinta(SULKEUTUU, aukiolo.loppu, 'Sulkeutuu', (v) => { aukiolo = { ...aukiolo, loppu: v }; tallennaAsetukset({ aukiolo }); })),
    el('h3', { class: 'kal-sheet-h' }, 'Matka-aika salille (suuntaansa)'),
    segmented({
      vaihtoehdot: MATKAT.map((m) => ({ arvo: m, teksti: `${m} min` })),
      arvo: MATKAT.includes(a.matkaMin) ? a.matkaMin : null,
      label: 'Matka-aika salille',
      onChange: (v) => tallennaAsetukset({ matkaMin: v }),
    }),
    el('h3', { class: 'kal-sheet-h' }, 'Treenit viikossa'),
    el('div', { class: 'kal-profile-row' },
      el('span', null, `${Number.isFinite(profiili.treenitViikossa) ? profiili.treenitViikossa : 3} treeniä · ${Number.isFinite(profiili.kesto) ? profiili.kesto : 60} min`),
      el('a', { class: 'kal-link', href: '#/profiili' }, 'Muuta Profiilissa ›')),
    el('p', { class: 'muted small kal-sheet-note' }, 'Treenien määrä ja kesto luetaan profiilistasi.')),
  { label: 'Kalenterin asetukset' });
}

function viikonAlkuAsetus(state) {
  return state && state.profiili && state.profiili.viikonAlku === 'sunnuntai' ? 'sunnuntai' : 'maanantai';
}

// Viikkosiirto (-1…1) kuluvasta viikosta pvm:n viikkoon.
function siirtoPaivaan(state, pvm) {
  const asetus = viikonAlkuAsetus(state);
  const tama = weekStart(tanaanPvm(nytIso()), asetus);
  return Math.max(-1, Math.min(1, Math.round(daysBetween(tama, weekStart(pvm, asetus)) / 7)));
}

function simuloiPalaveri(varaus) {
  palaveriLaskuri += 1;
  const state = getState();
  const { palaveri, vaihtoehdot } = demoPalaveri(state, varaus, `palaveri-${Date.now().toString(36)}-${palaveriLaskuri}`, { nyt: nytIso() });
  nakyma.muutos = { varausId: varaus.id, palaveri, vaihtoehdot, varaus: { ...varaus } };
  nakyma.valinta = null;
  nakyma.ehdotus = null;
  nakyma.lisatty = null;
  nakyma.siirto = siirtoPaivaan(state, varaus.pvm);
}

function valitseVaihtoehto(vaihtoehto) {
  const m = nakyma.muutos;
  if (!m) return;
  nakyma.muutos = null;
  nakyma.valinta = { varausId: m.varausId, vaihtoehto };
  update((s) => applyReplan(s, m.varausId, m.palaveri, vaihtoehto));
}

// --- Kortit -----------------------------------------------------------------------------

function vaihtoehtoKortti(v) {
  const tiivis = v.tyyppi === 'tiivistys';
  return el('li', { class: `kal-option${tiivis ? ' is-compact' : ''}` },
    el('div', { class: 'kal-option-head' },
      el('span', { class: 'kal-option-type' }, tiivis ? 'Tiivistetty treeni' : 'Uusi aika'),
      el('span', { class: 'kal-option-time' }, `${paivaTeksti(v.pvm)} ${kello(v.alku)}–${kello(v.loppu)} · ${v.kestoMin} min`)),
    el('p', { class: 'kal-option-why' }, v.perustelu),
    el('button', { class: `btn ${tiivis ? '' : 'kal-btn-accent '}kal-option-btn`, type: 'button', onClick: () => valitseVaihtoehto(v) },
      tiivis ? 'Valitse tiivistys' : 'Valitse siirto'));
}

function muutosKortti(m) {
  const v = m.varaus;
  const peru = el('button', { class: 'btn btn-ghost kal-cancel', type: 'button', onClick: () => { nakyma.muutos = null; paivita(); } }, 'Peru simulaatio');
  return el('section', { class: 'card kal-coach', 'aria-live': 'polite' },
    valmentajaOtsikko('Valmentaja'),
    el('p', { class: 'kal-coach-text' },
      `Uusi palaveri ${paivaTeksti(v.pvm)} klo ${kello(m.palaveri.alku)}–${kello(m.palaveri.loppu)} osuu treenisi (${v.ohjelmaPaiva || 'treeni'}) päälle. `,
      m.vaihtoehdot.length ? (m.vaihtoehdot.length > 1 ? 'Valitse, kumpi sopii paremmin:' : 'Ehdotan tätä:') : ''),
    m.vaihtoehdot.length
      ? el('ul', { class: 'kal-options' }, m.vaihtoehdot.map(vaihtoehtoKortti))
      : el('p', { class: 'kal-empty' }, 'En löytänyt uutta aikaa samalle päivälle enkä seuraaville päiville. Kokeile muuttaa asetuksia: lisää suosikkiaikoja tai lyhennä matka-aikaa.',
        el('button', { class: 'btn kal-settings-inline', type: 'button', onClick: avaaAsetukset }, 'Muuta asetuksia')),
    peru);
}

function valintaKortti(state, valinta) {
  const varaukset = (state.kalenteri && state.kalenteri.varaukset) || [];
  const v = varaukset.find((x) => x && x.id === valinta.varausId);
  if (!v) return null;
  const sulje = el('button', { class: 'btn btn-ghost kal-cancel', type: 'button', onClick: () => { nakyma.valinta = null; paivita(); } }, 'Selvä');
  if (valinta.vaihtoehto.tyyppi !== 'tiivistys') {
    return el('section', { class: 'card kal-coach is-done', role: 'status' },
      valmentajaOtsikko('Kalenteri päivitetty'),
      el('p', { class: 'kal-coach-text' }, `Treeni siirretty: ${paivaTeksti(v.pvm)} klo ${kello(v.alku)}–${kello(v.loppu)} · ${v.ohjelmaPaiva || 'treeni'}\u00a0✓`),
      el('p', { class: 'muted small' }, 'Palaveri lisättiin kalenteriin, ja treenin varaus siirtyi (demo).'),
      sulje);
  }
  let t = null;
  try {
    t = tiivistettyTreeni(state, v);
  } catch (err) {
    console.error(err);
  }
  return el('section', { class: 'card kal-coach is-done', role: 'status' },
    valmentajaOtsikko('Tiivistetty treeni'),
    el('p', { class: 'kal-coach-text' }, `${paivaTeksti(v.pvm)} klo ${kello(v.alku)}–${kello(v.loppu)} · ${v.ohjelmaPaiva || 'treeni'} · ${v.kestoMin}\u00a0min\u00a0✓`),
    t ? el('p', { class: 'kal-compact-rule' }, `Liikkeitä enintään ${t.liikkeitaEnintaan} ja sarjoja enintään ${t.sarjatEnintaan} per liike.`) : null,
    t && t.rivit.length ? el('ol', { class: 'kal-compact-list' }, t.rivit.map((r) => el('li', null,
      el('span', { class: 'kal-compact-name' }, r.nimi),
      el('span', { class: 'kal-compact-sets' }, `${r.sarjat} × ${r.toistot}`)))) : null,
    t ? el('p', { class: 'muted small' }, t.ohje) : null,
    sulje);
}

function varausRivi(v) {
  const tila = v.toteutunut ? 'Toteutunut ✓' : v.tiivistetty ? 'Tiivistetty' : v.siirretty ? 'Siirretty' : null;
  return el('li', { class: `kal-res${v.toteutunut ? ' is-done' : ''}` },
    el('span', { class: 'kal-res-main' },
      el('span', { class: 'kal-res-time' }, `${paivaTeksti(v.pvm)} ${kello(v.alku)}–${kello(v.loppu)}`),
      el('span', { class: 'kal-res-name' }, `${v.ohjelmaPaiva || 'Treeni'} · ${v.kestoMin} min`)),
    tila ? el('span', { class: `kal-res-pill${v.toteutunut ? ' is-ok' : ''}` }, tila) : null);
}

function suunnitelmaKortti(state, { alku, siirto, nyt }) {
  const loppu = addDays(alku, 6);
  const varaukset = ((state.kalenteri && state.kalenteri.varaukset) || []).filter((v) => v && v.pvm >= alku && v.pvm <= loppu);
  const osat = [el('h2', { class: 'kal-card-title' }, 'Viikon treenit kalenterissa')];

  if (siirto < 0) {
    osat.push(varaukset.length
      ? el('ul', { class: 'kal-res-list' }, varaukset.map(varausRivi))
      : el('p', { class: 'muted' }, 'Viime viikolle ei ollut treenivarauksia.'));
    return el('section', { class: 'card kal-plan' }, osat);
  }

  const ehdotus = nakyma.ehdotus && nakyma.ehdotus.viikonAlku === alku ? nakyma.ehdotus.lista : null;
  if (ehdotus) {
    if (!ehdotus.length) {
      osat.push(el('div', { class: 'kal-empty', role: 'status' },
        el('p', null, `${siirto > 0 ? 'Ensi viikolle' : 'Tälle viikolle'} ei löytynyt vapaata rakoa, johon treeni ja matkat mahtuvat.`),
        el('p', null, 'Kokeile muuttaa asetuksia: lisää suosikkiaikoja, pidennä salin aukioloa tai lyhennä matka-aikaa.'),
        el('button', { class: 'btn kal-settings-inline', type: 'button', onClick: avaaAsetukset }, 'Muuta asetuksia'),
        el('button', { class: 'btn btn-ghost kal-cancel', type: 'button', onClick: () => { nakyma.ehdotus = null; paivita(); } }, 'Sulje')));
      return el('section', { class: 'card kal-plan' }, osat);
    }
    osat.push(
      valmentajaOtsikko(`Ehdotus · ${ehdotus.length} ${ehdotus.length === 1 ? 'treeni' : 'treeniä'}`),
      el('ul', { class: 'kal-proposals' }, ehdotus.map((e) => el('li', { class: 'kal-proposal' },
        el('div', { class: 'kal-proposal-head' },
          el('span', { class: 'kal-proposal-time' }, `${paivaTeksti(e.pvm)} ${kello(e.alku)}–${kello(e.loppu)}`),
          el('span', { class: 'kal-proposal-name' }, `${e.ohjelmaPaiva} · ${e.kestoMin} min`)),
        el('p', { class: 'kal-proposal-why' }, e.perustelu)))),
      el('button', {
        class: 'btn btn-primary kal-accept', type: 'button',
        onClick: () => {
          const lista = ehdotus;
          nakyma.ehdotus = null;
          nakyma.lisatty = alku;
          update((s) => applyPlan(s, lista));
        },
      }, 'Hyväksy ja lisää kalenteriin'),
      el('button', { class: 'btn btn-ghost kal-cancel', type: 'button', onClick: () => { nakyma.ehdotus = null; paivita(); } }, 'Peru'));
    return el('section', { class: 'card kal-plan' }, osat);
  }

  if (nakyma.lisatty === alku) {
    osat.push(el('div', { class: 'kal-added', role: 'status' }, `${LISATTY_TEKSTI} ✓`));
  }
  if (varaukset.length) {
    osat.push(el('ul', { class: 'kal-res-list' }, varaukset.map(varausRivi)));
  } else {
    osat.push(el('p', { class: 'muted kal-plan-intro' }, 'Valmentaja etsii kalenteristasi vapaat raot treeneille suosikkiaikojesi mukaan ja jättää lepopäivän saman lihasryhmän treenien väliin.'));
  }
  const seuraava = seuraavaVaraus(state, nyt);
  osat.push(el('div', { class: 'kal-actions' },
    el('button', {
      class: varaukset.length ? 'btn kal-btn-secondary' : 'btn btn-primary', type: 'button',
      onClick: () => { suunnittele(alku); paivita(); },
    }, varaukset.length ? 'Suunnittele uudelleen' : 'Suunnittele viikko'),
    seuraava && seuraava.pvm >= alku && seuraava.pvm <= loppu
      ? el('button', { class: 'btn kal-btn-secondary kal-simulate', type: 'button', onClick: () => { simuloiPalaveri(seuraava); paivita(); } },
        'Simuloi: uusi palaveri')
      : null));
  return el('section', { class: 'card kal-plan' }, osat);
}

// --- Näkymä ----------------------------------------------------------------------------

let paivitaFn = null;
function paivita() {
  if (paivitaFn) paivitaFn();
}

export function render(root, params = {}) {
  const state = getState() || {};
  const nyt = nytIso();
  const tanaan = tanaanPvm(nyt);
  const tamaAlku = weekStart(tanaan, viikonAlkuAsetus(state));

  // Valmentajan "Avaa kalenteri": viikko ja valmis ehdotus (käsitellään kerran).
  const avain = params && (params.viikko || params.ehdota) ? `${params.viikko || ''}|${params.ehdota || ''}` : null;
  if (avain && avain !== nakyma.paramsAvain) {
    nakyma.paramsAvain = avain;
    if (params.viikko && /^\d{4}-\d{2}-\d{2}$/.test(params.viikko)) nakyma.siirto = siirtoPaivaan(state, params.viikko);
    if (params.ehdota && nakyma.siirto >= 0) suunnittele(addDays(tamaAlku, nakyma.siirto * 7));
  }

  const siirto = nakyma.siirto;
  const alku = addDays(tamaAlku, siirto * 7);
  const loppu = addDays(alku, 6);
  const d = new Date(nyt);
  const nytMin = d.getHours() * 60 + d.getMinutes();
  const rate = completionRate(state, alku);

  const vaihda = (n) => {
    nakyma.siirto = Math.max(-1, Math.min(1, nakyma.siirto + n));
    paivita();
  };

  // Natiivi append ei ohita null-arvoja, joten puuttuvat osat suodatetaan pois.
  root.append(...[
    el('a', { class: 't8-back', href: '#/koti' }, '‹ Koti'),
    el('div', { class: 'kal-title-row' },
      el('h1', { class: 'page-title kal-title' }, 'Kalenteri'),
      el('button', { class: 'kal-gear', type: 'button', 'aria-label': 'Kalenterin asetukset', onClick: avaaAsetukset, dataset: { kohdistus: 'kal-asetukset' } },
        ikoni(IKONIT.asetukset, 22, 1.8), el('span', null, 'Asetukset'))),
    el('p', { class: 'muted kal-sub' }, 'Valmentaja sovittaa treenit kalenterisi vapaisiin rakoihin.'),
    el('section', { class: 'card kal-nav' },
      el('button', { class: 'kal-nav-btn', type: 'button', 'aria-label': 'Edellinen viikko', disabled: siirto <= -1, onClick: () => vaihda(-1) }, ikoni(IKONIT.vasen, 20, 2.4)),
      el('div', { class: 'kal-nav-mid' },
        el('span', { class: 'kal-nav-title' }, viikonNimi(siirto)),
        el('span', { class: 'kal-nav-range' }, `${lyhytPvm(alku)}–${lyhytPvm(loppu)}`)),
      el('button', { class: 'kal-nav-btn', type: 'button', 'aria-label': 'Seuraava viikko', disabled: siirto >= 1, onClick: () => vaihda(1) }, ikoni(IKONIT.oikea, 20, 2.4))),
    el('div', { class: 'kal-rate', role: 'status' },
      el('span', { class: 'kal-rate-text' }, toteutumaTeksti(rate, siirto)),
      rate.suunniteltu && siirto <= 0
        ? el('span', { class: 'kal-rate-bar', 'aria-hidden': 'true' }, el('span', { class: 'kal-rate-fill', style: `width:${rate.pros}%` }))
        : null),
    nakyma.muutos ? muutosKortti(nakyma.muutos) : null,
    !nakyma.muutos && nakyma.valinta ? valintaKortti(state, nakyma.valinta) : null,
    viikkoRuudukko(state, { alku, tanaan, nytMin }),
    nakyma.muutos ? null : suunnitelmaKortti(state, { alku, siirto, nyt }),
    el('div', { class: 'note kal-privacy' },
      el('span', { class: 'kal-privacy-ico' }, ikoni(IKONIT.lukko, 18)),
      el('span', null, YKSITYISYYS, ' ', whyButton('Demossa kalenterin tapahtumat ovat keksittyjä esimerkkejä.\n\nTuotteessa kalenteri yhdistetään luvallasi, ja siitä luetaan vain, milloin olet varattu ja milloin vapaa. Tapahtumien nimiä, osallistujia tai sisältöä ei lueta eikä tallenneta.\n\nHyväksytyt treenit kirjoitetaan kalenteriisi omina tapahtuminaan.'))),
  ].filter(Boolean));

  // Paikalliset muutokset (viikon vaihto, ehdotus, simulaatio) piirretään uudelleen samaan juureen.
  paivitaFn = () => {
    if (!root.isConnected) return;
    const y = window.scrollY;
    root.replaceChildren();
    render(root, {});
    window.scrollTo(0, y);
  };
  return () => {
    paivitaFn = null;
    siivous();
  };
}
