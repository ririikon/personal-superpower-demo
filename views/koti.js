// Koti (speksi 6.1, 4d, 4h): tervehdys, tämän päivän treeni, viikkonauha, viikkotavoite,
// muistirivi, progressiovinkki, valmentaja-, ohjelma- ja ravintokortit.
import { getState } from '../store.js';
import { tanaanPvm } from '../seed.js';
import { LIIKKEET } from '../data.js';
import { el, svgEl, card, sectionTitle, hexRing, whyButton, formatWeight } from './ui.js';
import { weeklyTargets, weeklyProgress } from '../engine/targets.js';
import { recovery } from '../engine/recovery.js';
import { suggestNextSet } from '../engine/progression.js';
import { weekStart, addDays } from '../engine/util.js';
import { rakennaPaiva } from './paiva.js';

// Natiivi append ei litistä taulukoita eikä ohita null-arvoja, joten ne käsitellään tässä.
function lisaa(root, ...osat) {
  root.append(...osat.flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false));
}

const RYHMA_NIMI = { tyonnot: 'Työnnöt', vedot: 'Vedot', jalat: 'Jalat' };
const RYHMA_VARI = { tyonnot: 'var(--push)', vedot: 'var(--pull)', jalat: 'var(--legs)' };
const VIIKONPAIVAT = ['Su', 'Ma', 'Ti', 'Ke', 'To', 'Pe', 'La'];
const VIIKONPAIVAT_PITKA = ['Sunnuntai', 'Maanantai', 'Tiistai', 'Keskiviikko', 'Torstai', 'Perjantai', 'Lauantai'];
const VINKKI_JARJESTYS = ['double-progression', 'deload', 'recovery', 'hold', 'rir-high', 'rir-zero', 'first-time'];
const VINKKI_OTSIKKO = {
  'double-progression': 'Aika nostaa painoa',
  deload: 'Kevennyksen paikka',
  recovery: 'Anna lihaksen palautua',
  hold: 'Tavoitteena yksi toisto lisää',
  'rir-high': 'Kuorma oli kevyt',
  'rir-zero': 'Jätä toisto varalle',
  'first-time': 'Uusi liike tänään',
};

const iso = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const viikonpaiva = (pvm) => new Date(pvm + 'T12:00:00Z').getUTCDay();
const pv = (pvm) => `${Number(pvm.slice(8, 10))}.${Number(pvm.slice(5, 7))}.`;

