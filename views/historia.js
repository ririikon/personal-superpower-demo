// Historia (speksi 4e): otsikkorivi, 2 × 2 -yhteenveto, viikkonauha ja kuukausiruudukko sekä
// "Menneet treenit" -aikajana. Reitti #/historia/<id> näyttää yksittäisen treenin yhteenvedon
// (views/yhteenveto.js: renderSummary, varana oma yksinkertainen yhteenveto).
import { getState } from '../store.js';
import { tanaanPvm } from '../seed.js';
import { LIIKKEET, MERKKIPAALUT, RYHMAT, liike as haeLiike } from '../data.js';
import { workoutSummary, weeklyGoalDays, streakWeeks, milestones, weekStart, addDays } from '../engine.js';
import { el, svgEl, card, sectionTitle, sheet, whyButton, formatWeight } from './ui.js';
import { bodyMap } from './bodymap.js';

const KG_LB = 2.20462;
const ERA = 30;

const KUUT_GEN = ['tammikuuta', 'helmikuuta', 'maaliskuuta', 'huhtikuuta', 'toukokuuta', 'kesäkuuta',
  'heinäkuuta', 'elokuuta', 'syyskuuta', 'lokakuuta', 'marraskuuta', 'joulukuuta'];
const KUUT = ['Tammikuu', 'Helmikuu', 'Maaliskuu', 'Huhtikuu', 'Toukokuu', 'Kesäkuu',
  'Heinäkuu', 'Elokuu', 'Syyskuu', 'Lokakuu', 'Marraskuu', 'Joulukuu'];
const VKP = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];

const RYHMA_NIMET = { tyonnot: 'Työnnöt', vedot: 'Vedot', jalat: 'Jalat' };
const ENNATYS_NIMET = {
  arvioituVoima: 'arvioitu maksimi',
  paino: 'raskain paino',
  volyymi: 'volyymi',
  toistot: 'toistot sarjassa',
};

const MERKKI_VARIT = {
  'eka-treeni': 'var(--warn)',
  'treenit-10': 'var(--pull)',
  'treenit-50': 'var(--score)',
  'treenit-100': 'var(--legs)',
  'eka-ennatys': 'var(--accent)',
  'putki-4-viikkoa': '#f08a3c',
  'volyymi-10000': '#9d8cf5',
};

const MERKKI_KUVAKKEET = {
  star: ['M12 4.5l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5L4.8 9.7l5-.6z'],
  dumbbell: ['M5 9v6', 'M8 7v10', 'M16 7v10', 'M19 9v6', 'M8 12h8'],
  medal: ['M8.5 3.5l2 5', 'M15.5 3.5l-2 5', 'M12 20a5 5 0 1 0 0-10 5 5 0 0 0 0 10z'],
  crown: ['M5 17l-1-9 4.5 3.5L12 6l3.5 5.5L20 8l-1 9z'],
  trophy: ['M8 4h8v5a4 4 0 0 1-8 0z', 'M8 6H5a3 3 0 0 0 3 4', 'M16 6h3a3 3 0 0 1-3 4', 'M12 13v4', 'M8.5 20h7'],
  flame: ['M12 20c-3.3 0-5.5-2.2-5.5-5.2 0-3 2.5-4.6 3.3-7.8 2 1.3 2.6 3.2 2.4 4.8 1-.6 1.8-1.8 2-3 1.8 1.7 3.3 3.6 3.3 6 0 3-2.2 5.2-5.5 5.2z'],
  weight: ['M9 8a3 3 0 1 1 6 0', 'M7.5 9h9l1.5 10h-12z'],
};

// Aikajanan muisti piirtojen välillä.
let naytettavia = ERA;
let kuukausiAuki = false;
let kuukausiNaytto = null; // 'YYYY-MM'

// ---------------------------------------------------------------------------
// Apurit

function luku(n, d = 1) {
  return Number(n).toLocaleString('fi-FI', { maximumFractionDigits: d });
}

function pvmOsat(pvm) {
  const [y, m, d] = pvm.split('-').map(Number);
  return { y, m, d };
}

function pitkaPvm(pvm, tanaan) {
  const { y, m, d } = pvmOsat(pvm);
  const vuosi = tanaan && pvmOsat(tanaan).y !== y ? ` ${y}` : '';
  return `${d}. ${KUUT_GEN[m - 1]}${vuosi}`;
}

