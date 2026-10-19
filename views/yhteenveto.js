// Treenin yhteenveto ja oivallukset (speksi 4g). Sama komponentti näkyy treenin lopuksi
// (`#/historia/<id>?uusi=1`) ja historiasta avattuna (`#/historia/<id>`).
//
// Rajapinta: renderSummary(treeni, { uusi = false } = {}) → HTMLElement. Laskee kaiken
// tarvitsemansa getState()-kutsulla (aiemmat treenit, profiili, ohjelma, muistit, viikkosuunnitelma).
import { getState } from '../store.js?v=6612722';
import { LIIKKEET, OHJELMAT } from '../data.js?v=6612722';
import {
  workoutSummary, workoutInsights, weeklyTargets, weeklyProgress, weekStart, addDays, onVoimatreeni,
  challengeProgress, badges, pointsAndLevel,
} from '../engine.js?v=6612722';
import { el, card, sectionTitle, whyButton, hexRing } from './ui.js?v=6612722';
import { palkki, merkkiKuusikulmio } from './yhteiso.js?v=6612722';

const KUUKAUDET = ['tammikuuta', 'helmikuuta', 'maaliskuuta', 'huhtikuuta', 'toukokuuta', 'kesäkuuta',
  'heinäkuuta', 'elokuuta', 'syyskuuta', 'lokakuuta', 'marraskuuta', 'joulukuuta'];
const KG_LB = 2.20462;
const VIIKONPAIVAT = ['sunnuntai', 'maanantai', 'tiistai', 'keskiviikko', 'torstai', 'perjantai', 'lauantai'];
const RYHMAT = [
  { avain: 'tyonnot', nimi: 'Työnnöt', vari: 'var(--push)' },
  { avain: 'vedot', nimi: 'Vedot', vari: 'var(--pull)' },
  { avain: 'jalat', nimi: 'Jalat', vari: 'var(--legs)' },
];

// --- Muotoilu ------------------------------------------------------------------

function pvmTeksti(pvm) {
  if (typeof pvm !== 'string') return '';
  const d = new Date(pvm + 'T12:00:00Z');
  if (Number.isNaN(d.getTime())) return pvm;
  return `${VIIKONPAIVAT[d.getUTCDay()]} ${d.getUTCDate()}. ${KUUKAUDET[d.getUTCMonth()]}`;
}

