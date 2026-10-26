// Treenin jakokortti (speksi 4k A): kortin data ja jakoteksti. Kortin piirto canvasiin tehdään
// näkymässä. Puhdas moduuli: ei DOM-, window-, localStorage- eikä Date.now()-kutsuja.
//
// Yksityisyys: kun painot on piilotettu (naytaPainot: false), tuloksessa ei ole yhtään kilomäärää:
// volyymi korvataan sarjamäärällä, ennätykset näytetään muodossa "+N ennätystä" ja oivalluksista
// näytetään vain prosentit.

import { onVoimatreeni, onTyosarja } from './util.js?v=19a48e7';
import { workoutSummary } from './history.js?v=19a48e7';
import { workoutInsights } from './insights.js?v=19a48e7';
import { challengeProgress } from './challenges.js?v=19a48e7';
import { LIIKKEET, OHJELMAT } from '../data.js?v=19a48e7';

export const SANAMERKKI = 'Personal SuperPower';
const MAX_KOHOKOHDAT = 2;
const ENNATYS_NIMI = {
  arvioituVoima: 'arvioitu maksimi', paino: 'raskain paino', volyymi: 'volyymi', toistot: 'eniten toistoja',
};
const VKP = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];
const KG_RE = /\bkg\b/i;

function luku(n, desimaalit = 1) {
  if (!Number.isFinite(n)) return '–';
  const pyor = Math.round(n * 10 ** desimaalit) / 10 ** desimaalit;
  const [koko, osa] = String(Math.abs(pyor)).split('.');
  return `${pyor < 0 ? '−' : ''}${koko.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}${osa ? `,${osa}` : ''}`;
}