function viikonpaiva(pvm) {
  return new Date(pvm + 'T12:00:00Z').getUTCDay();
}

function kesto(s) {
  if (!Number.isFinite(s) || s <= 0) return '';
  const t = Math.round(s);
  const h = Math.floor(t / 3600);
  const mm = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
  const ss = String(t % 60).padStart(2, '0');
  return `${h}:${mm}:${ss}`;
}

function kellonaika(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  return `${d.getHours()}.${String(d.getMinutes()).padStart(2, '0')}`;
}

function volyymiTeksti(kg, yksikko) {
  const v = yksikko === 'lb' ? kg * KG_LB : kg;
  return `${Math.round(v).toLocaleString('fi-FI')}`;
}

function ikoni(d, { koko = 18, leveys = 2, luokka = 'ico' } = {}) {
  return svgEl('svg', { viewBox: '0 0 24 24', width: koko, height: koko, 'aria-hidden': 'true', class: luokka },
    ...[].concat(d).map((p) => svgEl('path', {
      d: p, fill: 'none', stroke: 'currentColor', 'stroke-width': leveys, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    })));
}

function uusinEnsin(historia) {
  return (historia || [])
    .filter((t) => t && typeof t.pvm === 'string')
    .slice()
    .sort((a, b) => {
      const ka = `${a.pvm}|${a.aloitus || ''}`;
      const kb = `${b.pvm}|${b.aloitus || ''}`;
      return ka < kb ? 1 : ka > kb ? -1 : 0;
    });
}

function onTuotu(t) {
  return t.lahde === 'terveys' || (t.tyyppi && t.tyyppi !== 'voima');
}

function liikelista(t) {
  const nimet = (t.liikkeet || [])
    .filter((l) => (l.sarjat || []).some((s) => !s.lammittely))
    .map((l) => (haeLiike(l.liikeId) || { nimi: l.liikeId }).nimi);
  if (nimet.length === 0) return '';
  if (nimet.length === 1) return nimet[0];
  if (nimet.length <= 3) return `${nimet.slice(0, -1).join(', ')} ja ${nimet[nimet.length - 1]}`;
  return `${nimet.slice(0, 2).join(', ')} ja ${nimet.length - 2} muuta`;
}

function hexMerkki(id, kuvake, koko = 30) {
  const R = 11;
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = ((-90 + 60 * i) * Math.PI) / 180;
    pts.push(`${(12 + R * Math.cos(a)).toFixed(2)},${(12 + R * Math.sin(a)).toFixed(2)}`);
  }
  const vari = MERKKI_VARIT[id] || 'var(--accent)';
  const poly = svgEl('polygon', { points: pts.join(' '), class: 'hex-badge-bg', 'stroke-linejoin': 'round' });
  poly.style.fill = vari;
  poly.style.stroke = vari;
  const ikonit = (MERKKI_KUVAKKEET[kuvake] || MERKKI_KUVAKKEET.star).map((d) => svgEl('path', {
    d, fill: 'none', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'hex-badge-ink',
    transform: 'translate(4.8 4.8) scale(0.6)',
  }));
  return svgEl('svg', { class: 'hex-badge', viewBox: '-1 -1 26 26', width: koko, height: koko, 'aria-hidden': 'true' }, poly, ...ikonit);
}

// ---------------------------------------------------------------------------
// Yhteenveto 2 × 2

function avaaMerkkipaalut(saavutetut) {
  const pvmt = new Map(saavutetut.map((m) => [m.id, m.pvm]));
  sheet(el('div', null,
    el('h2', { class: 'sheet-title' }, 'Merkkipaalut'),
    el('div', { class: 'list ms-list' },
      ...MERKKIPAALUT.map((m) => {
        const pvm = pvmt.get(m.id);
        return el('div', { class: `row ms-row${pvm ? '' : ' is-locked'}` },
          hexMerkki(m.id, m.kuvake, 36),
          el('span', { class: 'row-title' }, m.nimi,
            el('span', { class: 'hist-sub muted small' }, pvm ? `Saavutettu ${pitkaPvm(pvm)} ${pvmOsat(pvm).y}` : 'Ei vielä saavutettu')));
      })),
    el('p', { class: 'muted small ms-note' }, 'Merkkipaalujen rajat ovat demon oletuksia.')));
}

