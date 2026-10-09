// Treeniscore ja ennätykset: arvioitu voima, lihasvoima (mVoima), ryhmät,
// kokonaisluku, trendi ja liikekohtaiset ennätykset. Puhdas moduuli.

import { addDays, daysBetween, onVoimatreeni, onTyosarja } from './util.js?v=270067f';
import { e1rm } from './progression.js?v=270067f';

const LIHASRYHMAT = ['rinta', 'selkä', 'olkapäät', 'hauis', 'ojentajat', 'etureidet', 'takareidet', 'pakarat', 'pohkeet', 'vatsa'];
const RYHMAT = {
  tyonnot: ['rinta', 'olkapäät', 'ojentajat'],
  vedot: ['selkä', 'hauis'],
  jalat: ['etureidet', 'takareidet', 'pakarat', 'pohkeet'],
};

const IKKUNA_PV = 42; // 6 viikkoa
const LUKITUS_SARJAT = 6;
const TAUKO_RAJA_PV = 14;
const VAHENNYS_MAX = 10;

// --- Sisäiset apurit -------------------------------------------------------

function tyoSarjat(sarjat) {
  return (sarjat || []).filter(
    (s) => onTyosarja(s) && Number.isFinite(s.paino) && Number.isFinite(s.toistot) && s.toistot > 0,
  );
}

// Voimatreenit (myös ilman tyyppiä tallennetut) aikajärjestyksessä.
function voimaTreenit(treenit) {
  return (treenit || [])
    .filter((t) => onVoimatreeni(t) && typeof t.pvm === 'string')
    .slice()
    .sort((a, b) => (a.pvm < b.pvm ? -1 : a.pvm > b.pvm ? 1 : 0));
}

// Kaikki liikkeen työsarjat muodossa { pvm, sarja }, aikajärjestyksessä, enintään tanaan-päivään.
function liikkeenSarjat(liikeId, treenit, tanaan) {
  const tulos = [];
  for (const t of voimaTreenit(treenit)) {
    if (tanaan && t.pvm > tanaan) continue;
    for (const l of t.liikkeet || []) {
      if (l.liikeId !== liikeId) continue;
      for (const s of tyoSarjat(l.sarjat)) tulos.push({ pvm: t.pvm, sarja: s });
    }
  }
  return tulos;
}

function onKehonpaino(liike) {
  return !!liike && liike.valine === 'kehonpaino';
}

function pyorista1(n) {
  return Math.round(n * 10) / 10;
}

function keskiarvo(luvut) {
  return luvut.reduce((a, b) => a + b, 0) / luvut.length;
}

// Laskee arvioidun voiman pyöristämättömänä. Ikkuna on 6 viikkoa viimeisimpään kertaan asti,
// jotta tauon jälkeenkin arvio on olemassa ja taukovähennys näkyy.
function arvioRaaka(liike, treenit, tanaan) {
  if (!liike) return null;
  const sarjat = liikkeenSarjat(liike.id, treenit, tanaan);
  if (sarjat.length === 0) return null;
  const viimeksi = sarjat[sarjat.length - 1].pvm;
  const alku = addDays(viimeksi, -(IKKUNA_PV - 1));
  const ikkunassa = sarjat.filter((x) => x.pvm >= alku);
  const kp = onKehonpaino(liike);
  const paras = Math.max(...ikkunassa.map((x) => (kp ? x.sarja.toistot : e1rm(x.sarja.paino, x.sarja.toistot))));
  const tauko = daysBetween(viimeksi, tanaan);
  const vahennysPros = tauko > TAUKO_RAJA_PV
    ? Math.min(VAHENNYS_MAX, Math.ceil((tauko - TAUKO_RAJA_PV) / 7))
    : 0;
  return {
    arvo: paras * (1 - vahennysPros / 100),
    yksikko: kp ? 'toistoa' : 'kg',
    vahennysPros,
    viimeksi,
  };
}

// --- Julkiset funktiot -----------------------------------------------------

// Liikkeen arvioitu voima: painoliikkeillä paras e1RM, kehonpainoliikkeillä paras toistomäärä.
// Yli 14 päivän tauko vähentää 1 % jokaista alkavaa viikkoa kohden, enintään 10 %.
export function estimatedStrength(liike, treenit, tanaan) {
  const r = arvioRaaka(liike, treenit, tanaan);
  if (!r) return null;
  return { ...r, arvo: pyorista1(r.arvo) };
}

