// Viikkotavoitteet eli sarjatavoitteet (speksi 4d, 4h). Puhdas moduuli: ei DOM-, window-,
// localStorage- eikä Date.now()-kutsuja.

import { addDays, onVoimatreeni, onTyosarja } from './util.js?v=31a36ec';
import { eventPlan, eventWeekMultiplier } from './event.js?v=31a36ec';

export const LIHASRYHMAT_T = ['rinta', 'selkä', 'olkapäät', 'hauis', 'ojentajat', 'etureidet', 'takareidet', 'pakarat', 'pohkeet', 'vatsa'];
export const RYHMAT_T = {
  tyonnot: ['rinta', 'olkapäät', 'ojentajat'],
  vedot: ['selkä', 'hauis'],
  jalat: ['etureidet', 'takareidet', 'pakarat', 'pohkeet'],
};

const PIENET = new Set(['hauis', 'ojentajat', 'pohkeet', 'vatsa']);
const PIENTEN_KERROIN = 0.75;
const PERUSTASO = { lihasmassa: 12, voimanosto: 10, kiinteytys: 10, voima: 8, kunto: 8, painonpudotus: 8 };
const KOKEMUSKERROIN = { aloittelija: 0.75, keskitaso: 1.0, kokenut: 1.25 };
const SARJAN_KESTO_MIN = 3;
const VAHIMMAISTAVOITE = 4;

function ryhmaKertoimet(viikkosuunnitelma) {
  const kertoimet = {};
  const annetut = (viikkosuunnitelma && viikkosuunnitelma.sarjatavoiteKertoimet) || {};
  for (const [ryhma, lihakset] of Object.entries(RYHMAT_T)) {
    const k = annetut[ryhma];
    if (typeof k === 'number' && Number.isFinite(k) && k >= 0) {
      for (const lihas of lihakset) kertoimet[lihas] = k;
    }
  }
  return kertoimet;
}

// Tapahtuman jakson kerroin (speksi 4k): luku tai { kerroin } (esim. eventPlan(...).nykyinen).
// Puuttuva tai virheellinen arvo = 1.
function jaksonKerroin(arvo) {
  const k = arvo && typeof arvo === 'object' ? arvo.kerroin : arvo;
  return typeof k === 'number' && Number.isFinite(k) && k >= 0 ? k : 1;
}

/**
 * weeklyTargets(profiili, viikkosuunnitelma = null, jaksoKerroin = 1) → { [lihas]: tavoiteSarjat }
 * Perustaso × kokemuskerroin × pienten lihasten kerroin → aikakatto (skaalaus samassa suhteessa)
 * → viikkosuunnitelman ryhmäkerroin × tapahtuman jakson kerroin (kertolasku) → pyöristys, vähintään 4.
 * jaksoKerroin: luku tai olio, jolla on kenttä `kerroin` (eventPlan-viikko); koskee kaikkia lihaksia.
 */
export function weeklyTargets(profiili, viikkosuunnitelma = null, jaksoKerroin = 1) {
  const p = profiili || {};
  const perus = PERUSTASO[p.tavoite] ?? PERUSTASO.lihasmassa;
  const kokemus = KOKEMUSKERROIN[p.kokemus] ?? 1;

  const raaka = {};
  let summa = 0;
  for (const lihas of LIHASRYHMAT_T) {
    raaka[lihas] = perus * kokemus * (PIENET.has(lihas) ? PIENTEN_KERROIN : 1);
    summa += raaka[lihas];
  }

  const kapasiteetti = Number.isFinite(p.treenitViikossa) && Number.isFinite(p.kesto)
    ? (p.treenitViikossa * p.kesto) / SARJAN_KESTO_MIN
    : Infinity;
  const skaala = summa > kapasiteetti ? kapasiteetti / summa : 1;
  const kertoimet = ryhmaKertoimet(viikkosuunnitelma);
  const jakso = jaksonKerroin(jaksoKerroin);

  const tulos = {};
  for (const lihas of LIHASRYHMAT_T) {
    const kerroin = (kertoimet[lihas] ?? 1) * jakso;
    tulos[lihas] = Math.max(VAHIMMAISTAVOITE, Math.round(raaka[lihas] * skaala * kerroin));
  }
  return tulos;
}

/**
 * jaksoViikolle(tapahtuma, viikonAlkuPvm, viikonAlku = 'maanantai')
 *   → { kerroin, jakso, jaksoNimi, kevennysviikko } | null
 * Tavoitetapahtuman jakso viikolle, joka alkaa viikonAlkuPvm (speksi 4k C ja 4d). Kerroin tulee
 * eventWeekMultiplier-funktiosta. null: ei tapahtumaa, viikko on tapahtuman jälkeen tai päättyi ennen
 * tapahtuman asettamista (`tapahtuma.asetettu`), jolloin kerroin on 1.
 */