function yhteenveto(state, tanaan) {
  const historia = state.historia || [];
  const p = state.profiili;
  const tavoite = Number.isFinite(p.treenitViikossa) ? p.treenitViikossa : 3;
  const viikonAlku = p.viikonAlku || 'maanantai';
  const viikko = weeklyGoalDays(historia, viikonAlku, tanaan, tavoite);
  const putki = streakWeeks(historia, tavoite, viikonAlku, tanaan);
  const saavutetut = milestones(historia, { liikkeet: LIIKKEET, tavoite, viikonAlku });
  const viimeisimmat = saavutetut.slice(-3).reverse();
  const maaritys = new Map(MERKKIPAALUT.map((m) => [m.id, m]));

  return el('div', { class: 'hist-stats' },
    el('div', { class: 'hist-stat' },
      el('span', { class: 'hist-stat-label' }, 'Treenejä'),
      el('span', { class: 'hist-stat-value' }, String(historia.length))),
    el('button', {
      class: 'hist-stat hist-stat-btn',
      type: 'button',
      'aria-label': `Merkkipaalut: ${saavutetut.length}/${MERKKIPAALUT.length} saavutettu, avaa lista`,
      onClick: () => avaaMerkkipaalut(saavutetut),
    },
    el('span', { class: 'hist-stat-label' }, 'Merkkipaalut'),
    viimeisimmat.length
      ? el('span', { class: 'hist-badges' }, ...viimeisimmat.map((m) => hexMerkki(m.id, (maaritys.get(m.id) || {}).kuvake, 32)))
      : el('span', { class: 'hist-stat-value is-empty' }, 'Ei vielä')),
    el('div', { class: 'hist-stat' },
      el('span', { class: 'hist-stat-label' }, 'Viikkotavoite'),
      el('span', { class: 'hist-stat-value' }, `${viikko.tehty}/${tavoite}`, el('small', null, ' päivää'))),
    el('div', { class: 'hist-stat' },
      el('span', { class: 'hist-stat-label' }, 'Putki'),
      el('span', { class: 'hist-stat-value' }, String(putki), el('small', null, putki === 1 ? ' viikko' : ' viikkoa'))));
}

// ---------------------------------------------------------------------------
// Kalenteri