function kestoTeksti(s) {
  if (!Number.isFinite(s) || s <= 0) return '–';
  const min = Math.round(s / 60);
  if (min < 60) return `${Math.max(1, min)} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

function lukuTeksti(n) {
  if (!Number.isFinite(n)) return '–';
  return Math.round(n).toLocaleString('fi-FI');
}

function pad(n) {
  return String(n).padStart(2, '0');
}

// Paikallinen ISO-aika ilman aikavyöhykettä: workoutInsights lukee päivän ja kellonajan
// merkkijonosta, joten paikallinen aika pitää päivän oikeana myös illalla.
function paikallinenIso(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function vertaaAika(a, b) {
  if (a.pvm !== b.pvm) return a.pvm < b.pvm ? -1 : 1;
  const aa = a.aloitus || '';
  const bb = b.aloitus || '';
  return aa < bb ? -1 : aa > bb ? 1 : 0;
}

function loppuHetki(treeni) {
  const alku = Date.parse(treeni.aloitus || `${treeni.pvm}T18:00:00`);
  const kesto = Number.isFinite(treeni.kestoS) ? treeni.kestoS * 1000 : 0;
  return Number.isFinite(alku) ? alku + kesto : Date.now();
}

// --- Osat ------------------------------------------------------------------------

function avainluvut(ruudut) {
  return el('div', { class: 'yv-stats' }, ...ruudut.map(([otsikko, arvo]) => el('div', { class: 'yv-stat' },
    el('span', { class: 'yv-stat-label' }, otsikko),
    el('span', { class: 'yv-stat-value' }, arvo))));
}

function oivallusKortti(o, luokka) {
  return el('article', { class: `yv-card ${luokka}` },
    el('h3', { class: 'yv-card-title' }, o.otsikko),
    el('p', { class: 'yv-card-text' }, o.teksti),
    o.miksi ? el('div', { class: 'yv-card-why' }, whyButton(o.miksi)) : null);
}

function rauhallinenRivi(o) {
  return el('div', { class: 'yv-calm' },
    el('span', { class: 'yv-calm-icon', 'aria-hidden': 'true' }, '✓'),
    el('span', { class: 'yv-calm-text' }, o.teksti),
    o.miksi ? whyButton(o.miksi) : null);
}

function viikkoMuutos(treeni, aiemmat, state) {
  const profiili = state.profiili || {};
  const vAlku = weekStart(treeni.pvm, profiili.viikonAlku || 'maanantai');
  const suunnitelma = (state.viikkosuunnitelmat || []).find((s) => s && s.viikonAlku
    && s.viikonAlku <= treeni.pvm && treeni.pvm < addDays(s.viikonAlku, 7)) || null;
  const tavoitteet = weeklyTargets(profiili, suunnitelma);
  const ennen = weeklyProgress(aiemmat, LIIKKEET, tavoitteet, vAlku);
  const jalkeen = weeklyProgress([...aiemmat, treeni], LIIKKEET, tavoitteet, vAlku);
  let lisays = 0;
  for (const [lihas, m] of Object.entries(jalkeen.lihakset)) lisays += m.tehty - (ennen.lihakset[lihas] ? ennen.lihakset[lihas].tehty : 0);

  const ryhmaRivit = RYHMAT.map((r) => {
    const n = jalkeen.ryhmat[r.avain].tehty - ennen.ryhmat[r.avain].tehty;
    return el('span', { class: 'yv-week-group' },
      el('span', { class: 'yv-dot', style: `background:${r.vari}`, 'aria-hidden': 'true' }),
      `${r.nimi} ${n > 0 ? '+' : ''}${n}`);
  });

  return el('div', { class: 'card yv-week' },
    hexRing({
      segmentit: RYHMAT.map((r) => ({ pros: jalkeen.ryhmat[r.avain].pros, vari: r.vari })),
      keskiteksti: `${jalkeen.kokonaisPros} %`,
      koko: 76,
    }),
    el('div', { class: 'yv-week-main' },
      el('p', { class: 'yv-week-title' }, `+${lisays} sarjaa`),
      el('p', { class: 'yv-week-text' }, `Viikko ${ennen.kokonaisPros} % → ${jalkeen.kokonaisPros} %`),
      el('div', { class: 'yv-week-groups' }, ...ryhmaRivit),
      el('div', { class: 'yv-card-why' }, whyButton(
        'Viikkotavoite on työsarjojen määrä lihasryhmää kohden viikossa. Vain liikkeen päälihasryhmä kerryttää tavoitetta (1 sarja = 1), eivätkä lämmittelysarjat kerrytä.\n\n'
        + 'Prosentti on Σ min(tehty, tavoite) / Σ tavoite, joten ylitys yhdessä lihasryhmässä ei paikkaa vajetta toisessa. Tavoitteet ovat demon oletuksia.'))));
}

// Haasteet (speksi 4i): liitettyjen aktiivisten haasteiden muutos tämän treenin myötä, uudet merkit
// ja ansaitut pisteet. "Ennen" lasketaan tilasta ilman tätä treeniä.
function haasteMuutokset(treeni, state) {
  const yhteiso = state.yhteiso;
  if (!yhteiso || !Array.isArray(yhteiso.haasteet)) return null;
  const nyt = new Date().toISOString();
  const ilman = {
    ...state,
    historia: (state.historia || []).filter((t) => t && t !== treeni && (treeni.id == null || t.id !== treeni.id)),
  };
  const jalkeenTila = ilman.historia.length === (state.historia || []).length
    ? { ...state, historia: [...ilman.historia, treeni] }
    : state;

  const rivit = [];
  for (const h of yhteiso.haasteet) {
    if (!h || !h.liittynyt || !(h.alku <= treeni.pvm && treeni.pvm <= h.loppu)) continue;
    const e = challengeProgress(h, ilman, nyt);
    const j = challengeProgress(h, jalkeenTila, nyt);
    if (j.arvo === e.arvo) continue;
    const valmistui = h.tyyppi !== 'kaveri' && !e.suoritettu && j.suoritettu;
    const kg = h.mittari === 'volyymi' ? ' kg' : '';
    rivit.push(el('div', { class: `yh-sum-row${valmistui ? ' is-done' : ''}` },
      el('div', { class: 'yh-sum-line' },
        el('span', { class: 'yh-sum-name' }, `${h.nimi}:`),
        el('span', { class: 'yh-sum-change' }, `${lukuTeksti(e.arvo)} → ${lukuTeksti(j.arvo)}${kg}`),
        valmistui ? el('span', { class: 'yh-sum-done' }, '✓ Suoritettu!') : null),
      palkki(j.pros, { valmis: valmistui || (h.tyyppi !== 'kaveri' && j.suoritettu), label: `${h.nimi}: ${j.pros} %` })));
  }

  const ennenMerkit = new Set(badges(ilman, nyt).ansaitut.map((m) => m.id));
  const uudetMerkit = badges(jalkeenTila, nyt).ansaitut.filter((m) => !ennenMerkit.has(m.id));
  const pe = pointsAndLevel(ilman, nyt);
  const pj = pointsAndLevel(jalkeenTila, nyt);
  const ero = (k) => (pj.erittely[k] || 0) - (pe.erittely[k] || 0);
  const osat = [
    ['Treeni', ero('treenit') + ero('aktiviteetit')],
    ['Haasteet', ero('haasteet')],
    ['Merkit', ero('merkit')],
  ].filter(([, n]) => n > 0);
  const yhteensa = pj.pisteet - pe.pisteet;

  if (!rivit.length && !uudetMerkit.length && yhteensa <= 0) return null;

  return el('div', { class: 'card yh-sum' },
    rivit.length ? el('div', { class: 'yh-sum-rows' }, ...rivit) : null,
    uudetMerkit.length
      ? el('div', { class: 'yh-sum-badges' }, ...uudetMerkit.map((m) => el('div', { class: 'yh-sum-badge' },
        merkkiKuusikulmio(m.id, m.kuvake, 40),
        el('span', null, el('span', { class: 'yh-sum-badge-label' }, 'Uusi merkki'), el('span', { class: 'yh-sum-badge-name' }, m.nimi)))))
      : null,
    yhteensa > 0
      ? el('div', { class: 'yh-sum-points' },
        el('span', { class: 'yh-sum-points-total' }, `+${lukuTeksti(yhteensa)} pistettä`),
        el('span', { class: 'yh-sum-points-split' }, osat.map(([n, v]) => `${n} +${lukuTeksti(v)}`).join(' · ')),
        pj.taso > pe.taso ? el('span', { class: 'yh-sum-level' }, `Nousit tasolle ${pj.taso}!`) : null)
      : null,
    el('a', { class: 'yh-sum-link', href: '#/yhteiso' }, 'Avaa Yhteisö ›'));
}

function tuotuYhteenveto(treeni, uusi) {
  const ruudut = [['Kesto', kestoTeksti(treeni.kestoS)]];
  if (Number.isFinite(treeni.kcal)) ruudut.push(['Kalorit', `${lukuTeksti(treeni.kcal)} kcal`]);
  if (Number.isFinite(treeni.matkaKm)) ruudut.push(['Matka', `${String(treeni.matkaKm).replace('.', ',')} km`]);
  return el('div', { class: 'yv' },
    el('div', { class: 'yv-hero' },
      el('p', { class: 'yv-overline' }, pvmTeksti(treeni.pvm)),
      el('h1', { class: 'page-title yv-title' }, uusi ? 'Hyvä treeni!' : (treeni.nimi || 'Aktiviteetti'))),
    avainluvut(ruudut),
    el('p', { class: 'yv-fine muted' }, 'Tuotu terveyssovelluksesta.'));
}

// --- Julkinen rajapinta ----------------------------------------------------------

export function renderSummary(treeni, { uusi = false } = {}) {
  if (!treeni) {
    return el('div', { class: 'yv' }, card(el('p', { class: 'muted' }, 'Treeniä ei löytynyt.')));
  }
  if (!onVoimatreeni(treeni)) return tuotuYhteenveto(treeni, uusi);

  const state = getState() || {};
  const profiili = state.profiili || {};
  const yksikko = profiili.yksikko === 'lb' ? 'lb' : 'kg';
  const historia = Array.isArray(state.historia) ? state.historia : [];
  const aiemmat = historia.filter((t) => t && t !== treeni && (treeni.id == null || t.id !== treeni.id)
    && typeof t.pvm === 'string' && vertaaAika(t, treeni) < 0);
  const ohjelma = OHJELMAT.find((o) => o.id === treeni.ohjelmaId)
    || OHJELMAT.find((o) => o.id === state.aktiivinenOhjelmaId) || OHJELMAT[0];

  const yhteenveto = workoutSummary(treeni, LIIKKEET, aiemmat, profiili.kehonpaino);
  const oivallukset = workoutInsights({
    treeni,
    historia: aiemmat,
    liikkeet: LIIKKEET,
    profiili,
    ohjelma,
    muistit: state.muistit || [],
    viikkosuunnitelma: state.viikkosuunnitelmat || [],
    nyt: paikallinenIso(loppuHetki(treeni)),
  });
  const edistys = oivallukset.filter((o) => o.tyyppi === 'edistys');
  const huomio = oivallukset.filter((o) => o.tyyppi === 'huomio');
  const seuraavaksi = oivallukset.filter((o) => o.tyyppi === 'seuraavaksi');

  const osat = [
    el('div', { class: 'yv-hero' },
      el('p', { class: 'yv-overline' }, [treeni.paivaNimi, pvmTeksti(treeni.pvm)].filter(Boolean).join(' · ')),
      el('h1', { class: 'page-title yv-title' }, uusi ? 'Hyvä treeni!' : yhteenveto.otsikko)),
    avainluvut([
      ['Kesto', kestoTeksti(treeni.kestoS)],
      ['Liikkeitä', String(yhteenveto.liikkeita)],
      ['Volyymi', `${lukuTeksti(yksikko === 'lb' ? yhteenveto.volyymi * KG_LB : yhteenveto.volyymi)} ${yksikko}`],
      ['Kalorit', yhteenveto.kcal === null ? '–' : `${yhteenveto.kcalArvio ? '~' : ''}${lukuTeksti(yhteenveto.kcal)} kcal`],
    ]),
  ];

  if (edistys.length) {
    osat.push(sectionTitle('Edistyit'), el('div', { class: 'yv-group' }, ...edistys.map((o) => oivallusKortti(o, 'is-progress'))));
  }
  if (huomio.length) {
    osat.push(sectionTitle('Kaipaa huomiota'), el('div', { class: 'yv-group' },
      ...huomio.map((o) => (o.eiHuomioitavaa ? rauhallinenRivi(o) : oivallusKortti(o, 'is-attention')))));
  }
  if (seuraavaksi.length) {
    osat.push(sectionTitle('Seuraavaksi'), el('div', { class: 'yv-group' }, ...seuraavaksi.map((o) => oivallusKortti(o, 'is-next'))));
  }

  osat.push(sectionTitle('Viikkotavoite'), viikkoMuutos(treeni, aiemmat, state));
  if (uusi) {
    let haasteet = null;
    try {
      haasteet = haasteMuutokset(treeni, state);
    } catch (err) {
      console.error(err);
    }
    if (haasteet) osat.push(sectionTitle('Haasteet'), haasteet);
  }
  osat.push(el('p', { class: 'yv-ai-note' }, 'Tuotteessa tekoäly kirjoittaa nämä oivallukset sinun datastasi.'));
  if (uusi) osat.push(el('a', { class: 'btn btn-primary yv-done', href: '#/koti' }, 'Valmis'));

  return el('div', { class: `yv${uusi ? ' is-new' : ''}` }, ...osat);
}

// Viimeisimmän voimatreenin yhteenveto (ei omaa reittiä; historia käyttää renderSummaryä).
export function render(root, params) {
  const state = getState() || {};
  const treenit = (Array.isArray(state.historia) ? state.historia : [])
    .filter((t) => t && typeof t.pvm === 'string' && onVoimatreeni(t))
    .slice().sort(vertaaAika);
  const viimeisin = treenit[treenit.length - 1];
  if (!viimeisin) {
    root.append(el('h1', { class: 'page-title' }, 'Yhteenveto'), card(el('p', { class: 'muted' }, 'Ei vielä treenejä.')));
    return;
  }
  root.append(renderSummary(viimeisin, { uusi: !!params && params.uusi === '1' }));
}
