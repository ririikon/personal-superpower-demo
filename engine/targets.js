// Viikkotavoitteet eli sarjatavoitteet (speksi 4d, 4h). Puhdas moduuli: ei DOM-, window-,
// localStorage- eikä Date.now()-kutsuja.

import { addDays, onVoimatreeni, onTyosarja } from './util.js?v=270067f';

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

/**
 * weeklyTargets(profiili, viikkosuunnitelma = null) → { [lihas]: tavoiteSarjat }
 * Perustaso × kokemuskerroin × pienten lihasten kerroin → aikakatto (skaalaus samassa suhteessa)
 * → viikkosuunnitelman ryhmäkerroin → pyöristys, vähintään 4.
 */
export function weeklyTargets(profiili, viikkosuunnitelma = null) {
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

  const tulos = {};
  for (const lihas of LIHASRYHMAT_T) {
    const kerroin = kertoimet[lihas] ?? 1;
    tulos[lihas] = Math.max(VAHIMMAISTAVOITE, Math.round(raaka[lihas] * skaala * kerroin));
  }
  return tulos;
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