function kalenteri(state, tanaan, treeniPaivat, onPaiva) {
  const viikonAlku = state.profiili.viikonAlku || 'maanantai';
  const alku = weekStart(tanaan, viikonAlku);
  if (!kuukausiNaytto) kuukausiNaytto = tanaan.slice(0, 7);

  const paivaNappi = (pvm, luokka) => {
    const onTreeni = treeniPaivat.has(pvm);
    const onTanaan = pvm === tanaan;
    const { d, m } = pvmOsat(pvm);
    return el('button', {
      class: `${luokka}${onTanaan ? ' is-today' : ''}${onTreeni ? ' has-workout' : ''}`,
      type: 'button',
      disabled: !onTreeni,
      'aria-label': `${d}. ${KUUT_GEN[m - 1]}${onTreeni ? ', treeni' : ''}${onTanaan ? ', tänään' : ''}`,
      'aria-current': onTanaan ? 'date' : null,
      onClick: () => onPaiva(pvm),
    },
    el('span', { class: 'cal-num' }, String(d)),
    el('span', { class: 'cal-dot', 'aria-hidden': 'true' }));
  };

  const nauha = el('div', { class: 'cal-week' },
    ...Array.from({ length: 7 }, (_, i) => {
      const pvm = addDays(alku, i);
      return el('div', { class: 'cal-col' },
        el('span', { class: 'cal-wd', 'aria-hidden': 'true' }, VKP[viikonpaiva(pvm)]),
        paivaNappi(pvm, 'cal-day'));
    }));

  const ruudukko = el('div', { class: 'cal-month', hidden: !kuukausiAuki });

  function piirraKuukausi() {
    const [y, m] = kuukausiNaytto.split('-').map(Number);
    const eka = `${kuukausiNaytto}-01`;
    const paivia = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const ruutuAlku = weekStart(eka, viikonAlku);
    const tyhjia = Math.round((Date.parse(eka) - Date.parse(ruutuAlku)) / 864e5);
    const siirra = (n) => {
      const d = new Date(Date.UTC(y, m - 1 + n, 1));
      kuukausiNaytto = d.toISOString().slice(0, 7);
      piirraKuukausi();
    };
    const seuraavaKielletty = kuukausiNaytto >= tanaan.slice(0, 7);
    ruudukko.replaceChildren(
      el('div', { class: 'cal-month-head' },
        el('button', { class: 'cal-nav', type: 'button', 'aria-label': 'Edellinen kuukausi', onClick: () => siirra(-1) }, ikoni('M15 5l-7 7 7 7')),
        el('span', { class: 'cal-month-title' }, `${KUUT[m - 1]} ${y}`),
        el('button', { class: 'cal-nav', type: 'button', 'aria-label': 'Seuraava kuukausi', disabled: seuraavaKielletty, onClick: () => siirra(1) }, ikoni('M9 5l7 7-7 7'))),
      el('div', { class: 'cal-grid' },
        ...Array.from({ length: 7 }, (_, i) => el('span', { class: 'cal-wd', 'aria-hidden': 'true' }, VKP[viikonpaiva(addDays(ruutuAlku, i))])),
        ...Array.from({ length: tyhjia }, () => el('span', { class: 'cal-blank', 'aria-hidden': 'true' })),
        ...Array.from({ length: paivia }, (_, i) => paivaNappi(`${kuukausiNaytto}-${String(i + 1).padStart(2, '0')}`, 'cal-cell'))));
  }
  piirraKuukausi();

  const { y, m } = pvmOsat(tanaan);
  const valitsin = el('button', {
    class: 'cal-picker',
    type: 'button',
    'aria-expanded': String(kuukausiAuki),
    onClick: () => {
      kuukausiAuki = !kuukausiAuki;
      ruudukko.hidden = !kuukausiAuki;
      nauha.hidden = kuukausiAuki;
      valitsin.setAttribute('aria-expanded', String(kuukausiAuki));
    },
  }, `${KUUT[m - 1]} ${y}`, ikoni('M6 9l6 6 6-6', { koko: 16, leveys: 2.4 }));
  nauha.hidden = kuukausiAuki;

  return el('div', { class: 'card cal-card' },
    el('div', { class: 'cal-head' }, valitsin, el('span', { class: 'muted small' }, 'Napauta päivää')),
    nauha,
    ruudukko);
}

// ---------------------------------------------------------------------------
// Aikajana

const TUONTI_SELITYS = 'Kävelyt ja pyöräilyt tulevat terveyssovelluksesta. Tuotteessa lähteitä ovat '
  + 'Health Connect (Android) ja Apple Health (iPhone), ja tuonti tehdään luvallasi.\n\n'
  + 'Tuodut aktiviteetit kerryttävät viikkotavoitteen päiviä, putkea ja treenien määrää, mutta eivät '
  + 'sarjatavoitteita, Treeniscorea eivätkä palautumista.\n\n'
  + 'Demossa tuodut aktiviteetit ovat esimerkkidataa.';

function aktiviteettiIkoni(t) {
  const pyora = t.tyyppi === 'pyöräily';
  const kuva = pyora
    ? ikoni(['M6 17.5a3 3 0 1 0 0-.01', 'M18 17.5a3 3 0 1 0 0-.01', 'M6 17.5l3.5-7h5l3.5 7', 'M9.5 10.5 12 17.5h-6', 'M14 7.5h2'], { koko: 30, leveys: 1.8 })
    : ikoni(['M13 4.5a1.5 1.5 0 1 0 0 .01', 'M10 21l2-6 2.5 2.5V21', 'M12 15l-1-5 3.5 1.5 2 2.5', 'M11 10l-3 2v3'], { koko: 30, leveys: 1.8 });
  return el('span', { class: 'tl-icon is-import' }, kuva,
    el('span', { class: 'tl-link-badge', role: 'img', 'aria-label': 'Tuotu' }, ikoni(['M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1', 'M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1'], { koko: 11, leveys: 2.6 })));
}

function tilasto(otsikko, arvo) {
  return el('span', { class: 'tl-stat' }, el('span', { class: 'tl-stat-label' }, otsikko), el('span', { class: 'tl-stat-value' }, arvo));
}