function kestoTeksti(s) {
  const m = Math.max(0, Math.round((Number.isFinite(s) ? s : 0) / 60));
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 60)} h`;
}

function pvmTeksti(pvm) {
  const d = new Date(`${pvm}T12:00:00Z`);
  const [y, m, p] = pvm.split('-').map(Number);
  return `${VKP[d.getUTCDay()]} ${p}.${m}.${y}`;
}

function loppuAika(treeni) {
  const alku = Date.parse(treeni.aloitus || '');
  if (Number.isFinite(alku)) return new Date(alku + (Number.isFinite(treeni.kestoS) ? treeni.kestoS : 0) * 1000).toISOString();
  return `${treeni.pvm}T20:00:00`;
}

function mittariArvo(mittari, n, naytaPainot) {
  const x = Math.round(n);
  if (mittari === 'volyymi') return naytaPainot ? `${luku(x, 0)} kg` : null;
  return luku(x, 0);
}

function ennatysKohokohta(ennatykset, naytaPainot) {
  const n = ennatykset.length;
  if (!n) return null;
  if (!naytaPainot) return { tyyppi: 'ennatys', teksti: n === 1 ? '+1 ennätys' : `+${n} ennätystä` };
  const paras = ennatykset.find((e) => e.tyyppi === 'arvioituVoima') || ennatykset[0];
  const lisa = n > 1 ? ` (+${n - 1} muuta ennätystä)` : '';
  return {
    tyyppi: 'ennatys',
    teksti: `${paras.nimi}: uusi ${ENNATYS_NIMI[paras.tyyppi] || 'ennätys'} ${luku(paras.arvo)} ${paras.yksikko}${lisa}`,
  };
}

function oivallusKohokohta(kortit, naytaPainot) {
  for (const k of kortit) {
    if (k.tyyppi !== 'edistys' || k.prioriteetti === 1) continue; // prioriteetti 1 = ennätyskortti
    if (naytaPainot) return { tyyppi: 'oivallus', teksti: k.teksti };
    const pros = String(k.teksti || '').match(/([+−-]\d+(?:,\d+)?) %/);
    const teksti = pros ? `${k.otsikko} ${pros[1]} %` : k.otsikko;
    if (!KG_RE.test(teksti)) return { tyyppi: 'oivallus', teksti };
  }
  return null;
}

function haasteOsa(tila, treeni, nyt, naytaPainot) {
  const haasteet = (tila.yhteiso && Array.isArray(tila.yhteiso.haasteet)) ? tila.yhteiso.haasteet : [];
  const ehdokkaat = haasteet
    .filter((h) => h && h.liittynyt && h.tyyppi !== 'kaveri' && typeof h.alku === 'string'
      && h.alku <= treeni.pvm && treeni.pvm <= h.loppu)
    .filter((h) => naytaPainot || (h.mittari !== 'volyymi' && !KG_RE.test(String(h.nimi))))
    .map((h) => ({ h, p: challengeProgress(h, tila, nyt) }))
    .filter(({ p }) => p.tavoite > 0)
    .sort((a, b) => b.p.pros - a.p.pros);
  if (!ehdokkaat.length) return null;
  const { h, p } = ehdokkaat[0];
  const arvo = mittariArvo(h.mittari, p.arvo, naytaPainot);
  const tavoite = mittariArvo(h.mittari, p.tavoite, naytaPainot);
  const teksti = h.mittari === 'volyymi'
    ? `${h.nimi}: ${arvo.replace(' kg', '')} / ${tavoite}`
    : `${h.nimi} ${arvo}/${tavoite}`;
  return { id: h.id, nimi: h.nimi, mittari: h.mittari, arvo: p.arvo, tavoite: p.tavoite, pros: p.pros, suoritettu: p.suoritettu, teksti };
}

/**
 * shareCardData(treeni, tila, { naytaPainot = true, naytaHaaste = true } = {}) → {
 *   sanamerkki: 'Personal SuperPower', pvm, pvmTeksti: 'ma 26.10.2026', otsikko,
 *   avainluvut: [{ id: 'kesto'|'volyymi'|'sarjat'|'liikkeet', nimi, arvo, teksti }]   (aina 3),
 *   kohokohdat: [{ tyyppi: 'ennatys'|'oivallus', teksti }]   (enintään 2),
 *   ennatyksia, haaste: { id, nimi, mittari, arvo, tavoite, pros, suoritettu, teksti } | null,
 *   lihakset: [{ lihas, sarjat }]   (kehokartta, eniten sarjoja ensin),
 *   naytaPainot, naytaHaaste, jakoteksti }
 * Painot näkyvissä: avainluvut kesto, volyymi (kg) ja sarjat. Painot piilossa: kesto, sarjat ja
 * liikkeet (volyymi korvautuu sarjamäärällä), ennätykset "+N ennätystä", oivalluksista vain prosentit
 * eikä volyymihaasteita; tuloksessa ei ole yhtään kilomäärää. Haaste: liitetty, treenipäivänä voimassa
 * oleva haaste, jolla on tavoite (paras edistyminen ensin); naytaHaaste: false → null.
 */
export function shareCardData(treeni, tila, { naytaPainot = true, naytaHaaste = true } = {}) {
  const t = tila || {};
  if (!treeni || typeof treeni.pvm !== 'string') return null;
  const historia = Array.isArray(t.historia) ? t.historia : [];
  const mukana = historia.some((x) => x === treeni || (treeni.id != null && x && x.id === treeni.id));
  const historiaTreenilla = mukana ? historia : [...historia, treeni];
  const tilaTreenilla = mukana ? t : { ...t, historia: historiaTreenilla };
  const profiili = t.profiili || {};
  const nyt = loppuAika(treeni);

  const yv = workoutSummary(treeni, LIIKKEET, historiaTreenilla, profiili.kehonpaino);
  const voima = onVoimatreeni(treeni);
  const sarjat = voima
    ? (treeni.liikkeet || []).reduce((n, tl) => n + (tl.sarjat || []).filter(onTyosarja).length, 0)
    : 0;
  const kesto = { id: 'kesto', nimi: 'Kesto', arvo: Math.round((treeni.kestoS || 0) / 60), teksti: kestoTeksti(treeni.kestoS) };
  const sarjaLuku = { id: 'sarjat', nimi: 'Sarjat', arvo: sarjat, teksti: luku(sarjat, 0) };
  const avainluvut = naytaPainot
    ? [kesto, { id: 'volyymi', nimi: 'Volyymi', arvo: yv.volyymi, teksti: `${luku(yv.volyymi, 0)} kg` }, sarjaLuku]
    : [kesto, sarjaLuku, { id: 'liikkeet', nimi: 'Liikkeet', arvo: yv.liikkeita, teksti: luku(yv.liikkeita, 0) }];

  const kohokohdat = [];
  const ennatys = ennatysKohokohta(yv.ennatykset, naytaPainot);
  if (ennatys) kohokohdat.push(ennatys);
  if (voima) {
    const omat = Array.isArray(t.omatOhjelmat) ? t.omatOhjelmat : [];
    const ohjelma = [...OHJELMAT, ...omat].find((o) => o && o.id === treeni.ohjelmaId) || null;
    const kortit = workoutInsights({
      treeni, historia: historiaTreenilla, liikkeet: LIIKKEET, profiili, ohjelma, muistit: t.muistit || [], nyt,
    });
    const oivallus = oivallusKohokohta(kortit, naytaPainot);
    if (oivallus) kohokohdat.push(oivallus);
  }

  const haaste = naytaHaaste ? haasteOsa(tilaTreenilla, treeni, nyt, naytaPainot) : null;
  const otsikko = voima ? (treeni.paivaNimi || yv.otsikko) : yv.otsikko;
  const rivit = [
    `${SANAMERKKI} · ${pvmTeksti(treeni.pvm)}`,
    `${otsikko}: ${avainluvut.map((a) => `${a.nimi.toLowerCase()} ${a.teksti}`).join(', ')}`,
    ...kohokohdat.slice(0, MAX_KOHOKOHDAT).map((k) => k.teksti),
  ];
  if (haaste) rivit.push(`Haaste: ${haaste.teksti}`);

  return {
    sanamerkki: SANAMERKKI,
    pvm: treeni.pvm,
    pvmTeksti: pvmTeksti(treeni.pvm),
    otsikko,
    avainluvut,
    kohokohdat: kohokohdat.slice(0, MAX_KOHOKOHDAT),
    ennatyksia: yv.ennatykset.length,
    haaste,
    lihakset: yv.lihakset,
    naytaPainot: !!naytaPainot,
    naytaHaaste: !!naytaHaaste,
    jakoteksti: rivit.join('\n'),
  };
}
