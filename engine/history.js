// Historia (speksi 4e): kalorit, treenin yhteenveto, viikkotavoitteen päivät, putki ja
// merkkipaalut. Puhdas moduuli: ei DOM-, window-, localStorage- eikä Date.now()-kutsuja.

import { addDays, weekStart, onVoimatreeni, onTyosarja } from './util.js?v=270067f';
import { exerciseRecords } from './score.js?v=270067f';
import { MERKKIPAALUT } from '../data.js?v=270067f';

const MET_VOIMA = 5.0;
const OLETUS_KEHONPAINO = 80; // demon oletus, jos kehonpainoa ei ole annettu
const OTSIKON_LIHAKSET = 3;   // otsikko katkaistaan kolmen lihasryhmän jälkeen
const ENNATYSTYYPIT = ['arvioituVoima', 'paino', 'volyymi', 'toistot'];

// --- Sisäiset apurit -------------------------------------------------------

function isoAlku(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function tyoSarjat(sarjat) {
  return (sarjat || []).filter(
    (s) => onTyosarja(s) && Number.isFinite(s.paino) && Number.isFinite(s.toistot) && s.toistot > 0,
  );
}

function liikeKartta(liikkeet) {
  return new Map((liikkeet || []).map((l) => [l.id, l]));
}

// Aikajärjestys: päivämäärä, sitten aloitusaika (jos molemmilla on).
function vertaaAika(a, b) {
  if (a.pvm !== b.pvm) return a.pvm < b.pvm ? -1 : 1;
  const aa = a.aloitus || '';
  const bb = b.aloitus || '';
  return aa < bb ? -1 : aa > bb ? 1 : 0;
}

function aikajarjestys(treenit) {
  return (treenit || []).filter((t) => t && typeof t.pvm === 'string').slice().sort(vertaaAika);
}

// Treenit, jotka on tehty ennen annettua treeniä (sama treeni ei kelpaa).
function ennenTreenia(treeni, treenit) {
  return (treenit || []).filter(
    (t) => t && t !== treeni && (treeni.id == null || t.id !== treeni.id) && typeof t.pvm === 'string'
      && vertaaAika(t, treeni) < 0,
  );
}

// Treenin volyymi kiloina: sarjat × toistot × paino, käsipainoilla paino × 2.
function treeninVolyymi(treeni, lmap) {
  let v = 0;
  for (const tl of treeni.liikkeet || []) {
    const l = lmap.get(tl.liikeId);
    const kerroin = l && l.valine === 'käsipainot' ? 2 : 1;
    for (const s of tyoSarjat(tl.sarjat)) v += s.paino * s.toistot * kerroin;
  }
  return Math.round(v);
}

// Uudet ennätykset suhteessa aiempiin treeneihin. Ensimmäinen kerta liikkeellä ei ole ennätys.
function treeninEnnatykset(treeni, lmap, aiemmat) {
  if (!onVoimatreeni(treeni)) return [];
  const tulos = [];
  const kasitellyt = new Set();
  for (const tl of treeni.liikkeet || []) {
    if (kasitellyt.has(tl.liikeId) || tyoSarjat(tl.sarjat).length === 0) continue;
    kasitellyt.add(tl.liikeId);
    const liike = lmap.get(tl.liikeId);
    const ennen = exerciseRecords(tl.liikeId, aiemmat, liike);
    const nyt = exerciseRecords(tl.liikeId, [treeni], liike);
    for (const tyyppi of ENNATYSTYYPIT) {
      const e = ennen[tyyppi];
      const n = nyt[tyyppi];
      if (e && n && n.arvo > e.arvo + 1e-9) {
        tulos.push({
          liikeId: tl.liikeId,
          nimi: (liike && liike.nimi) || tl.liikeId,
          tyyppi,
          arvo: n.arvo,
          aiempi: e.arvo,
          yksikko: tyyppi === 'toistot' || (tyyppi === 'arvioituVoima' && liike && liike.valine === 'kehonpaino')
            ? 'toistoa'
            : 'kg',
        });
      }
    }
  }
  return tulos;
}

// Päivämäärät viikoittain: { [viikonAlkuPvm]: ['YYYY-MM-DD', ...] } (eri päivät, järjestyksessä).
function paivatViikoittain(treenit, viikonAlku) {
  const viikot = new Map();
  for (const t of treenit || []) {
    if (!t || typeof t.pvm !== 'string') continue;
    const w = weekStart(t.pvm, viikonAlku);
    if (!viikot.has(w)) viikot.set(w, new Set());
    viikot.get(w).add(t.pvm);
  }
  const tulos = new Map();
  for (const [w, s] of viikot) tulos.set(w, [...s].sort());
  return tulos;
}

function tavoiteLuku(tavoite) {
  return Number.isFinite(tavoite) && tavoite >= 1 ? Math.round(tavoite) : 1;
}

// --- Julkiset funktiot -----------------------------------------------------

/**
 * estimateKcal(treeni, kehonpaino) → { kcal: number|null, arvio: bool }
 * Voimatreeni: MET 5,0 × kehonpaino × tunnit, pyöristettynä (arvio). Tuotu aktiviteetti: annettu kcal.
 */
export function estimateKcal(treeni, kehonpaino) {
  if (!treeni) return { kcal: null, arvio: false };
  if (!onVoimatreeni(treeni)) {
    return { kcal: Number.isFinite(treeni.kcal) ? Math.round(treeni.kcal) : null, arvio: false };
  }
  const kg = Number.isFinite(kehonpaino) && kehonpaino > 0 ? kehonpaino : OLETUS_KEHONPAINO;
  const tunnit = Number.isFinite(treeni.kestoS) && treeni.kestoS > 0 ? treeni.kestoS / 3600 : 0;
  return { kcal: Math.round(MET_VOIMA * kg * tunnit), arvio: true };
}

/**
 * workoutSummary(treeni, liikkeet, aiemmat, kehonpaino?) →
 *   { otsikko, liikkeita, kcal, kcalArvio, volyymi,
 *     lihakset: [{ lihas, sarjat }]  (päälihasryhmät, eniten sarjoja ensin),
 *     ennatykset: [{ liikeId, nimi, tyyppi, arvo, aiempi, yksikko }] }
 * Otsikko: voimatreenissä päälihasryhmät sarjamäärän mukaan (enintään 3, sitten "…"),
 * tuodussa aktiviteetissa sen nimi. `aiemmat` voi sisältää koko historian: vain ennen
 * treeniä tehdyt otetaan vertailuun.
 */
export function workoutSummary(treeni, liikkeet, aiemmat = [], kehonpaino) {
  const lmap = liikeKartta(liikkeet);
  const { kcal, arvio } = estimateKcal(treeni, kehonpaino);
  if (!treeni || !onVoimatreeni(treeni)) {
    return {
      otsikko: (treeni && treeni.nimi) || 'Aktiviteetti',
      liikkeita: 0,
      kcal,
      kcalArvio: arvio,
      volyymi: 0,
      lihakset: [],
      ennatykset: [],
    };
  }

  const sarjoja = new Map(); // lisäysjärjestys ratkaisee tasapelit
  let liikkeita = 0;
  for (const tl of treeni.liikkeet || []) {
    const n = tyoSarjat(tl.sarjat).length;
    if (n === 0) continue;
    liikkeita += 1;
    const l = lmap.get(tl.liikeId);
    if (!l || !l.lihasryhma) continue;
    sarjoja.set(l.lihasryhma, (sarjoja.get(l.lihasryhma) || 0) + n);
  }
  const lihakset = [...sarjoja.entries()]
    .map(([lihas, sarjat], i) => ({ lihas, sarjat, i }))
    .sort((a, b) => b.sarjat - a.sarjat || a.i - b.i)
    .map(({ lihas, sarjat }) => ({ lihas, sarjat }));

  const nimet = lihakset.map((x) => isoAlku(x.lihas));
  const otsikko = nimet.length === 0
    ? 'Voimatreeni'
    : nimet.slice(0, OTSIKON_LIHAKSET).join(', ') + (nimet.length > OTSIKON_LIHAKSET ? '…' : '');

  return {
    otsikko,
    liikkeita,
    kcal,
    kcalArvio: arvio,
    volyymi: treeninVolyymi(treeni, lmap),
    lihakset,
    ennatykset: treeninEnnatykset(treeni, lmap, ennenTreenia(treeni, aiemmat)),
  };
}

/**
 * weeklyGoalDays(treenit, viikonAlku, tanaan, tavoite) → { tehty, tavoite }
 * tehty = eri päivät tämän viikon aikana, joina on mikä tahansa merkintä (myös tuodut).
 */
export function weeklyGoalDays(treenit, viikonAlku, tanaan, tavoite) {
  const w = weekStart(tanaan, viikonAlku);
  const loppu = addDays(w, 7);
  const paivat = new Set();
  for (const t of treenit || []) {
    if (t && typeof t.pvm === 'string' && t.pvm >= w && t.pvm < loppu) paivat.add(t.pvm);
  }
  return { tehty: paivat.size, tavoite };
}

/**
 * streakWeeks(treenit, tavoite, viikonAlku, tanaan) → int
 * Peräkkäiset viikot, joilla viikkotavoite (eri päiviä ≥ tavoite) täyttyi. Kesken oleva
 * viikko lasketaan vain, jos se on jo täyttynyt; muuten putki lasketaan edellisestä viikosta.
 */
export function streakWeeks(treenit, tavoite, viikonAlku, tanaan) {
  const raja = tavoiteLuku(tavoite);
  const viikot = paivatViikoittain(treenit, viikonAlku);
  const taysi = (w) => (viikot.get(w) || []).length >= raja;
  let w = weekStart(tanaan, viikonAlku);
  let n = 0;
  if (taysi(w)) n += 1;
  w = addDays(w, -7);
  while (taysi(w)) {
    n += 1;
    w = addDays(w, -7);
  }
  return n;
}

/**
 * milestones(treenit, { liikkeet, tavoite = 3, viikonAlku = 'maanantai', maaritelmat = MERKKIPAALUT } = {})
 *   → [{ id, nimi, pvm }] saavutetut merkkipaalut saavutuspäivän mukaan järjestettynä.
 * Treenimäärät laskevat kaikki merkinnät (myös tuodut). Ennätys ja volyymi vain voimatreeneistä.
 * Putki: päivä, jona neljännen peräkkäisen täyden viikon tavoite täyttyi.
 */
export function milestones(treenit, {
  liikkeet = [],
  tavoite = 3,
  viikonAlku = 'maanantai',
  maaritelmat = MERKKIPAALUT,
} = {}) {
  const kaikki = aikajarjestys(treenit);
  const lmap = liikeKartta(liikkeet);
  const pvmt = {};

  const maarat = { 'eka-treeni': 1, 'treenit-10': 10, 'treenit-50': 50, 'treenit-100': 100 };
  for (const [id, n] of Object.entries(maarat)) {
    if (kaikki.length >= n) pvmt[id] = kaikki[n - 1].pvm;
  }

  const voima = kaikki.filter(onVoimatreeni);
  for (let i = 0; i < voima.length; i++) {
    const t = voima[i];
    if (!pvmt['volyymi-10000'] && treeninVolyymi(t, lmap) >= 10000) pvmt['volyymi-10000'] = t.pvm;
    if (!pvmt['eka-ennatys'] && i > 0 && treeninEnnatykset(t, lmap, voima.slice(0, i)).length > 0) {
      pvmt['eka-ennatys'] = t.pvm;
    }
    if (pvmt['volyymi-10000'] && pvmt['eka-ennatys']) break;
  }

  const raja = tavoiteLuku(tavoite);
  const viikot = paivatViikoittain(kaikki, viikonAlku);
  let putki = 0;
  let edellinenTaysi = null;
  for (const w of [...viikot.keys()].sort()) {
    const paivat = viikot.get(w);
    if (paivat.length < raja) continue;
    putki = edellinenTaysi === addDays(w, -7) ? putki + 1 : 1;
    edellinenTaysi = w;
    if (putki >= 4) {
      pvmt['putki-4-viikkoa'] = paivat[raja - 1];
      break;
    }
  }

  return (maaritelmat || [])
    .filter((m) => pvmt[m.id])
    .map((m, i) => ({ id: m.id, nimi: m.nimi, pvm: pvmt[m.id], i }))
    .sort((a, b) => (a.pvm < b.pvm ? -1 : a.pvm > b.pvm ? 1 : a.i - b.i))
    .map(({ id, nimi, pvm }) => ({ id, nimi, pvm }));
}