function aikajanaKohta(t, state, tanaan) {
  const historia = state.historia || [];
  const yksikko = state.profiili.yksikko === 'lb' ? 'lb' : 'kg';
  const s = workoutSummary(t, LIIKKEET, historia, state.profiili.kehonpaino);
  const tuotu = onTuotu(t);
  const href = `#/historia/${encodeURIComponent(t.id)}`;
  const kcal = s.kcal === null ? '–' : `${s.kcalArvio ? '~' : ''}${s.kcal.toLocaleString('fi-FI')}`;

  const ikoniOsa = tuotu
    ? aktiviteettiIkoni(t)
    : el('span', { class: 'tl-icon' }, bodyMap({ koko: 'pieni', tilat: Object.fromEntries(s.lihakset.map((x) => [x.lihas, 'treenattu'])) }));

  const tilastot = tuotu
    ? [tilasto('Liikkeitä', '–'), tilasto('Kalorit', kcal)]
    : [tilasto('Liikkeitä', String(s.liikkeita)), tilasto('Kalorit', kcal), tilasto('Volyymi', `${volyymiTeksti(s.volyymi, yksikko)} ${yksikko}`)];

  const paa = el('a', { class: 'tl-main', href, 'aria-label': `${s.otsikko}, ${pitkaPvm(t.pvm, tanaan)}, avaa yhteenveto` },
    ikoniOsa,
    el('span', { class: 'tl-body' },
      el('span', { class: 'tl-title' }, s.otsikko),
      el('span', { class: 'tl-stats' }, ...tilastot)));

  const ala = tuotu
    ? el('div', { class: 'tl-foot' },
      el('span', { class: 'tl-ex' }, `${t.tyyppi === 'pyöräily' ? 'Pyöräily' : 'Kävely'}${Number.isFinite(t.matkaKm) ? ` · ${luku(t.matkaKm, 1)} km` : ''}`),
      el('span', { class: 'tl-import' },
        ikoni(['M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1', 'M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1'], { koko: 14 }),
        'Tuotu terveyssovelluksesta',
        whyButton(TUONTI_SELITYS)))
    : el('div', { class: 'tl-foot' }, el('span', { class: 'tl-ex' }, liikelista(t) || 'Ei kirjattuja liikkeitä'));

  const ennatykset = s.ennatykset.length
    ? el('a', { class: 'tl-records', href },
      el('span', { class: 'tl-trophy', 'aria-hidden': 'true' }, ikoni(MERKKI_KUVAKKEET.trophy, { koko: 16, leveys: 2.2 })),
      s.ennatykset.length === 1 ? '1 ennätys' : `${s.ennatykset.length} ennätystä`,
      svgEl('svg', { class: 'chevron', viewBox: '0 0 8 14', width: 7, height: 12, 'aria-hidden': 'true' },
        svgEl('path', { d: 'M1.5 1.5 6.5 7l-5 5.5', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })))
    : null;

  const kortti = el('div', {
    class: `tl-card${tuotu ? ' is-import' : ''}`,
    onClick: (e) => {
      if (e.target.closest('a, button')) return;
      location.hash = href;
    },
  }, paa, ala, ennatykset);

  return el('li', { class: 'tl-item', dataset: { pvm: t.pvm, id: t.id } },
    el('div', { class: 'tl-head' },
      el('span', { class: 'tl-date' }, pitkaPvm(t.pvm, tanaan)),
      el('span', { class: 'tl-dur' }, kesto(t.kestoS))),
    kortti);
}

// ---------------------------------------------------------------------------
// Lista