// Lihasvoima 0–100 lihasryhmittäin (50 = viitetaso). Ryhmä on lukittu, kunnes sille on
// kirjattu vähintään 6 päälihasryhmäsarjaa 6 viikon ikkunassa.
export function muscleStrength(liikkeet, treenit, kehonpaino, tanaan) {
  const lista = liikkeet || [];
  const liikeById = new Map(lista.map((l) => [l.id, l]));
  const ryhmat = [...LIHASRYHMAT];
  for (const l of lista) if (l.lihasryhma && !ryhmat.includes(l.lihasryhma)) ryhmat.push(l.lihasryhma);

  const alku = addDays(tanaan, -(IKKUNA_PV - 1));
  const sarjoja = Object.fromEntries(ryhmat.map((r) => [r, 0]));
  const tehdytLiikkeet = new Set();
  for (const t of voimaTreenit(treenit)) {
    if (t.pvm < alku || t.pvm > tanaan) continue;
    for (const tl of t.liikkeet || []) {
      const l = liikeById.get(tl.liikeId);
      if (!l) continue;
      const n = tyoSarjat(tl.sarjat).length;
      if (n === 0) continue;
      sarjoja[l.lihasryhma] += n;
      tehdytLiikkeet.add(l.id);
    }
  }

  const tulos = {};
  for (const r of ryhmat) {
    const lukittu = sarjoja[r] < LUKITUS_SARJAT;
    let arvo = null;
    if (!lukittu) {
      const pisteet = [];
      for (const id of tehdytLiikkeet) {
        const l = liikeById.get(id);
        if (l.lihasryhma !== r) continue;
        const viite = Number.isFinite(l.viitekerroin) && l.viitekerroin > 0
          ? (Number.isFinite(kehonpaino) && kehonpaino > 0 ? l.viitekerroin * kehonpaino : null)
          : (Number.isFinite(l.viitetoistot) && l.viitetoistot > 0 ? l.viitetoistot : null);
        if (!viite) continue;
        const arvio = arvioRaaka(l, treenit, tanaan);
        if (!arvio) continue;
        pisteet.push((arvio.arvo / viite) * 50);
      }
      if (pisteet.length) arvo = Math.round(Math.min(100, Math.max(0, keskiarvo(pisteet))));
    }
    tulos[r] = { arvo, sarjoja: sarjoja[r], lukittu };
  }
  return tulos;
}

// Ryhmät (työnnöt, vedot, jalat) ja kokonaisluku. Ryhmän luku näkyy vain, jos jokaisella
// ryhmän lihaksella on arvo; kokonaisluku vain, jos kaikilla kolmella ryhmällä on luku.
// `vatsa` ei vaikuta.
export function treeniscore(mVoimat) {
  const m = mVoimat || {};
  const puuttuvat = [];
  const raaka = {};
  for (const [ryhma, lihakset] of Object.entries(RYHMAT)) {
    const arvot = [];
    for (const lihas of lihakset) {
      const a = m[lihas] && m[lihas].arvo;
      if (Number.isFinite(a)) arvot.push(a);
      else puuttuvat.push(lihas);
    }
    raaka[ryhma] = arvot.length === lihakset.length ? keskiarvo(arvot) : null;
  }
  const kaikki = Object.values(raaka);
  const kokonais = kaikki.every((a) => a !== null) ? Math.round(keskiarvo(kaikki)) : null;
  const pyor = (a) => (a === null ? null : Math.round(a));
  return {
    tyonnot: pyor(raaka.tyonnot),
    vedot: pyor(raaka.vedot),
    jalat: pyor(raaka.jalat),
    kokonais,
    puuttuvat,
  };
}

// Trendi: verrataan lukua nyt ja 28 päivää aiemmin. Ero > +2 nousu, < -2 lasku, muuten tasainen.
export function scoreTrend(laskeFn, tanaan) {
  const nyt = laskeFn(tanaan);
  const aiemmin = laskeFn(addDays(tanaan, -28));
  let suunta = 'tasainen';
  if (Number.isFinite(nyt) && Number.isFinite(aiemmin)) {
    const ero = nyt - aiemmin;
    if (ero > 2) suunta = 'nousu';
    else if (ero < -2) suunta = 'lasku';
  }
  return { nyt: nyt ?? null, aiemmin: aiemmin ?? null, suunta };
}

// Liikkeen ennätykset koko historiasta: arvioitu voima (paras), volyymi yhdessä treenissä
// (käsipainoilla paino × 2), eniten toistoja yhdessä sarjassa ja raskain paino.
// Tasapelissä ensimmäinen saavutus säilyy ennätyksenä.
export function exerciseRecords(liikeId, treenit, liike) {
  const kp = onKehonpaino(liike);
  const kerroin = liike && liike.valine === 'käsipainot' ? 2 : 1;
  let arvioituVoima = null;
  let volyymi = null;
  let toistot = null;
  let paino = null;
  for (const t of voimaTreenit(treenit)) {
    let treeninVolyymi = 0;
    let loytyi = false;
    for (const l of t.liikkeet || []) {
      if (l.liikeId !== liikeId) continue;
      for (const s of tyoSarjat(l.sarjat)) {
        loytyi = true;
        treeninVolyymi += s.toistot * s.paino * kerroin;
        const av = kp ? s.toistot : e1rm(s.paino, s.toistot);
        if (!arvioituVoima || av > arvioituVoima.arvo) arvioituVoima = { arvo: av, pvm: t.pvm };
        if (!toistot || s.toistot > toistot.arvo) toistot = { arvo: s.toistot, pvm: t.pvm };
        if (s.paino > 0 && (!paino || s.paino > paino.arvo)) paino = { arvo: s.paino, pvm: t.pvm };
      }
    }
    if (loytyi && treeninVolyymi > 0 && (!volyymi || treeninVolyymi > volyymi.arvo)) {
      volyymi = { arvo: treeninVolyymi, pvm: t.pvm };
    }
  }
  if (arvioituVoima) arvioituVoima = { arvo: pyorista1(arvioituVoima.arvo), pvm: arvioituVoima.pvm };
  return { arvioituVoima, volyymi, toistot, paino };
}