function ikoni(d, koko = 22) {
  return svgEl('svg', { viewBox: '0 0 24 24', width: koko, height: koko, 'aria-hidden': 'true', class: 't8-ico' },
    svgEl('path', { d, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

function chevron() {
  return svgEl('svg', { class: 'chevron', viewBox: '0 0 8 14', width: 8, height: 14, 'aria-hidden': 'true' },
    svgEl('path', { d: 'M1.5 1.5 6.5 7l-5 5.5', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

// Suunnitelma, jonka päivät osuvat viikkoon [alku, alku + 7).
function suunnitelmaViikolle(suunnitelmat, alku) {
  const loppu = addDays(alku, 7);
  return suunnitelmat.find((s) => s && s.viikonAlku === alku)
    || suunnitelmat.find((s) => s && (s.paivat || []).some((p) => p.pvm >= alku && p.pvm < loppu))
    || null;
}

function voimassa(m, tanaan) {
  return m && (!m.voimassaAlku || m.voimassaAlku <= tanaan) && (!m.voimassaLoppu || tanaan <= m.voimassaLoppu);
}

// --- Osiot -----------------------------------------------------------------

function ylarivi(profiili, tanaan) {
  const nimi = (profiili.nimi || '').trim() || 'Demokäyttäjä';
  const tunti = new Date().getHours();
  const tervehdys = tunti < 10 ? 'Huomenta' : tunti < 17 ? 'Hei' : 'Iltaa';
  const nimikirjain = nimi.charAt(0).toUpperCase();
  return el('header', { class: 't8-home-head' },
    el('div', { class: 't8-home-greet' },
      el('div', { class: 't8-eyebrow' }, `${VIIKONPAIVAT_PITKA[viikonpaiva(tanaan)]} ${pv(tanaan)}`),
      el('h1', { class: 'page-title t8-home-title' }, `${tervehdys}, ${nimi}`)),
    el('a', { class: 't8-avatar', href: '#/profiili', 'aria-label': 'Profiili ja asetukset' }, nimikirjain));
}

// Tuleva muisti: alkaa myöhemmin kuin tänään (esim. valmentajan ensi viikon reissumuisti).
function tuleva(m, tanaan) {
  return m && m.voimassaAlku && m.voimassaAlku > tanaan;
}

function muistirivi(m, tulossa) {
  return el('a', { class: `t8-memory${tulossa ? ' t8-memory-tulossa' : ''}`, href: '#/valmentaja' },
    el('span', { class: 't8-memory-ico' }, ikoni('M12 3.5a6 6 0 0 0-3.5 10.9V17h7v-2.6A6 6 0 0 0 12 3.5zM9.5 20.5h5', 16)),
    el('span', { class: 't8-memory-text' }, m.teksti),
    tulossa
      ? el('span', { class: 't8-memory-tag' }, 'Tulossa', el('span', { class: 't8-memory-date' }, ` ${pv(m.voimassaAlku)}`))
      : el('span', { class: 't8-memory-tag' }, m.tyyppi === 'pysyvä' ? 'Muisti' : 'Voimassa'));
}

function muistirivit(muistit, tanaan) {
  const lista = muistit.filter((m) => voimassa(m, tanaan) && m.teksti);
  lista.sort((a, b) => (a.tyyppi === 'tilapäinen' ? 0 : 1) - (b.tyyppi === 'tilapäinen' ? 0 : 1));
  const tulevat = muistit.filter((m) => tuleva(m, tanaan) && m.teksti)
    .sort((a, b) => String(a.voimassaAlku).localeCompare(String(b.voimassaAlku)));
  if (!lista.length && !tulevat.length) return null;
  return el('div', { class: 't8-memory-list' },
    lista.slice(0, 2).map((m) => muistirivi(m, false)),
    tulevat.slice(0, 2).map((m) => muistirivi(m, true)));
}

// p = rakennaPaiva(): samat liikkeet, sarjat, toistot ja kesto kuin Treenin aloituksessa.
function treeniKortti({ p, tanaan, historia, kaynnissa, suunnitelmaTanaan }) {
  const { ohjelma, paiva } = p;
  const treenattuTanaan = historia.some((t) => t.pvm === tanaan && (t.tyyppi == null || t.tyyppi === 'voima'));
  const otsikko = treenattuTanaan ? 'Seuraava treeni' : 'Tämän päivän treeni';
  const lista = el('ol', { class: 't8-today-list' }, p.rivit.map((r, i) => el('li', { class: 't8-today-item' },
    el('span', { class: 't8-today-num' }, String(i + 1)),
    el('span', { class: 't8-today-name' }, r.liike.nimi),
    el('span', { class: 't8-today-sets' }, `${r.tavoite.sarjat} × ${r.tavoite.toistoMin}–${r.tavoite.toistoMax}`))));
  let suunnitelmaHuomio = null;
  if (suunnitelmaTanaan && suunnitelmaTanaan.tyyppi && suunnitelmaTanaan.tyyppi !== 'treeni') {
    const teksti = suunnitelmaTanaan.tyyppi === 'laji'
      ? `Suunnitelmassa tänään: ${iso(suunnitelmaTanaan.laji || 'laji')}`
      : suunnitelmaTanaan.tyyppi === 'matka' ? 'Suunnitelmassa tänään: matkapäivä' : 'Suunnitelmassa tänään: lepo';
    suunnitelmaHuomio = el('div', { class: 't8-today-plan' }, teksti);
  }
  return el('section', { class: 'card t8-hero' },
    el('div', { class: 't8-hero-top' },
      el('span', { class: 't8-eyebrow t8-eyebrow-accent' }, otsikko),
      treenattuTanaan ? el('span', { class: 't8-pill t8-pill-ok' }, 'Tänään treenattu') : null),
    el('h2', { class: 't8-hero-title' }, paiva.nimi),
    el('div', { class: 't8-hero-meta' },
      el('span', null, ohjelma.nimi),
      el('span', { class: 't8-dot-sep', 'aria-hidden': 'true' }, '·'),
      el('span', null, `${p.rivit.length} liikettä`),
      el('span', { class: 't8-dot-sep', 'aria-hidden': 'true' }, '·'),
      el('span', null, `noin ${p.arvioMin} min`)),
    suunnitelmaHuomio,
    lista,
    el('a', { class: 'btn btn-primary t8-hero-btn', href: '#/treeni' },
      svgEl('svg', { viewBox: '0 0 24 24', width: 20, height: 20, 'aria-hidden': 'true' }, svgEl('path', { d: 'M8 5.5v13l10.5-6.5z', fill: 'currentColor' })),
      kaynnissa ? 'Jatka treeniä' : 'Aloita treeni'));
}

function viikkonauha({ otsikko, alku, tanaan, historia, suunnitelma, oikea }) {
  const solut = [];
  for (let i = 0; i < 7; i += 1) {
    const pvm = addDays(alku, i);
    const merkinnat = historia.filter((t) => t.pvm === pvm);
    const voima = merkinnat.some((t) => t.tyyppi == null || t.tyyppi === 'voima');
    const tuotu = !voima && merkinnat.length > 0;
    const sp = suunnitelma ? (suunnitelma.paivat || []).find((p) => p.pvm === pvm) : null;
    let alle = null;
    if (sp && sp.tyyppi === 'laji') alle = el('span', { class: 't8-week-tag t8-week-tag-laji' }, iso(sp.laji || 'Laji'));
    else if (sp && sp.tyyppi === 'matka') alle = el('span', { class: 't8-week-tag' }, 'Matka');
    let piste = null;
    if (voima) piste = el('span', { class: 't8-week-dot' });
    else if (tuotu) piste = el('span', { class: 't8-week-dot t8-week-dot-tuotu' });
    else if (sp && sp.tyyppi === 'treeni' && pvm >= tanaan) piste = el('span', { class: 't8-week-dot t8-week-dot-plan' });
    const tila = [voima ? 'treeni' : tuotu ? 'aktiviteetti' : '', sp && sp.tyyppi === 'laji' ? iso(sp.laji || 'laji') : '', sp && sp.tyyppi === 'matka' ? 'matka' : '']
      .filter(Boolean).join(', ');
    solut.push(el('div', {
      class: `t8-week-day${pvm === tanaan ? ' is-today' : ''}${pvm < tanaan ? ' is-past' : ''}`,
      'aria-label': `${VIIKONPAIVAT_PITKA[viikonpaiva(pvm)]} ${pv(pvm)}${tila ? ': ' + tila : ''}`,
      role: 'listitem',
    },
    el('span', { class: 't8-week-wd', 'aria-hidden': 'true' }, VIIKONPAIVAT[viikonpaiva(pvm)]),
    el('span', { class: 't8-week-num', 'aria-hidden': 'true' }, String(Number(pvm.slice(8, 10)))),
    el('span', { class: 't8-week-mark', 'aria-hidden': 'true' }, piste, alle)));
  }
  return el('section', { class: 'card t8-week' },
    el('div', { class: 't8-card-head' },
      el('span', { class: 't8-card-head-title' }, otsikko),
      oikea ? el('span', { class: 't8-card-head-value' }, oikea) : null),
    el('div', { class: 't8-week-grid', role: 'list' }, solut));
}

function tavoiteKortti(edistys, muokattu) {
  const ryhmat = Object.entries(edistys.ryhmat);
  const jaljessa = ryhmat
    .filter(([, r]) => r.tavoite > 0 && r.pros < 100)
    .sort((a, b) => a[1].pros - b[1].pros || b[1].jaljella - a[1].jaljella)[0];
  const ali = jaljessa
    ? `${RYHMA_NIMI[jaljessa[0]]}: ${jaljessa[1].jaljella} sarjaa jäljellä`
    : 'Kaikki ryhmät tavoitteessa';
  return el('a', { class: 'card t8-goal-card', href: '#/tavoitteet' },
    hexRing({
      segmentit: ['tyonnot', 'vedot', 'jalat'].map((k) => ({ pros: edistys.ryhmat[k].pros, vari: RYHMA_VARI[k] })),
      koko: 84,
    }),
    el('div', { class: 't8-goal-body' },
      el('div', { class: 't8-eyebrow' }, muokattu ? 'Viikkotavoite · muokattu' : 'Viikkotavoite'),
      el('div', { class: 't8-goal-pct' }, String(edistys.kokonaisPros), el('span', { class: 't8-goal-pct-unit' }, ' %')),
      el('div', { class: 't8-goal-sub' }, ali)),
    chevron());
}

function vinkkiKortti({ p, historia, profiili, palautuminen }) {
  const ehdotukset = [];
  for (const r of p.rivit) {
    const l = r.liike;
    const kerrat = [];
    for (const t of historia) {
      for (const tl of t.liikkeet || []) {
        if (tl.liikeId === l.id) kerrat.push({ pvm: t.pvm, tyyppi: t.tyyppi, sarjat: tl.sarjat || [] });
      }
    }
    try {
      const e = suggestNextSet({
        liike: l,
        tavoite: r.tavoite,
        edellisetKerrat: kerrat,
        tamanKerranSarjat: [],
        kokemus: profiili.kokemus || 'keskitaso',
        lihasTila: palautuminen && palautuminen.lihakset[l.lihasryhma] ? palautuminen.lihakset[l.lihasryhma].tila : undefined,
      });
      if (e) ehdotukset.push({ l, e });
    } catch (err) {
      console.error(err);
    }
  }
  if (!ehdotukset.length) return null;
  // Ensisijaisesti painoliikkeet (ohjelman järjestyksessä pääliikkeet ensin), sitten syyn mukaan.
  const sija = (x) => {
    const i = VINKKI_JARJESTYS.indexOf(x.e.syy);
    return (i < 0 ? 99 : i) + (x.l.valine === 'kehonpaino' ? 50 : 0);
  };
  const { l, e } = ehdotukset.slice().sort((a, b) => sija(a) - sija(b))[0];
  const yksikko = profiili.yksikko || 'kg';
  const kehonpaino = l.valine === 'kehonpaino';
  const arvo = kehonpaino && !e.paino
    ? `${e.toistot} toistoa`
    : `${kehonpaino ? '+' : ''}${formatWeight(e.paino, yksikko)} × ${e.toistot}`;
  const miksi = e.miksi || '';
  const piste = miksi.indexOf('. ');
  const ensimmainenLause = piste > 0 ? miksi.slice(0, piste + 1) : miksi;
  return el('section', { class: 'card t8-tip' },
    el('div', { class: 't8-tip-head' },
      el('span', { class: 't8-tip-ico' }, ikoni('M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z', 18)),
      el('span', { class: 't8-eyebrow t8-eyebrow-accent' }, 'Progressiovinkki')),
    el('h3', { class: 't8-tip-title' }, VINKKI_OTSIKKO[e.syy] || 'Seuraava askel'),
    el('div', { class: 't8-tip-main' },
      el('span', { class: 't8-tip-ex' }, l.nimi),
      el('span', { class: 't8-tip-val' }, arvo)),
    el('p', { class: 't8-tip-text' }, ensimmainenLause),
    el('div', { class: 't8-tip-foot' },
      whyButton(e.miksi),
      el('span', { class: 't8-tip-note' }, 'Tuotteessa tekoäly personoi nämä säännöt.')));
}

function valmentajaKortti() {
  return el('a', { class: 'card t8-coach', href: '#/valmentaja' },
    el('div', { class: 't8-coach-row' },
      el('span', { class: 't8-coach-ico' }, ikoni('M20.5 11.5a8 8 0 0 1-11.7 7.1L3.5 20l1.4-4.9A8 8 0 1 1 20.5 11.5zM12.5 7.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z', 22)),
      el('div', { class: 't8-coach-body' },
        el('div', { class: 't8-coach-title' }, 'Kysy valmentajalta'),
        el('div', { class: 't8-coach-sub' }, 'Reissu, kipu tai kiire? Valmentaja sovittaa viikkosi ja muistaa sen.')),
      chevron()),
    el('div', { class: 't8-coach-bubble' }, '”Ensi viikolla olen reissussa ja pelaan 3 kertaa padelia”'));
}

function ohjelmaKortti(ohjelma) {
  return el('a', { class: 'card t8-link-card', href: '#/ohjelmat' },
    el('span', { class: 't8-link-ico' }, ikoni('M4 6.5h16M4 12h16M4 17.5h10', 20)),
    el('div', { class: 't8-link-body' },
      el('div', { class: 't8-eyebrow' }, 'Ohjelmasi'),
      el('div', { class: 't8-link-title' }, ohjelma.nimi),
      el('div', { class: 't8-link-sub' }, `${ohjelma.paivat.length} treenipäivää · taso: ${ohjelma.tasot}`)),
    chevron());
}

function ravintoKortti() {
  return el('section', { class: 'card t8-soon' },
    el('span', { class: 't8-link-ico t8-soon-ico' }, ikoni('M7 3.5v7.5a2.5 2.5 0 0 0 5 0V3.5M9.5 3.5v17M17 20.5V3.5c-2 1-3 3.5-3 6.5v3h3', 20)),
    el('div', { class: 't8-link-body' },
      el('div', { class: 't8-soon-head' },
        el('span', { class: 't8-link-title' }, 'Ravinto'),
        el('span', { class: 't8-pill' }, 'Tulossa')),
      el('div', { class: 't8-link-sub' }, 'Proteiinitavoite ja ateriat treeniesi tueksi.')));
}

// --- Näkymä ----------------------------------------------------------------

export function render(root) {
  const state = getState() || {};
  const profiili = state.profiili || {};
  const historia = (state.historia || []).filter(Boolean);
  const suunnitelmat = state.viikkosuunnitelmat || [];
  const tanaan = tanaanPvm(new Date().toISOString());
  const viikonAlku = profiili.viikonAlku === 'sunnuntai' ? 'sunnuntai' : 'maanantai';
  const alku = weekStart(tanaan, viikonAlku);
  const ensiAlku = addDays(alku, 7);
  // Sama päivän rakennus kuin Treenin aloituksessa (ohjelmapäivä ohjelmaId:n mukaan, välineet, kesto).
  const p = rakennaPaiva(state, new Date().toISOString());
  const ohjelma = p.ohjelma;

  const tamaSuunnitelma = suunnitelmaViikolle(suunnitelmat, alku);
  const ensiSuunnitelma = suunnitelmaViikolle(suunnitelmat, ensiAlku);
  const suunnitelmaTanaan = tamaSuunnitelma ? (tamaSuunnitelma.paivat || []).find((p) => p.pvm === tanaan) : null;

  const tavoitteet = weeklyTargets(profiili, tamaSuunnitelma);
  const edistys = weeklyProgress(historia, LIIKKEET, tavoitteet, alku);

  let palautuminen = null;
  try {
    palautuminen = recovery(LIIKKEET, historia, new Date().toISOString());
  } catch (err) {
    console.error(err);
  }

  const loppu = addDays(alku, 7);
  const paivia = new Set(historia.filter((t) => t.pvm >= alku && t.pvm < loppu).map((t) => t.pvm)).size;
  const tavoitePaivat = Number.isFinite(profiili.treenitViikossa) ? profiili.treenitViikossa : 3;

  lisaa(root, 
    ylarivi(profiili, tanaan),
    muistirivit(state.muistit || [], tanaan),
    treeniKortti({ p, tanaan, historia, kaynnissa: !!state.kaynnissa, suunnitelmaTanaan }),
    sectionTitle('Tämä viikko'),
    viikkonauha({
      otsikko: tamaSuunnitelma ? 'Viikkosi · muokattu' : 'Viikkosi',
      alku, tanaan, historia, suunnitelma: tamaSuunnitelma,
      oikea: `${paivia} / ${tavoitePaivat} päivää`,
    }),
    ensiSuunnitelma && ensiSuunnitelma !== tamaSuunnitelma
      ? viikkonauha({ otsikko: 'Ensi viikko · suunnitelma', alku: ensiAlku, tanaan, historia, suunnitelma: ensiSuunnitelma, oikea: `${pv(ensiAlku)}–${pv(addDays(ensiAlku, 6))}` })
      : null,
    tavoiteKortti(edistys, !!tamaSuunnitelma),
    sectionTitle('Sinulle'),
    vinkkiKortti({ p, historia, profiili, palautuminen }),
    valmentajaKortti(),
    ohjelmaKortti(ohjelma),
    ravintoKortti(),
  );
}