function renderLista(root) {
  const state = getState();
  const nyt = new Date().toISOString();
  const tanaan = tanaanPvm(nyt);
  const kaikki = uusinEnsin(state.historia);
  const treeniPaivat = new Set(kaikki.map((t) => t.pvm));
  if (naytettavia < ERA) naytettavia = ERA;

  const lista = el('ol', { class: 'tl-list' });
  const lisaaNappi = el('button', { class: 'btn tl-more', type: 'button' });
  const reduce = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function piirraLista() {
    const nykyiset = lista.children.length;
    const n = Math.min(naytettavia, kaikki.length);
    for (let i = nykyiset; i < n; i++) lista.append(aikajanaKohta(kaikki[i], state, tanaan));
    const jaljella = kaikki.length - n;
    lisaaNappi.hidden = jaljella <= 0;
    lisaaNappi.textContent = `Näytä lisää (${jaljella})`;
  }
  lisaaNappi.addEventListener('click', () => {
    naytettavia += ERA;
    piirraLista();
  });

  function vieritaPaivaan(pvm) {
    const indeksi = kaikki.findIndex((t) => t.pvm === pvm);
    if (indeksi < 0) return;
    if (indeksi >= naytettavia) {
      naytettavia = Math.ceil((indeksi + 1) / ERA) * ERA;
      piirraLista();
    }
    const kohde = lista.children[indeksi];
    if (!kohde) return;
    kohde.scrollIntoView({ block: 'start', behavior: reduce() ? 'auto' : 'smooth' });
    kohde.classList.remove('is-flash');
    void kohde.offsetWidth;
    kohde.classList.add('is-flash');
    const linkki = kohde.querySelector('.tl-main');
    if (linkki) linkki.focus({ preventScroll: true });
  }

  const asetukset = el('a', { class: 'hist-gear', href: '#/profiili', 'aria-label': 'Profiili ja asetukset' },
    ikoni(['M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z',
      'M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.4A7.5 7.5 0 0 0 7 6.4l-2.4-.9-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9a7.5 7.5 0 0 0 2.6 1.5l.4 2.4h4l.4-2.4a7.5 7.5 0 0 0 2.6-1.5l2.4.9 2-3.4z'], { koko: 24, leveys: 1.8 }));

  root.append(
    el('div', { class: 'hist-header' },
      el('h1', { class: 'page-title hist-name' }, (state.profiili && state.profiili.nimi) || 'Demokäyttäjä'),
      asetukset),
    yhteenveto(state, tanaan),
    sectionTitle('Kalenteri'),
    kalenteri(state, tanaan, treeniPaivat, vieritaPaivaan),
    sectionTitle('Menneet treenit'),
  );

  if (!kaikki.length) {
    root.append(card(
      el('p', { class: 'muted' }, 'Ei vielä treenejä. Ensimmäinen treeni ilmestyy tänne heti, kun lopetat sen.'),
      el('a', { class: 'btn btn-primary', href: '#/treeni' }, 'Aloita treeni')));
    return;
  }
  piirraLista();
  root.append(lista, lisaaNappi);
}

// ---------------------------------------------------------------------------
// Yksittäinen treeni

function takaisin() {
  return el('a', { class: 'hist-back', href: '#/historia' },
    ikoni('M15 5l-7 7 7 7', { koko: 22, leveys: 2.4 }),
    el('span', null, 'Historia'));
}

function sarjaTeksti(s, liike, yksikko) {
  const kp = liike && liike.valine === 'kehonpaino';
  const paino = kp && !(s.paino > 0) ? 'Kehonpaino' : formatWeight(s.paino, yksikko);
  const rir = Number.isFinite(s.rir) ? ` · RIR ${s.rir >= 4 ? '4+' : s.rir}` : '';
  return `${paino} × ${s.toistot}${rir}`;
}