export function jaksoViikolle(tapahtuma, viikonAlkuPvm, viikonAlku = 'maanantai') {
  if (!tapahtuma || typeof tapahtuma !== 'object' || typeof viikonAlkuPvm !== 'string') return null;
  if (typeof tapahtuma.asetettu === 'string' && addDays(viikonAlkuPvm, 6) < tapahtuma.asetettu.slice(0, 10)) return null;
  const opts = { viikonAlku: viikonAlku === 'sunnuntai' ? 'sunnuntai' : 'maanantai' };
  const plan = eventPlan(tapahtuma, viikonAlkuPvm, opts);
  if (!plan || !plan.nykyinen) return null;
  return {
    kerroin: eventWeekMultiplier(tapahtuma, viikonAlkuPvm, opts),
    jakso: plan.nykyinen.jakso,
    jaksoNimi: plan.nykyinen.jaksoNimi,
    kevennysviikko: plan.nykyinen.kevennysviikko,
  };
}

// Viikon suunnitelma: viikonAlku täsmää tai jokin suunnitelman päivä osuu viikkoon.
function suunnitelmaViikolle(suunnitelmat, alku) {
  const lista = Array.isArray(suunnitelmat) ? suunnitelmat : [];
  const loppu = addDays(alku, 7);
  return lista.find((s) => s && s.viikonAlku === alku)
    || lista.find((s) => s && (s.paivat || []).some((p) => p && p.pvm >= alku && p.pvm < loppu))
    || null;
}

/**
 * viikonTavoitteet(tila, viikonAlkuPvm, { suunnitelma } = {}) → { tavoitteet, suunnitelma, jakso }
 * Yhteinen viikkotavoitteiden laskenta näkymille: profiili, viikon suunnitelma (oletuksena
 * tila.viikkosuunnitelmat-listasta; anna `suunnitelma` ohittaaksesi, myös null) ja tavoitetapahtuman
 * jakson kerroin (jaksoViikolle). jakso = null, kun kerroin ei ole voimassa.
 */
export function viikonTavoitteet(tila, viikonAlkuPvm, opts = {}) {
  const t = tila || {};
  const profiili = t.profiili || {};
  const suunnitelma = 'suunnitelma' in opts ? opts.suunnitelma : suunnitelmaViikolle(t.viikkosuunnitelmat, viikonAlkuPvm);
  const jakso = jaksoViikolle(profiili.tapahtuma, viikonAlkuPvm, profiili.viikonAlku);
  return {
    tavoitteet: weeklyTargets(profiili, suunnitelma, jakso ? jakso.kerroin : 1),
    suunnitelma,
    jakso,
  };
}

/**
 * weeklyProgress(treenit, liikkeet, tavoitteet, viikonAlkuPvm)
 * Viikko = [viikonAlkuPvm, viikonAlkuPvm + 7 pv). Vain päälihasryhmä kerryttää (1 sarja = 1),
 * lämmittelysarjat ja tuodut aktiviteetit eivät kerrytä.
 * → { lihakset: { [lihas]: { tehty, tavoite, jaljella } },
 *     ryhmat: { tyonnot|vedot|jalat: { tehty, tavoite, jaljella, pros } }, kokonaisPros }
 */
export function weeklyProgress(treenit, liikkeet, tavoitteet, viikonAlkuPvm) {
  const tav = tavoitteet || {};
  const liikeMap = new Map((liikkeet || []).map((l) => [l.id, l]));
  const viikonLoppu = addDays(viikonAlkuPvm, 7);

  const tehty = {};
  for (const lihas of Object.keys(tav)) tehty[lihas] = 0;

  for (const treeni of treenit || []) {
    if (!onVoimatreeni(treeni)) continue;
    if (!(treeni.pvm >= viikonAlkuPvm && treeni.pvm < viikonLoppu)) continue;
    for (const tl of treeni.liikkeet || []) {
      const liike = liikeMap.get(tl.liikeId);
      if (!liike || !(liike.lihasryhma in tehty)) continue;
      tehty[liike.lihasryhma] += (tl.sarjat || []).filter(onTyosarja).length;
    }
  }

  const lihakset = {};
  let summaTavoite = 0;
  let summaRajattu = 0;
  for (const [lihas, tavoite] of Object.entries(tav)) {
    lihakset[lihas] = { tehty: tehty[lihas], tavoite, jaljella: Math.max(0, tavoite - tehty[lihas]) };
    summaTavoite += tavoite;
    summaRajattu += Math.min(tehty[lihas], tavoite);
  }

  const ryhmat = {};
  for (const [ryhma, jasenet] of Object.entries(RYHMAT_T)) {
    let rTehty = 0;
    let rTavoite = 0;
    let rJaljella = 0;
    let rRajattu = 0;
    for (const lihas of jasenet) {
      const m = lihakset[lihas];
      if (!m) continue;
      rTehty += m.tehty;
      rTavoite += m.tavoite;
      rJaljella += m.jaljella;
      rRajattu += Math.min(m.tehty, m.tavoite);
    }
    ryhmat[ryhma] = {
      tehty: rTehty,
      tavoite: rTavoite,
      jaljella: rJaljella,
      pros: rTavoite > 0 ? Math.round((rRajattu / rTavoite) * 100) : 0,
    };
  }

  return {
    lihakset,
    ryhmat,
    kokonaisPros: summaTavoite > 0 ? Math.round((summaRajattu / summaTavoite) * 100) : 0,
  };
}