function varaYhteenveto(t, state, tanaan) {
  const yksikko = state.profiili.yksikko === 'lb' ? 'lb' : 'kg';
  const s = workoutSummary(t, LIIKKEET, state.historia || [], state.profiili.kehonpaino);
  const tuotu = onTuotu(t);
  const kcal = s.kcal === null ? '–' : `${s.kcalArvio ? '~' : ''}${s.kcal.toLocaleString('fi-FI')}`;
  const osat = [
    el('h1', { class: 'page-title hist-detail-title' }, s.otsikko),
    el('p', { class: 'muted hist-detail-meta' },
      [pitkaPvm(t.pvm, tanaan) + (t.aloitus ? ` klo ${kellonaika(t.aloitus)}` : ''), kesto(t.kestoS)].filter(Boolean).join(' · ')),
    el('div', { class: 'card hist-detail-stats' },
      tuotu ? tilasto('Matka', Number.isFinite(t.matkaKm) ? `${luku(t.matkaKm, 1)} km` : '–') : tilasto('Liikkeitä', String(s.liikkeita)),
      tilasto('Kalorit', kcal),
      tuotu ? tilasto('Tyyppi', t.tyyppi === 'pyöräily' ? 'Pyöräily' : 'Kävely') : tilasto(`Volyymi (${yksikko})`, volyymiTeksti(s.volyymi, yksikko))),
  ];

  if (tuotu) {
    osat.push(el('p', { class: 'tl-import hist-detail-import' }, 'Tuotu terveyssovelluksesta', whyButton(TUONTI_SELITYS)));
    return osat;
  }

  if (s.ennatykset.length) {
    osat.push(sectionTitle('Uudet ennätykset'),
      el('div', { class: 'list' }, ...s.ennatykset.map((e) => {
        const arvo = e.yksikko === 'toistoa'
          ? `${luku(e.arvo, 0)} toistoa`
          : e.tyyppi === 'volyymi' ? `${volyymiTeksti(e.arvo, yksikko)} ${yksikko}` : formatWeight(e.arvo, yksikko);
        return el('div', { class: 'row' },
          el('span', { class: 'tl-trophy', 'aria-hidden': 'true' }, ikoni(MERKKI_KUVAKKEET.trophy, { koko: 16, leveys: 2.2 })),
          el('span', { class: 'row-title' }, e.nimi, el('span', { class: 'hist-sub muted small' }, ENNATYS_NIMET[e.tyyppi] || e.tyyppi)),
          el('span', { class: 'row-value' }, arvo));
      })));
  }

  osat.push(sectionTitle('Liikkeet'));
  for (const tl of t.liikkeet || []) {
    const l = haeLiike(tl.liikeId);
    const sarjat = (tl.sarjat || []).filter((x) => !x.lammittely);
    if (!sarjat.length) continue;
    osat.push(el('div', { class: 'card hist-ex' },
      el('h3', { class: 'hist-ex-name' }, l ? l.nimi : tl.liikeId),
      el('ol', { class: 'hist-sets' }, ...sarjat.map((x) => el('li', null, sarjaTeksti(x, l, yksikko))))));
  }

  const ryhmat = Object.entries(RYHMAT).map(([r, lihakset]) => ({
    r,
    n: s.lihakset.filter((x) => lihakset.includes(x.lihas)).reduce((a, x) => a + x.sarjat, 0),
  })).filter((x) => x.n > 0);
  if (ryhmat.length) {
    osat.push(sectionTitle('Kerrytti sarjatavoitteisiin'),
      el('div', { class: 'list' }, ...ryhmat.map((x) => el('div', { class: 'row' },
        el('span', { class: 'row-title' }, RYHMA_NIMET[x.r]),
        el('span', { class: 'row-value' }, `${x.n} sarjaa`)))));
  }
  return osat;
}

async function renderTreeni(root, params) {
  const wrap = el('div', { class: 'hist-detail' }, takaisin());
  root.append(wrap);
  const state = getState();
  const tanaan = tanaanPvm(new Date().toISOString());
  const t = (state.historia || []).find((x) => x && x.id === params.id);
  if (!t) {
    wrap.append(
      el('h1', { class: 'page-title' }, 'Treeniä ei löytynyt'),
      card(el('p', { class: 'muted' }, 'Treeniä ei ole historiassa. Se on ehkä poistettu demon nollauksessa.'),
        el('a', { class: 'btn btn-primary', href: '#/historia' }, 'Takaisin historiaan')));
    return;
  }

  let solmu = null;
  try {
    const mod = await import('./yhteenveto.js');
    if (mod && typeof mod.renderSummary === 'function') {
      solmu = await mod.renderSummary(t, { uusi: params.uusi === '1' });
      if (!(solmu instanceof Node)) solmu = null;
    }
  } catch {
    solmu = null; // varana oma yksinkertainen yhteenveto
  }
  if (!wrap.isConnected) return;
  if (solmu) wrap.append(solmu);
  else wrap.append(...varaYhteenveto(t, getState(), tanaan));
}

// Historiasta poistuttaessa aikajana palaa 30 merkintään; statechange-piirto ja
// treenin tiedoissa käynti säilyttävät määrän.
function siivous() {
  if (!/^#\/historia(\/|\?|$)/.test(location.hash)) naytettavia = ERA;
}

export function render(root, params = {}) {
  if (params.id) return renderTreeni(root, params).then(() => siivous);
  renderLista(root);
  return siivous;
}
